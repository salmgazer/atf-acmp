import "reflect-metadata";
import { randomUUID } from "crypto";
import { DataSource } from "typeorm";
import * as path from "path";
import { ConfigService } from "@nestjs/config";
import { BriefEventsService } from "@/modules/brief-events/brief-events.service";
import { ZoomService } from "@/modules/calendar/zoom.service";
import { NotificationsService } from "@/modules/notifications/notifications.service";
import { Cohort } from "@/database/entities/cohort.entity";
import { Brief, BriefStatus } from "@/database/entities/brief.entity";
import { BriefEvent, BriefEventAttendee } from "@/database/entities/brief-event.entity";
import { Organization, OrganizationStatus, OrganizationUser, OrganizationUserRole } from "@/database/entities/organization.entity";
import { User, Role } from "@/database/entities/user.entity";
import { Participant, ParticipantStatus } from "@/database/entities/participant.entity";
import { Team, TeamMember, TeamMemberStatus, TeamStatus } from "@/database/entities/team.entity";
import { Notification, NotificationPreference, PushToken } from "@/database/entities/notification.entity";

const databaseUrl = process.env.ACMP_TEST_DATABASE_URL;
(databaseUrl ? describe : describe.skip)("Brief events with PostgreSQL", () => {
  let db: DataSource;
  let service: BriefEventsService;
  let cohort: Cohort;
  let org: Organization;
  let brief: Brief;
  let owner: User;
  let zoom: any;
  let email: any;
  let push: any;
  let input: { title: string; description: string; startAt: string; timezone: string; durationMinutes: number };
  let index = 0;
  const runHost = "atf-" + randomUUID();
  const config = new ConfigService({ email: { fromEmail: "invite@example.test" }, FRONTEND_URL: "http://localhost:3000" });
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!/^\/acmp_regression_[a-z0-9_]+_test$/.test(url.pathname) || !["localhost", "127.0.0.1", "postgres"].includes(url.hostname)) throw new Error("A disposable local regression database is required");
    db = new DataSource({ type: "postgres", url: databaseUrl, entities: [path.join(__dirname, "../../src/database/entities/*.entity.ts")], migrations: [path.join(__dirname, "../../src/database/migrations/*.ts")], synchronize: false });
    await db.initialize();
    await db.runMigrations();
  }, 120000);
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });
  beforeEach(async () => {
    index++;
    cohort = await db.getRepository(Cohort).save({ name: "Events " + randomUUID() });
    org = await db.getRepository(Organization).save({ name: "Test partner", email: randomUUID() + "@example.test", cohortId: cohort.id, status: OrganizationStatus.APPROVED, isActive: true });
    owner = await db.getRepository(User).save({ email: org.email, role: Role.ORGANIZATION, firstName: "Org", lastName: "Owner" });
    await db.getRepository(OrganizationUser).save({ organizationId: org.id, userId: owner.id, role: OrganizationUserRole.OWNER });
    brief = await newBrief();
    zoom = { hostId: runHost, isReady: () => true, createMeeting: jest.fn(async () => ({ id: randomUUID(), joinUrl: "https://zoom.us/j/123456789" })), updateMeeting: jest.fn(async () => {}), deleteMeeting: jest.fn(async () => {}), getHostUrl: jest.fn(async () => "https://zoom.us/s/123?zak=host-only-secret") };
    email = { sendCalendarInvitation: jest.fn(async () => {}) };
    push = { sendToExternalUserIds: jest.fn(async () => ({ success: true })) };
    const notifications = new NotificationsService(db.getRepository(Notification), db.getRepository(NotificationPreference), db.getRepository(PushToken), { sendNotification: jest.fn() } as any, push);
    service = new BriefEventsService(db, zoom, email, notifications, push, config);
    jest.spyOn(service as any, "scheduleSync").mockImplementation(() => {});
    input = { title: "Brief discussion", description: "Review the problem and answer team questions", startAt: new Date(Date.now() + (index * 3 + 40) * 86400000).toISOString(), timezone: "Africa/Accra", durationMinutes: 60 };
  });
  async function newBrief() { return db.getRepository(Brief).save({ title: "Test brief", description: "Description", problemStatement: "Problem", expectedOutcomes: "Outcomes", cohortId: cohort.id, organizationId: org.id, status: BriefStatus.APPROVED }); }
  async function person() { return db.getRepository(Participant).save({ participantId: randomUUID(), email: randomUUID() + "@example.test", firstName: "Test", lastName: "Participant", country: "GH", cohortId: cohort.id, status: ParticipantStatus.READY, onboardingComplete: true }); }
  async function team(briefId = brief.id, status = TeamStatus.ACTIVE) { return db.getRepository(Team).save({ name: "Team " + randomUUID(), inviteCode: randomUUID(), cohortId: cohort.id, briefId, status }); }
  async function member(t: Team, p: Participant, status = TeamMemberStatus.CONFIRMED) { return db.getRepository(TeamMember).save({ teamId: t.id, participantId: p.id, status }); }
  const actor = (p: Participant) => ({ id: p.id, email: p.email, role: "participant", cohortId: p.cohortId });

  it("creates a Zoom event and invites only confirmed members of all assigned active teams", async () => {
    const a = await person(), b = await person(), pending = await person(), unrelated = await person(), disqualified = await person();
    await member(await team(), a); await member(await team(), b);
    await member(await team(), pending, TeamMemberStatus.PENDING);
    await member(await team((await newBrief()).id), unrelated);
    await member(await team(brief.id, TeamStatus.DISQUALIFIED), disqualified);
    const event = await service.create(brief.id, input, owner);
    expect(event).toMatchObject({ title: input.title, status: "scheduled", zoomJoinUrl: "https://zoom.us/j/123456789" });
    expect(event).not.toHaveProperty("zoomHostId");
    await service.syncEvent(event.id);
    expect(email.sendCalendarInvitation.mock.calls.map(call => call[0]).sort()).toEqual([a.email, b.email].sort());
    expect(push.sendToExternalUserIds.mock.calls.map(call => call[0][0]).sort()).toEqual([`participant:${a.id}`, `participant:${b.id}`].sort());
    expect(await db.getRepository(Notification).countBy({ recipientId: a.id })).toBe(1);
    expect((await service.list(brief.id, actor(pending))).events).toEqual([]);
    expect((await service.list(brief.id, actor(unrelated))).events).toEqual([]);
    expect((await service.list(brief.id, actor(a))).events[0].id).toBe(event.id);
    await service.syncEvent(event.id);
    expect(email.sendCalendarInvitation).toHaveBeenCalledTimes(2);
    expect(push.sendToExternalUserIds).toHaveBeenCalledTimes(2);
  });
  it("isolates organizations and denies participant writes and read-only organization members", async () => {
    const stranger = await db.getRepository(User).save({ email: randomUUID() + "@example.test", role: Role.ORGANIZATION });
    await expect(service.list(brief.id, stranger)).rejects.toThrow("another organization");
    await expect(service.create(brief.id, input, actor(await person()))).rejects.toThrow();
    await db.getRepository(OrganizationUser).update({ userId: owner.id }, { role: OrganizationUserRole.MEMBER });
    expect((await service.list(brief.id, owner)).canManage).toBe(false);
    await expect(service.create(brief.id, input, owner)).rejects.toThrow("owners and admins");
    await expect(service.create(brief.id, input, { ...owner, role: "viewer" })).rejects.toThrow("program managers");
    expect(zoom.createMeeting).not.toHaveBeenCalled();
  });
  it("reschedules the same calendar invitation and synchronizes the Zoom meeting", async () => {
    const p = await person(); await member(await team(), p);
    const event = await service.create(brief.id, input, owner);
    await service.syncEvent(event.id);
    const updated = await service.update(event.id, { startAt: new Date(Date.parse(input.startAt) + 86400000).toISOString(), description: "New agenda" }, owner);
    expect(updated.revision).toBe(1);
    await service.syncEvent(event.id);
    expect(zoom.updateMeeting).toHaveBeenCalledTimes(1);
    const originalCalendar = email.sendCalendarInvitation.mock.calls[0][4];
    const updatedCalendar = email.sendCalendarInvitation.mock.calls[1][4];
    expect(originalCalendar.content.match(/UID:[^\r]+/)[0]).toBe(updatedCalendar.content.match(/UID:[^\r]+/)[0]);
    expect(updatedCalendar.content).toContain("SEQUENCE:1");
    expect(updatedCalendar.content).toContain("New agenda");
  });
  it("invites newly assigned teams and cancels invitations when participants leave", async () => {
    const old = await person(), fresh = await person();
    await member(await team(), old);
    const event = await service.create(brief.id, input, owner);
    await service.syncEvent(event.id);
    const newTeam = await team((await newBrief()).id); await member(newTeam, fresh);
    await db.getRepository(Team).update(newTeam.id, { briefId: brief.id });
    await db.getRepository(TeamMember).softDelete({ participantId: old.id });
    await service.syncEvent(event.id);
    const calls = email.sendCalendarInvitation.mock.calls;
    expect(calls).toHaveLength(3);
    expect(calls.find(call => call[0] === fresh.email)[4].method).toBe("REQUEST");
    expect(calls.filter(call => call[0] === old.email)[1][4].method).toBe("CANCEL");
    expect((await service.list(brief.id, actor(old))).events).toEqual([]);
    await expect(service.download(event.id, actor(old))).rejects.toThrow();
  });
  it("retries each failed delivery channel without repeating successful email or push deliveries", async () => {
    const p = await person(); await member(await team(), p);
    const event = await service.create(brief.id, input, owner);
    email.sendCalendarInvitation.mockRejectedValueOnce(new Error("Email offline"));
    await service.syncEvent(event.id);
    expect(push.sendToExternalUserIds).toHaveBeenCalledTimes(1);
    expect((await service.list(brief.id, owner)).events[0].deliveryPending).toBe(true);
    await service.syncEvent(event.id);
    expect(email.sendCalendarInvitation).toHaveBeenCalledTimes(2);
    expect(push.sendToExternalUserIds).toHaveBeenCalledTimes(1);
    expect(await db.getRepository(Notification).countBy({ recipientId: p.id })).toBe(1);
    expect((await service.list(brief.id, owner)).events[0].deliveryPending).toBe(false);
  });
  it("retries push independently and honors participant push preferences", async () => {
    const p = await person(); await member(await team(), p);
    const event = await service.create(brief.id, input, owner);
    push.sendToExternalUserIds.mockResolvedValueOnce({ success: false });
    await service.syncEvent(event.id); await service.syncEvent(event.id);
    expect(push.sendToExternalUserIds).toHaveBeenCalledTimes(2);
    expect(email.sendCalendarInvitation).toHaveBeenCalledTimes(1);
    await db.getRepository(NotificationPreference).update({ userId: p.id }, { pushEnabled: false });
    await service.update(event.id, { title: "Updated title" }, owner); await service.syncEvent(event.id);
    expect(push.sendToExternalUserIds).toHaveBeenCalledTimes(2);
    expect(email.sendCalendarInvitation).toHaveBeenCalledTimes(2);
  });
  it("cancels invitations even when Zoom is unavailable, then retries Zoom cancellation", async () => {
    const p = await person(); await member(await team(), p);
    const event = await service.create(brief.id, input, owner); await service.syncEvent(event.id);
    zoom.deleteMeeting.mockRejectedValueOnce(new Error("Zoom unavailable"));
    await service.cancel(event.id, owner); await service.syncEvent(event.id);
    expect(email.sendCalendarInvitation.mock.calls[1][4].method).toBe("CANCEL");
    expect((await service.list(brief.id, owner)).events[0]).toMatchObject({ status: "cancelled", zoomJoinUrl: null, deliveryPending: true });
    await service.syncEvent(event.id);
    expect(zoom.deleteMeeting).toHaveBeenCalledTimes(2);
    expect(email.sendCalendarInvitation).toHaveBeenCalledTimes(2);
    await expect(service.update(event.id, { title: "Reopen" }, owner)).rejects.toThrow("Cancelled events");
  });
  it("prevents concurrent overlapping meetings in the shared host across different briefs", async () => {
    const other = await newBrief();
    const result = await Promise.allSettled([service.create(brief.id, input, owner), service.create(other.id, input, owner)]);
    expect(result.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(zoom.createMeeting).toHaveBeenCalledTimes(1);
    await expect(service.create(brief.id, { ...input, startAt: new Date(Date.parse(input.startAt) + 3600000).toISOString() }, owner)).resolves.toBeDefined();
  });
  it("cleans up the Zoom meeting when database persistence fails", async () => {
    await expect(service.create(brief.id, { ...input, title: "x".repeat(201) }, owner)).rejects.toThrow();
    expect(zoom.deleteMeeting).toHaveBeenCalledTimes(1);
    expect(await db.getRepository(BriefEvent).countBy({ briefId: brief.id })).toBe(0);
  });
  it("rejects invalid dates, offsets and timezones before creating a Zoom meeting", async () => {
    for (const change of [{ startAt: new Date(0).toISOString() }, { startAt: "2030-01-01T12:00:00" }, { timezone: "Invalid/Zone" }, { durationMinutes: 0 }]) {
      await expect(service.create(brief.id, { ...input, ...change }, owner)).rejects.toThrow();
    }
    expect(zoom.createMeeting).not.toHaveBeenCalled();
  });
  it("does not expose Zoom links or invitation downloads to unassigned participants", async () => {
    const event = await service.create(brief.id, input, owner);
    const p = await person();
    expect((await service.list(brief.id, actor(p))).events).toEqual([]);
    await expect(service.download(event.id, actor(p))).rejects.toThrow();
    expect(await db.getRepository(BriefEventAttendee).countBy({ eventId: event.id })).toBe(0);
  });
  it("authorizes a fresh host link for owners only and keeps it out of persisted events and invitations", async () => {
    const p = await person(); await member(await team(), p);
    const event = await service.create(brief.id, input, owner); await service.syncEvent(event.id);
    await expect(service.start(event.id, actor(p))).rejects.toThrow();
    expect(zoom.getHostUrl).not.toHaveBeenCalled();
    expect(await service.start(event.id, owner)).toEqual({ startUrl: "https://zoom.us/s/123?zak=host-only-secret" });
    await service.start(event.id, owner);
    expect(zoom.getHostUrl).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(await db.getRepository(BriefEvent).findOneBy({ id: event.id }))).not.toContain("host-only-secret");
    expect(JSON.stringify(email.sendCalendarInvitation.mock.calls)).not.toContain("host-only-secret");
    expect(JSON.stringify((await service.list(brief.id, actor(p))).events)).not.toContain("host-only-secret");
    await db.getRepository(OrganizationUser).update({ userId: owner.id }, { role: OrganizationUserRole.MEMBER });
    await expect(service.start(event.id, owner)).rejects.toThrow("owners and admins");
  });
  it("defers pushes during quiet hours and delivers them later without repeating email", async () => {
    const p = await person(); await member(await team(), p);
    const event = await service.create(brief.id, input, owner);
    const quiet = jest.spyOn((service as any).notifications, "isInQuietHours").mockReturnValue(true);
    await service.syncEvent(event.id);
    expect(email.sendCalendarInvitation).toHaveBeenCalledTimes(1);
    expect(push.sendToExternalUserIds).not.toHaveBeenCalled();
    expect((await service.list(brief.id, owner)).events[0].deliveryPending).toBe(true);
    quiet.mockRestore(); await service.syncEvent(event.id);
    expect(email.sendCalendarInvitation).toHaveBeenCalledTimes(1);
    expect(push.sendToExternalUserIds).toHaveBeenCalledTimes(1);
  });
  it("avoids duplicate deliveries when two application instances synchronize the same event", async () => {
    const p = await person(); await member(await team(), p);
    const event = await service.create(brief.id, input, owner);
    await Promise.all([service.syncEvent(event.id), service.syncEvent(event.id)]);
    expect(email.sendCalendarInvitation).toHaveBeenCalledTimes(1);
    expect(push.sendToExternalUserIds).toHaveBeenCalledTimes(1);
  });
  it("cancels hosted meetings and invitations when the brief is deleted", async () => {
    const p = await person(); await member(await team(), p);
    const event = await service.create(brief.id, input, owner); await service.syncEvent(event.id);
    await db.getRepository(Brief).softDelete(brief.id);
    await service.syncEvent(event.id);
    expect(zoom.deleteMeeting).toHaveBeenCalledTimes(1);
    expect(email.sendCalendarInvitation.mock.calls[1][4].method).toBe("CANCEL");
    expect((await db.getRepository(BriefEvent).findOneByOrFail({ id: event.id })).status).toBe("cancelled");
  });
  it("keeps scheduling disabled until the shared Zoom account is configured", async () => {
    (service as any).zoom = new ZoomService(new ConfigService());
    expect((await service.list(brief.id, owner)).zoomConfigured).toBe(false);
    await expect(service.create(brief.id, input, owner)).rejects.toThrow("shared ATF Zoom account");
    expect(await db.getRepository(BriefEvent).countBy({ briefId: brief.id })).toBe(0);
  });
});
