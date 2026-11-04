import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { InjectQueue } from "@nestjs/bullmq";
import { Repository } from "typeorm";
import { Queue } from "bullmq";
import { randomUUID } from "crypto";
import { Participant, ParticipantStatus } from "@/database/entities/participant.entity";
import { CohortStatus } from "@/database/entities/cohort.entity";
import { EmailService } from "@/email/email.service";
import { ResendPendingParticipantInvitesDto, ParticipantInviteBatch, ParticipantInviteProgress } from "./dto/participant-invites.dto";

export const PARTICIPANT_INVITES_QUEUE = "participant-invites";
export interface ParticipantInviteJob { participantIds: string[]; requestedBy: string }

@Injectable()
export class ParticipantInvitesService implements OnModuleInit {
  constructor(
    @InjectRepository(Participant) private readonly participants: Repository<Participant>,
    @InjectQueue(PARTICIPANT_INVITES_QUEUE) private readonly queue: Queue<ParticipantInviteJob>,
    private readonly email: EmailService,
  ) {}

  async onModuleInit() { await this.queue.setGlobalConcurrency(1); }

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

  private async enqueue(participantIds: string[], requestedBy: string): Promise<ParticipantInviteBatch> {
    if (!participantIds.length) throw new BadRequestException("No pending participants match the current filters");
    this.email.requireDeliveryConfiguration();
    const job = await this.queue.add("resend", { participantIds, requestedBy }, {
      jobId: randomUUID(),
      attempts: 1,
      removeOnComplete: { age: 86400, count: 1000 },
      removeOnFail: { age: 604800, count: 1000 },
    });
    return { id: job.id!, state: "queued", total: participantIds.length, processed: 0, sent: 0, failed: 0, skipped: 0, failures: [] };
  }

  async status(id: string): Promise<ParticipantInviteBatch> {
    const job = await this.queue.getJob(id);
    if (!job) throw new NotFoundException("Invitation batch not found or expired");
    const state = await job.getState();
    const progress: ParticipantInviteProgress = typeof job.progress === "object" ? job.progress as ParticipantInviteProgress
      : { total: job.data.participantIds.length, processed: 0, sent: 0, failed: 0, skipped: 0, failures: [] };
    return { ...progress, id: job.id!, state: state === "completed" ? "completed" : state === "failed" ? "failed" : state === "active" ? "active" : "queued",
      ...(state === "failed" ? { error: "The invitation batch stopped. Check the results before retrying." } : {}) };
  }
}
