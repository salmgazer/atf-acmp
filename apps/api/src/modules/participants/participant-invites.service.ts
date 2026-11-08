import { BadRequestException, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { InjectQueue } from "@nestjs/bullmq";
import { Repository } from "typeorm";
import { Queue } from "bullmq";
import { randomUUID } from "crypto";
import { Participant, ParticipantStatus } from "@/database/entities/participant.entity";
import { CohortStatus } from "@/database/entities/cohort.entity";
import { EmailService } from "@/email/email.service";
import { ResendPendingParticipantInvitesDto, ParticipantInviteBatch, ParticipantInviteProgress } from "./dto/participant-invites.dto";
import { ParticipantInviteLedgerService, emptyInviteProgress } from "./participant-invite-ledger.service";

export const PARTICIPANT_INVITES_QUEUE = "participant-invites";
export interface ParticipantInviteJob { participantIds: string[]; requestedBy: string }

@Injectable()
export class ParticipantInvitesService implements OnModuleInit {
  private readonly logger = new Logger(ParticipantInvitesService.name);
  constructor(
    @InjectRepository(Participant) private readonly participants: Repository<Participant>,
    @InjectQueue(PARTICIPANT_INVITES_QUEUE) private readonly queue: Queue<ParticipantInviteJob>,
    private readonly email: EmailService,
    private readonly ledger: ParticipantInviteLedgerService,
  ) {}

  async onModuleInit() { void this.queue.setGlobalConcurrency(1).catch(() => this.logger.warn("Redis is unavailable; participant invitation batches remain in PostgreSQL")); }

  private eligible() {
    return this.participants.createQueryBuilder("p")
      .innerJoin("p.cohort", "cohort")
      .where("p.mustChangePassword = :initialPassword", { initialPassword: true })
      .andWhere("p.onboardingComplete = :complete", { complete: false })
      .andWhere("p.status != :inactive", { inactive: ParticipantStatus.INACTIVE })
      .andWhere("cohort.status NOT IN (:...blocked)", { blocked: [CohortStatus.DRAFT, CohortStatus.ARCHIVED] });
  }

  async resendSelected(participantIds: string[], requestedBy: string): Promise<ParticipantInviteBatch> {
    const ids = [...new Set(participantIds)];
    if (!ids.length || ids.length > 500) throw new BadRequestException("Select between 1 and 500 participants");
    const pending = await this.eligible().andWhere("p.id IN (:...ids)", { ids }).select("p.id", "id").getRawMany<{ id: string }>();
    if (pending.length !== ids.length) throw new BadRequestException("Only active participants who have not changed their initial password can receive an invite. Refresh the list and update your selection.");
    return this.enqueue(pending.map(p => p.id), requestedBy);
  }

  async resendPending(filters: ResendPendingParticipantInvitesDto, requestedBy: string): Promise<ParticipantInviteBatch> {
    if (filters.group && filters.ungrouped) throw new BadRequestException("Choose a group or ungrouped participants");
    const query = this.eligible().andWhere("p.cohortId = :cohortId", { cohortId: filters.cohortId });
    if (filters.group) query.andWhere("p.group = :group", { group: filters.group });
    if (filters.ungrouped) query.andWhere("p.group IS NULL");
    if (filters.status) query.andWhere("p.status = :status", { status: filters.status });
    if (filters.search) query.andWhere("(p.firstName ILIKE :search OR p.lastName ILIKE :search OR p.email ILIKE :search OR p.participantId ILIKE :search)", { search: `%${filters.search}%` });
    const pending = await query.select("p.id", "id").orderBy("p.id", "ASC").getRawMany<{ id: string }>();
    return this.enqueue(pending.map(p => p.id), requestedBy);
  }

  async inviteImported(participantIds: string[], requestedBy: string, batchId: string): Promise<string[]> {
    const batches: string[] = [];
    for (let offset = 0; offset < participantIds.length; offset += 500) {
      const ids = participantIds.slice(offset, offset + 500);
      const eligible = await this.eligible().andWhere("p.id IN (:...ids)", { ids }).select("p.id", "id").getRawMany<{ id: string }>();
      if (!eligible.length) continue;
      const job = await this.enqueue(eligible.map(person => person.id), requestedBy, `import-${batchId}-${offset}`);
      batches.push(job.id);
    }
    return batches;
  }

  private async enqueue(participantIds: string[], requestedBy: string, jobId: string = randomUUID()): Promise<ParticipantInviteBatch> {
    if (!participantIds.length) throw new BadRequestException("No pending participants match the current filters");
    this.email.requireDeliveryConfiguration();
    const batch = await this.ledger.record(jobId, participantIds, requestedBy);
    // PostgreSQL accepts the batch even if Redis is unavailable. Recovery republishes it.
    if (!["completed", "failed"].includes(batch.state)) void this.dispatch(batch.id, batch.participantIds, batch.requestedBy).catch(() => this.logger.warn("Invitation batch saved; Redis dispatch will retry"));
    return this.ledger.status(batch.id);
  }

  async dispatch(jobId: string, participantIds: string[], requestedBy: string) {
    await this.queue.add("resend", { participantIds, requestedBy }, {
      jobId, attempts: 5, backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 86400, count: 1000 },
      removeOnFail: { age: 604800, count: 1000 },
    });
  }

  async status(id: string): Promise<ParticipantInviteBatch> {
    if (await this.ledger.find(id)) return this.ledger.status(id);
    // Adopt pre-upgrade Redis batches without replaying their completed recipients.
    const job = await this.queue.getJob(id);
    if (job) await this.adopt(job);
    return this.ledger.status(id);
  }

  async adopt(job: import("bullmq").Job<ParticipantInviteJob>) {
    const state = await job.getState();
    const progress: ParticipantInviteProgress = typeof job.progress === "object" ? job.progress as ParticipantInviteProgress
      : emptyInviteProgress(job.data.participantIds.length);
    await this.ledger.record(job.id!, job.data.participantIds, job.data.requestedBy, progress, state === "completed" || progress.processed === progress.total ? "completed" : state === "failed" ? "failed" : "queued");
  }
}
