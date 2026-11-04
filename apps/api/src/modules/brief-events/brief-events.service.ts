import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { DataSource, EntityManager } from "typeorm";
import { randomUUID } from "crypto";
import { v5 as uuidv5 } from "uuid";
import { Brief } from "@/database/entities/brief.entity";
import { BriefEvent, BriefEventAttendee } from "@/database/entities/brief-event.entity";
import { Participant } from "@/database/entities/participant.entity";
import { Organization, OrganizationUser } from "@/database/entities/organization.entity";
import { NotificationPriority, NotificationRecipientType, NotificationType } from "@/database/entities/notification.entity";
import { EmailService } from "@/email/email.service";
import { ZoomService } from "@/modules/calendar/zoom.service";
import { NotificationsService } from "@/modules/notifications/notifications.service";
import { OneSignalService } from "@/modules/notifications/onesignal.service";
import { CreateBriefEventDto, UpdateBriefEventDto } from "./dto/brief-event.dto";
import { BriefEventCalendarQueryDto } from "./dto/brief-event-calendar.dto";
import { calendarInvitation, escapeHtml } from "./calendar-invitation";

export interface EventActor { id: string; role: string; email?: string; cohortId?: string }
const managers = ["super_admin", "program_manager"];
const staff = [...managers, "evaluator", "viewer"];
const hostLock = "acmp-brief-events-host";

@Injectable()
export class BriefEventsService {
  private readonly logger = new Logger(BriefEventsService.name);
  private syncQueue: Promise<void> = Promise.resolve();
  constructor(
    private readonly db: DataSource,
    private readonly zoom: ZoomService,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
    private readonly push: OneSignalService,
    private readonly config: ConfigService,
  ) {}

  private async brief(id: string): Promise<Brief> {
    const brief = await this.db.getRepository(Brief).findOne({ where: { id }, relations: ["organization"] });
    if (!brief || !brief.organization) throw new NotFoundException("Brief not found");
    return brief;
  }

  private recipients(briefId: string, manager = this.db.manager) {
    return manager.getRepository(Participant).createQueryBuilder("p")
      .innerJoin("team_members", "m", "m.participant_id = p.id AND m.deleted_at IS NULL AND m.status = :confirmed", { confirmed: "confirmed" })
      .innerJoin("teams", "t", "t.id = m.team_id AND t.deleted_at IS NULL AND t.status != :disqualified", { disqualified: "disqualified" })
      .innerJoin(Brief, "b", "b.id = t.brief_id AND b.cohortId = t.cohort_id AND b.cohortId = p.cohort_id")
      .where("t.brief_id = :briefId", { briefId }).distinct(true);
  }

  private async access(brief: Brief, actor: EventActor, write = false): Promise<{ canManage: boolean; canView: boolean }> {
    if (staff.includes(actor.role)) {
      const canManage = managers.includes(actor.role);
      if (write && !canManage) throw new ForbiddenException("Only program managers can manage brief events");
      return { canManage, canView: true };
    }
    if (actor.role === "organization") {
      const link = await this.db.getRepository(OrganizationUser).findOne({ where: { userId: actor.id } });
      const org = link
        ? await this.db.getRepository(Organization).findOneBy({ id: link.organizationId })
        : actor.email ? await this.db.getRepository(Organization).findOneBy({ email: actor.email }) : null;
      if (!org || !org.isActive || org.status !== "approved" || brief.organizationId !== org.id) throw new ForbiddenException("This brief belongs to another organization");
      const canManage = !link || ["owner", "admin"].includes(link.role);
      if (write && !canManage) throw new ForbiddenException("Only organization owners and admins can manage events");
      return { canManage, canView: true };
    }
    if (actor.role === "participant" && !write) {
      const canView = actor.cohortId === brief.cohortId && !!await this.recipients(brief.id).andWhere("p.id = :participantId", { participantId: actor.id }).getOne();
      return { canManage: false, canView };
    }
    throw new ForbiddenException("You cannot access brief events");
  }

