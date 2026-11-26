import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Interval } from "@nestjs/schedule";
import { Queue } from "bullmq";
import { createHash } from "crypto";
import { DataSource, In } from "typeorm";
import { Participant, ParticipantStatus } from "@/database/entities/participant.entity";
import { Team, TeamMember, TeamMemberStatus } from "@/database/entities/team.entity";
import { BuilderBroadcast } from "@/database/entities/builder-broadcast.entity";
import { EmailService } from "@/email/email.service";
import { BuilderBroadcastDto, BuilderFiltersDto, BuilderQueryDto, BuilderRow } from "./dto/builders.dto";
import { withParticipantQueueLock } from "./participant-queue-lock";

export const BUILDER_BROADCAST_QUEUE = "builder-broadcasts";
const qualified = "p.developmentExperience = true AND p.testingExperience = true AND p.deploymentExperience = true";
const selected = ["id", "participantId", "firstName", "lastName", "email", "country", "group", "cohortId", "preferredLanguage", "otherLanguage", "languageProficiency", "developmentExperience", "testingExperience", "deploymentExperience", "builderConfirm"] as const;

/** The same audience query powers the list, export, preview and send. Proficiency never restricts it. */
@Injectable()
export class BuildersService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BuildersService.name);
  private recovering = false;
  constructor(readonly db: DataSource, @InjectQueue(BUILDER_BROADCAST_QUEUE) private readonly queue: Queue<{ batchId: string }>, private readonly email: EmailService) {}

  query(filters: BuilderFiltersDto) {
    if (filters.group && filters.ungrouped) throw new BadRequestException("Choose a group or ungrouped builders");
    const q = this.db.getRepository(Participant).createQueryBuilder("p")
      .leftJoin("p.preference", "preference")
      .innerJoin("p.cohort", "cohort")
      .leftJoin(TeamMember, "membership", "membership.participantId = p.id AND membership.status = :memberStatus", { memberStatus: TeamMemberStatus.CONFIRMED })
      .leftJoin(Team, "team", "team.id = membership.teamId AND team.cohortId = p.cohortId")
      .where("p.status != :inactive AND p.programmeOptedOut = false", { inactive: ParticipantStatus.INACTIVE })
      .andWhere(`((${qualified}) OR (p.builderConfirm = false AND preference.preferredRole = :role))`, { role: "builder" });
    if (filters.cohortId) q.andWhere("p.cohortId = :cohortId", { cohortId: filters.cohortId });
    if (filters.country) q.andWhere("p.country = :country", { country: filters.country });
    if (filters.group) q.andWhere("p.group = :group", { group: filters.group });
    if (filters.ungrouped) q.andWhere("p.group IS NULL");
    if (filters.confirmation === "confirmed") q.andWhere("p.builderConfirm = true");
    if (filters.confirmation === "pending") q.andWhere("p.builderConfirm = false");
    if (filters.assignment === "assigned") q.andWhere("team.id IS NOT NULL");
    if (filters.assignment === "unassigned") q.andWhere("team.id IS NULL");
    if (filters.search?.trim()) q.andWhere("(p.firstName ILIKE :search OR p.lastName ILIKE :search OR concat(p.firstName, ' ', p.lastName) ILIKE :search OR p.email ILIKE :search OR p.participantId ILIKE :search)", { search: `%${filters.search.trim()}%` });
    return q;
  }

  private rows(filters: BuilderFiltersDto) {
    return this.query(filters).select(selected.map(key => `p.${key} AS "${key}"`))
      .addSelect('cohort.name', 'cohortName').addSelect('preference.preferredRole', 'preferredRole')
      .addSelect('team.id', 'teamId').addSelect('team.name', 'teamName')
      .orderBy("p.firstName", "ASC").addOrderBy("p.lastName", "ASC").addOrderBy("p.id", "ASC");
  }

  async list(filters: BuilderQueryDto) {
    const summary = await this.query(filters).select('COUNT(*)::int', 'total')
      .addSelect('COUNT(*) FILTER (WHERE p.builderConfirm = true)::int', 'confirmed')
      .addSelect('COUNT(*) FILTER (WHERE p.builderConfirm = false)::int', 'pending')
      .addSelect('COUNT(*) FILTER (WHERE team.id IS NOT NULL)::int', 'assigned').getRawOne();
    const data = await this.rows(filters).offset((filters.page - 1) * filters.limit).limit(filters.limit).getRawMany<BuilderRow>();
    return { data, total: summary.total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(summary.total / filters.limit), summary: { ...summary, unassigned: summary.total - summary.assigned } };
  }

  async export(filters: BuilderFiltersDto) {
    const rows = await this.rows(filters).getRawMany<BuilderRow>();
    const cell = (v: unknown) => {
      let value = v == null ? "" : String(v);
      if (/^[\s]*[=+@\-]/.test(value) || /^[\t\r]/.test(value)) value = `'${value}`;
      return `"${value.replace(/"/g, '""')}"`;
    };
    const yesNo = (v: boolean | null) => v == null ? "Not answered" : v ? "Yes" : "No";
    const lines: unknown[][] = [["Participant ID", "First name", "Last name", "Email", "Country", "Cohort", "Group", "Team", "Assignment", "Builder confirmation", "Preferred language", "Proficiency", "Development", "Testing", "Deployment", "Preferred role"]];
    for (const p of rows) lines.push([p.participantId, p.firstName, p.lastName, p.email, p.country, p.cohortName, p.group, p.teamName, p.teamId ? "Assigned" : "Not assigned", p.builderConfirm ? "Confirmed" : "Awaiting confirmation", p.preferredLanguage === "Other" ? p.otherLanguage : p.preferredLanguage, p.languageProficiency, yesNo(p.developmentExperience), yesNo(p.testingExperience), yesNo(p.deploymentExperience), p.preferredRole]);
    return { csv: "\uFEFF" + lines.map(line => line.map(cell).join(",")).join("\r\n"), total: rows.length };
  }

  async audience(filters: BuilderFiltersDto) {
    const recipients = await this.query(filters).select(['p.id AS "id"', 'p.email AS "email"', 'p.firstName AS "firstName"']).orderBy("p.id", "ASC").getRawMany<{ id: string; email: string; firstName: string }>();
    const audienceHash = createHash("sha256").update(JSON.stringify(recipients.map(p => [p.id, p.email]))).digest("hex");
    return { recipients, total: recipients.length, audienceHash };
  }

  async broadcast(dto: BuilderBroadcastDto, requestedBy: string) {
    const repo = this.db.getRepository(BuilderBroadcast);
    const existing = await repo.findOneBy({ id: dto.requestId });
    if (existing) {
      this.assertSameRequest(existing, dto, requestedBy);
      return this.status(existing.id);
    }
    this.email.requireDeliveryConfiguration();
    const audience = await this.audience(dto.filters);
    if (!audience.total) throw new BadRequestException("No builders match these filters");
    if (audience.audienceHash !== dto.audienceHash) throw new ConflictException("The builders list changed. Review the recipient count and try again.");
    await repo.createQueryBuilder().insert().values({ id: dto.requestId, requestedBy, subject: dto.subject, message: dto.message,
      filters: { ...dto.filters }, audienceHash: dto.audienceHash, recipients: audience.recipients, state: "queued",
      progress: { total: audience.total, processed: 0, sent: 0, failed: 0, skipped: 0, failures: [] } }).orIgnore().execute();
    const saved = await repo.findOneByOrFail({ id: dto.requestId });
    this.assertSameRequest(saved, dto, requestedBy);
    void this.dispatch(saved.id).catch(() => this.logger.warn("Builder broadcast saved in PostgreSQL; queue dispatch will retry"));
    return this.status(saved.id);
  }

  private assertSameRequest(batch: BuilderBroadcast, dto: BuilderBroadcastDto, requestedBy: string) {
    if (batch.requestedBy !== requestedBy || batch.subject !== dto.subject || batch.message !== dto.message || batch.audienceHash !== dto.audienceHash)
      throw new ConflictException("This broadcast request ID has already been used. Start a new message.");
  }

  async status(id: string) {
    const batch = await this.db.getRepository(BuilderBroadcast).findOneBy({ id });
    if (!batch) throw new NotFoundException("Builder broadcast not found");
    return { id, state: batch.state, subject: batch.subject, createdAt: batch.createdAt, ...batch.progress };
  }

  dispatch(batchId: string) {
    return this.queue.add("send", { batchId }, { jobId: batchId, attempts: 5, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: { age: 86400 }, removeOnFail: { age: 604800 } });
  }

  onApplicationBootstrap() { void this.recover(); }

  @Interval(30000)
  async recover() {
    if (this.recovering) return;
    this.recovering = true;
    try {
      await withParticipantQueueLock(this.db, "builder-broadcast-recovery", async manager => {
        await this.queue.setGlobalConcurrency(1);
        const batches = await manager.find(BuilderBroadcast, { where: { state: In(["queued", "active"]) }, order: { createdAt: "ASC" } });
        for (const batch of batches) {
          const job = await this.queue.getJob(batch.id), state = await job?.getState();
          if (job && !["completed", "failed", "unknown"].includes(state!)) continue;
          if (job) await job.remove();
          await this.dispatch(batch.id);
        }
      });
    } catch { this.logger.warn("Builder broadcast recovery deferred; messages remain in PostgreSQL"); }
    finally { this.recovering = false; }
  }
}
