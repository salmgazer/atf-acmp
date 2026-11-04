import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { InjectQueue } from "@nestjs/bullmq";
import { Repository } from "typeorm";
import { Queue } from "bullmq";
import { randomUUID } from "crypto";
import { Mentor, MentorAssignment, MentorStatus } from "@/database/entities/mentor.entity";
import { EmailService } from "@/email/email.service";
import { ResendImportedMentorInvitesDto, MentorInviteBatch, MentorInviteProgress } from "./dto/mentor-invites.dto";

export const MENTOR_INVITES_QUEUE = "mentor-invites";
export interface MentorInviteJob { mentorIds: string[]; requestedBy: string }

@Injectable()
export class MentorInvitesService implements OnModuleInit {
  constructor(
    @InjectRepository(Mentor) private readonly mentors: Repository<Mentor>,
    @InjectQueue(MENTOR_INVITES_QUEUE) private readonly queue: Queue<MentorInviteJob>,
    private readonly email: EmailService,
  ) {}

  async onModuleInit() { await this.queue.setGlobalConcurrency(1); }

  private eligible() {
    return this.mentors.createQueryBuilder("mentor").where("mentor.status = :imported", { imported: MentorStatus.IMPORTED });
  }

  async resendSelected(mentorIds: string[], requestedBy: string): Promise<MentorInviteBatch> {
    const ids = [...new Set(mentorIds)];
    if (!ids.length || ids.length > 500) throw new BadRequestException("Select between 1 and 500 mentors");
    const imported = await this.eligible().andWhere("mentor.id IN (:...ids)", { ids }).select("mentor.id", "id").getRawMany<{ id: string }>();
    if (imported.length !== ids.length) throw new BadRequestException("Only imported, non-deleted mentors can receive an invite. Refresh the list and update your selection.");
    return this.enqueue(imported.map(mentor => mentor.id), requestedBy);
  }

  async resendImported(filters: ResendImportedMentorInvitesDto, requestedBy: string): Promise<MentorInviteBatch> {
    if (filters.deleted || (filters.status && filters.status !== MentorStatus.IMPORTED)) throw new BadRequestException("No imported mentors match the current filters");
    const query = this.eligible().andWhere("mentor.cohortId = :cohortId", { cohortId: filters.cohortId });
    if (filters.search) query.andWhere("(mentor.firstName ILIKE :search OR mentor.lastName ILIKE :search OR mentor.email ILIKE :search OR mentor.company ILIKE :search)", { search: `%${filters.search}%` });
    if (filters.hasCapacity !== undefined) {
      const assignments = query.subQuery().select("COUNT(*)").from(MentorAssignment, "ma")
        .where("ma.mentorId = mentor.id").andWhere("ma.isActive = true").getQuery();
      query.andWhere(`(${assignments}) ${filters.hasCapacity ? "<" : ">="} mentor.maxTeams`);
    }
    const imported = await query.select("mentor.id", "id").orderBy("mentor.id", "ASC").getRawMany<{ id: string }>();
    return this.enqueue(imported.map(mentor => mentor.id), requestedBy);
  }

  private async enqueue(mentorIds: string[], requestedBy: string): Promise<MentorInviteBatch> {
    if (!mentorIds.length) throw new BadRequestException("No imported mentors match the current filters");
    this.email.requireDeliveryConfiguration();
    const job = await this.queue.add("resend", { mentorIds, requestedBy }, {
      jobId: randomUUID(), attempts: 1,
      removeOnComplete: { age: 86400, count: 1000 }, removeOnFail: { age: 604800, count: 1000 },
    });
    return { id: job.id!, state: "queued", total: mentorIds.length, processed: 0, sent: 0, failed: 0, skipped: 0, failures: [] };
  }

  async status(id: string): Promise<MentorInviteBatch> {
    const job = await this.queue.getJob(id);
    if (!job) throw new NotFoundException("Mentor invitation batch not found or expired");
    const state = await job.getState();
    const progress: MentorInviteProgress = typeof job.progress === "object" ? job.progress as MentorInviteProgress
      : { total: job.data.mentorIds.length, processed: 0, sent: 0, failed: 0, skipped: 0, failures: [] };
    return { ...progress, id: job.id!, state: state === "completed" ? "completed" : state === "failed" ? "failed" : state === "active" ? "active" : "queued",
      ...(state === "failed" ? { error: "The invitation batch stopped. Check the results before retrying." } : {}) };
  }
}