  private validateSchedule(input: { startAt: string | Date; timezone: string; durationMinutes: number }) {
    const startAt = new Date(input.startAt);
    if (!Number.isFinite(startAt.getTime()) || startAt.getTime() <= Date.now()) throw new BadRequestException("Choose a future date and time for the event");
    if (typeof input.startAt === "string" && !/(Z|[+-]\d{2}:\d{2})$/i.test(input.startAt)) throw new BadRequestException("Event timestamps must include a timezone offset");
    try { new Intl.DateTimeFormat("en", { timeZone: input.timezone }).format(startAt); }
    catch { throw new BadRequestException("Choose a valid event timezone"); }
    if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 15 || input.durationMinutes > 480) throw new BadRequestException("Event duration must be 15–480 minutes");
    return { startAt, endAt: new Date(startAt.getTime() + input.durationMinutes * 60000) };
  }

  private async lockHost(manager: EntityManager, eventId?: string) {
    await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [hostLock]);
    if (eventId) await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["brief-event:" + eventId]);
  }

  private async checkOverlap(manager: EntityManager, hostId: string, startAt: Date, endAt: Date, except?: string) {
    const query = manager.getRepository(BriefEvent).createQueryBuilder("event")
      .where("event.zoomHostId = :hostId AND event.status = :status", { hostId, status: "scheduled" })
      .andWhere("event.startAt < :endAt AND event.endAt > :startAt", { startAt, endAt });
    if (except) query.andWhere("event.id != :except", { except });
    if (await query.getExists()) throw new ConflictException("The shared ATF Zoom host already has a brief event at this time. Choose another time.");
  }

  async list(briefId: string, actor: EventActor) {
    const brief = await this.brief(briefId);
    const access = await this.access(brief, actor);
    const events = access.canView ? await this.db.getRepository(BriefEvent).find({ where: { briefId }, order: { startAt: "DESC" } }) : [];
    return { events: await Promise.all(events.map(event => this.response(event, access.canManage))), canManage: access.canManage, zoomConfigured: access.canManage && this.zoom.isReady() };
  }

  async staffCalendar(query: BriefEventCalendarQueryDto, actor: EventActor) {
    if (!staff.includes(actor.role)) throw new ForbiddenException("Only staff can view the partner event calendar");
    const startAt = new Date(query.startAt), endAt = new Date(query.endAt);
    if (![query.startAt, query.endAt].every(value => /(Z|[+-]\d{2}:\d{2})$/i.test(value))
      || !Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime())
      || endAt <= startAt || endAt.getTime() - startAt.getTime() > 62 * 86400000) {
      throw new BadRequestException("Choose a calendar range of up to 62 days with timezone offsets");
    }
    const events = this.db.getRepository(BriefEvent).createQueryBuilder("event")
      .innerJoinAndSelect("event.brief", "brief")
      .innerJoinAndSelect("brief.organization", "organization")
      .select(["event.id", "event.briefId", "event.title", "event.description", "event.startAt", "event.endAt", "event.timezone", "event.durationMinutes", "event.status", "event.zoomJoinUrl", "event.revision", "brief.id", "brief.title", "organization.id", "organization.name"])
      .where("brief.cohortId = :cohortId", { cohortId: query.cohortId })
      .andWhere("event.startAt < :endAt AND event.endAt > :startAt", { startAt, endAt })
      .orderBy("event.startAt", "ASC").addOrderBy("event.id", "ASC");
    if (query.search) events.andWhere("organization.name ILIKE :search", { search: `%${query.search}%` });
    return { events: (await events.getMany()).map(event => ({
      id: event.id, briefId: event.briefId, title: event.title, description: event.description,
      startAt: event.startAt, endAt: event.endAt, timezone: event.timezone, durationMinutes: event.durationMinutes,
      status: event.status, zoomJoinUrl: event.status === "scheduled" ? event.zoomJoinUrl : null, revision: event.revision,
      brief: { id: event.brief.id, title: event.brief.title },
      organization: { id: event.brief.organization.id, name: event.brief.organization.name },
    })) };
  }

  async create(briefId: string, dto: CreateBriefEventDto, actor: EventActor) {
    const brief = await this.brief(briefId);
    await this.access(brief, actor, true);
    const dates = this.validateSchedule(dto);
    let meetingId: string | undefined;
    let event: BriefEvent;
    try {
      event = await this.db.transaction(async manager => {
        await this.lockHost(manager);
        const hostId = this.zoom.hostId;
        await this.checkOverlap(manager, hostId, dates.startAt, dates.endAt);
        const meeting = await this.zoom.createMeeting({ ...dto, startAt: dates.startAt });
        meetingId = meeting.id;
        return manager.getRepository(BriefEvent).save({ id: randomUUID(), ...dto, ...dates, briefId, zoomHostId: hostId, zoomMeetingId: meeting.id, zoomJoinUrl: meeting.joinUrl, createdBy: actor.id, syncError: "Invitations are pending" });
      });
    } catch (error) {
      if (meetingId) await this.zoom.deleteMeeting(meetingId).catch(() => this.logger.error("Could not remove a Zoom meeting after event persistence failed"));
      throw error;
    }
    this.scheduleSync(event.id);
    return this.response(event, true);
  }

  async update(id: string, dto: UpdateBriefEventDto, actor: EventActor) {
    const original = await this.db.getRepository(BriefEvent).findOneBy({ id });
    if (!original) throw new NotFoundException("Event not found");
    await this.access(await this.brief(original.briefId), actor, true);
    const event = await this.db.transaction(async manager => {
      await this.lockHost(manager, id);
      const event = await manager.getRepository(BriefEvent).findOneByOrFail({ id });
      if (event.status === "cancelled") throw new BadRequestException("Cancelled events cannot be edited");
      const merged = { ...event, ...dto };
      const dates = this.validateSchedule(merged);
      await this.checkOverlap(manager, event.zoomHostId, dates.startAt, dates.endAt, id);
      return manager.getRepository(BriefEvent).save({ ...merged, ...dates, revision: event.revision + 1 });
    });
    this.scheduleSync(id);
    return this.response(event, true);
  }

  async cancel(id: string, actor: EventActor) {
    const original = await this.db.getRepository(BriefEvent).findOneBy({ id });
    if (!original) throw new NotFoundException("Event not found");
    await this.access(await this.brief(original.briefId), actor, true);
    const event = await this.db.transaction(async manager => {
      await this.lockHost(manager, id);
      const event = await manager.getRepository(BriefEvent).findOneByOrFail({ id });
      if (event.status === "cancelled") return event;
      return manager.getRepository(BriefEvent).save({ ...event, status: "cancelled" as const, revision: event.revision + 1 });
    });
    this.scheduleSync(id);
    return this.response(event, true);
  }

  private async response(event: BriefEvent, canManage: boolean) {
    const attendees = canManage ? await this.db.getRepository(BriefEventAttendee).findBy({ eventId: event.id }) : [];
    return {
      id: event.id, briefId: event.briefId, title: event.title, description: event.description,
      startAt: event.startAt, endAt: event.endAt, timezone: event.timezone, durationMinutes: event.durationMinutes,
      status: event.status, zoomJoinUrl: event.status === "scheduled" ? event.zoomJoinUrl : null, revision: event.revision,
      ...(canManage ? { attendeeCount: attendees.filter(a => a.active).length,
        deliveryPending: !!event.syncError || event.zoomSyncedRevision < event.revision || attendees.some(a => a.emailSequence < a.sequence || a.notificationSequence < a.sequence || a.pushSequence < a.sequence) } : {}),
    };
  }

  async start(id: string, actor: EventActor): Promise<{ startUrl: string }> {
    const event = await this.db.getRepository(BriefEvent).findOneBy({ id });
    if (!event) throw new NotFoundException("Event not found");
    await this.access(await this.brief(event.briefId), actor, true);
    if (event.status !== "scheduled" || event.endAt.getTime() <= Date.now()) throw new BadRequestException("Only scheduled upcoming or ongoing events can be hosted");
    // Fetch a fresh, short-lived host link only after authorization; never store it.
    return { startUrl: await this.zoom.getHostUrl(event.zoomMeetingId) };
  }

  private organizerEmail(): string {
    return this.config.get<string>("RESEND_FROM_EMAIL") || this.config.get<string>("SMTP_FROM_EMAIL") || this.config.get<string>("email.fromEmail") || "noreply@atf.africa";
  }

  private invitation(event: BriefEvent, attendee: BriefEventAttendee, brief: Brief) {
    return calendarInvitation({ eventId: event.id, sequence: attendee.sequence, title: event.title,
      description: `${brief.organization.name} — ${brief.title}\n\n${event.description}`,
      startAt: event.startAt, endAt: event.endAt, joinUrl: event.zoomJoinUrl, organizer: this.organizerEmail(),
      attendee: attendee.email, cancelled: !attendee.active || event.status === "cancelled", updatedAt: event.updatedAt });
  }

  async download(id: string, actor: EventActor) {
    const event = await this.db.getRepository(BriefEvent).findOneBy({ id });
    if (!event) throw new NotFoundException("Event not found");
    const brief = await this.brief(event.briefId);
    const access = await this.access(brief, actor);
    if (!access.canView) throw new ForbiddenException("Only assigned team members can access this event");
    const attendee = actor.role === "participant" ? await this.db.getRepository(BriefEventAttendee).findOneBy({ eventId: id, participantId: actor.id }) : null;
    return this.invitation(event, attendee || { sequence: event.revision, email: actor.email || brief.organization.email, active: event.status === "scheduled" } as BriefEventAttendee, brief).content;
  }

  private scheduleSync(id: string) {
    void this.enqueueSync(id);
  }

  private enqueueSync(id: string): Promise<void> {
    this.syncQueue = this.syncQueue.then(() => this.syncEvent(id)).catch(() => this.logger.warn("Brief event invitations are pending retry"));
    return this.syncQueue;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async syncUpcomingEvents(): Promise<void> {
    const events = await this.db.getRepository(BriefEvent).createQueryBuilder("event")
      .where(`event.endAt > :cutoff OR event.zoomSyncedRevision < event.revision OR event.syncError IS NOT NULL OR EXISTS (
        SELECT 1 FROM brief_event_attendees a WHERE a.event_id = event.id AND
        (a.email_sequence < a.sequence OR a.notification_sequence < a.sequence OR a.push_sequence < a.sequence)
      )`, { cutoff: new Date(Date.now() - 86400000) }).getMany();
    for (const event of events) {
      try { await this.enqueueSync(event.id); }
      catch { this.logger.warn("Brief event synchronization will retry on the next run"); }
    }
  }

  async syncEvent(id: string): Promise<void> {
    const runner = this.db.createQueryRunner();
    await runner.connect();
    let locked = false;
    try {
      const [lock] = await runner.query("SELECT pg_try_advisory_lock(hashtext($1)) AS locked", ["brief-event:" + id]);
      locked = lock.locked;
      if (!locked) return;
      const manager = runner.manager;
      const event = await manager.getRepository(BriefEvent).findOneBy({ id });
      if (!event) return;
      const brief = await manager.getRepository(Brief).findOne({ where: { id: event.briefId }, relations: ["organization"], withDeleted: true });
      if (!brief?.organization) return;
      if (event.status === "scheduled" && (brief.deletedAt || brief.organization.deletedAt || !brief.organization.isActive || brief.organization.status !== "approved")) {
        event.status = "cancelled";
        event.revision++;
        await manager.getRepository(BriefEvent).save(event);
      }
      const errors: string[] = [];
      if (event.zoomSyncedRevision < event.revision) {
        try {
          if (event.status === "cancelled") await this.zoom.deleteMeeting(event.zoomMeetingId);
          else await this.zoom.updateMeeting(event.zoomMeetingId, event);
          await manager.getRepository(BriefEvent).update(id, { zoomSyncedRevision: event.revision });
        } catch { errors.push("Zoom synchronization is pending"); }
      }
      const current = event.status === "scheduled" ? await this.recipients(event.briefId, manager).getMany() : [];
      const active = new Map(current.map(p => [p.id, p]));
      const repository = manager.getRepository(BriefEventAttendee);
      const existing = await repository.findBy({ eventId: id });
      const existingIds = new Set(existing.map(a => a.participantId));
      for (const attendee of existing) {
        const participant = active.get(attendee.participantId);
        const desired = !!participant;
        if (attendee.active !== desired || attendee.eventRevision !== event.revision || (desired && attendee.email !== participant!.email)) {
          if (attendee.active || desired) attendee.sequence++;
          attendee.active = desired;
          attendee.eventRevision = event.revision;
          if (participant) attendee.email = participant.email;
          await repository.save(attendee);
        }
      }
      for (const participant of current) if (event.endAt.getTime() > Date.now() && !existingIds.has(participant.id)) {
        existing.push(await repository.save({ eventId: id, participantId: participant.id, email: participant.email, active: true, eventRevision: event.revision }));
      }
      for (const attendee of existing) await this.deliver(event, brief, attendee, manager, errors);
      await manager.getRepository(BriefEvent).update(id, { syncError: errors.length ? Array.from(new Set(errors)).join("; ") : null });
    } finally {
      try { if (locked) await runner.query("SELECT pg_advisory_unlock(hashtext($1))", ["brief-event:" + id]); }
      finally { await runner.release(); }
    }
  }

  private async deliver(event: BriefEvent, brief: Brief, attendee: BriefEventAttendee, manager: EntityManager, errors: string[]) {
    const repository = manager.getRepository(BriefEventAttendee);
    const cancelled = !attendee.active || event.status === "cancelled";
    const verb = cancelled ? "Cancelled" : attendee.sequence === 0 ? "Invitation" : "Updated";
    const subject = `${verb}: ${event.title}`;
    const time = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: event.timezone }).format(event.startAt);
    const text = `${brief.organization.name}\nBrief: ${brief.title}\n\n${subject}\n${time} (${event.timezone})\nDuration: ${event.durationMinutes} minutes\n\n${event.description}${cancelled ? "" : `\n\nJoin Zoom: ${event.zoomJoinUrl}`}\n\n${cancelled ? "This event invitation has been cancelled." : "Your team is assigned to this brief. The attached calendar invitation contains the event details."}`;
    const actionUrl = `/participant/briefs/${brief.id}#events`;
    if (attendee.emailSequence < attendee.sequence) {
      try {
        await this.email.sendCalendarInvitation(attendee.email, subject, `<p style="white-space:pre-wrap">${escapeHtml(text)}</p>`, text, this.invitation(event, attendee, brief));
        await repository.update(attendee.id, { emailSequence: attendee.sequence });
      } catch { errors.push("Email invitations are pending"); }
    }
    const notificationId = uuidv5(`${attendee.participantId}:${attendee.sequence}`, event.id);
    if (attendee.notificationSequence < attendee.sequence) {
      try {
        await this.notifications.create({ recipientId: attendee.participantId, recipientType: NotificationRecipientType.PARTICIPANT,
          type: NotificationType.BRIEF_EVENT, title: subject, body: `${brief.organization.name}: ${time} (${event.timezone})`,
          actionUrl, iconName: "calendar", priority: NotificationPriority.HIGH, data: { eventId: event.id, briefId: brief.id } }, { sendPush: false, id: notificationId });
        await repository.update(attendee.id, { notificationSequence: attendee.sequence });
      } catch { errors.push("In-app invitations are pending"); }
    }
    if (attendee.pushSequence < attendee.sequence) {
      try {
        const preferences = await this.notifications.getOrCreatePreferences(attendee.participantId, NotificationRecipientType.PARTICIPANT);
        if (preferences.pushEnabled && preferences.typeSettings?.[NotificationType.BRIEF_EVENT]?.push !== false) {
          if (this.notifications.isInQuietHours(preferences)) return;
          const frontendUrl = this.config.get<string>("FRONTEND_URL", "https://challenge.atf.africa");
          const result = await this.push.sendToExternalUserIds([`participant:${attendee.participantId}`], {
            title: subject, body: `${brief.organization.name}: ${time} (${event.timezone})`, url: `${frontendUrl}${actionUrl}`,
            type: NotificationType.BRIEF_EVENT, priority: NotificationPriority.HIGH, data: { notificationId, eventId: event.id, briefId: brief.id },
          });
          if (!result.success) throw new Error("Push delivery failed");
        }
        await repository.update(attendee.id, { pushSequence: attendee.sequence });
      } catch { errors.push("Push invitations are pending"); }
    }
  }
}
