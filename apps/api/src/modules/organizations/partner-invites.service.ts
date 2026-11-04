import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { InjectQueue } from "@nestjs/bullmq";
import { Repository } from "typeorm";
import { Queue } from "bullmq";
import { randomUUID } from "crypto";
import { Organization, OrganizationStatus } from "@/database/entities/organization.entity";
import { EmailService } from "@/email/email.service";
import { ResendEligiblePartnerInvitesDto, PartnerInviteBatch, PartnerInviteProgress } from "./dto/partner-invites.dto";

export const PARTNER_INVITES_QUEUE = "partner-invites";
export interface PartnerInviteJob { organizationIds: string[]; requestedBy: string }

@Injectable()
export class PartnerInvitesService implements OnModuleInit {
  constructor(
    @InjectRepository(Organization) private readonly organizations: Repository<Organization>,
    @InjectQueue(PARTNER_INVITES_QUEUE) private readonly queue: Queue<PartnerInviteJob>,
    private readonly email: EmailService,
  ) {}

  async onModuleInit() { await this.queue.setGlobalConcurrency(1); }

  private eligible() {
    return this.organizations.createQueryBuilder("organization").where("organization.status = :approved", { approved: OrganizationStatus.APPROVED }).andWhere("organization.isActive = true");
  }

  async resendSelected(organizationIds: string[], requestedBy: string): Promise<PartnerInviteBatch> {
    const ids = [...new Set(organizationIds)];
    if (!ids.length || ids.length > 500) throw new BadRequestException("Select between 1 and 500 partners");
    const eligible = await this.eligible().andWhere("organization.id IN (:...ids)", { ids }).select("organization.id", "id").getRawMany<{ id: string }>();
    if (eligible.length !== ids.length) throw new BadRequestException("Only approved, active, non-deleted partners can receive an invite. Refresh the list and update your selection.");
    return this.enqueue(eligible.map(organization => organization.id), requestedBy);
  }

  async resendEligible(filters: ResendEligiblePartnerInvitesDto, requestedBy: string): Promise<PartnerInviteBatch> {
    if (filters.status && filters.status !== OrganizationStatus.APPROVED) throw new BadRequestException("No approved, active partners match the current filters");
    const query = this.eligible().andWhere("organization.cohortId = :cohortId", { cohortId: filters.cohortId });
    if (filters.search) query.andWhere("organization.name ILIKE :search", { search: `%${filters.search}%` });
    if (filters.country) query.andWhere("organization.country = :country", { country: filters.country });
    const eligible = await query.select("organization.id", "id").orderBy("organization.id", "ASC").getRawMany<{ id: string }>();
    return this.enqueue(eligible.map(organization => organization.id), requestedBy);
  }

  private async enqueue(organizationIds: string[], requestedBy: string): Promise<PartnerInviteBatch> {
    if (!organizationIds.length) throw new BadRequestException("No approved, active partners match the current filters");
    this.email.requireDeliveryConfiguration();
    const job = await this.queue.add("resend", { organizationIds, requestedBy }, {
      jobId: randomUUID(), attempts: 1,
      removeOnComplete: { age: 86400, count: 1000 }, removeOnFail: { age: 604800, count: 1000 },
    });
    return { id: job.id!, state: "queued", total: organizationIds.length, processed: 0, sent: 0, failed: 0, skipped: 0, failures: [] };
  }

  async status(id: string): Promise<PartnerInviteBatch> {
    const job = await this.queue.getJob(id);
    if (!job) throw new NotFoundException("Partner invitation batch not found or expired");
    const state = await job.getState();
    const progress: PartnerInviteProgress = typeof job.progress === "object" ? job.progress as PartnerInviteProgress
      : { total: job.data.organizationIds.length, processed: 0, sent: 0, failed: 0, skipped: 0, failures: [] };
    return { ...progress, id: job.id!, state: state === "completed" ? "completed" : state === "failed" ? "failed" : state === "active" ? "active" : "queued",
      ...(state === "failed" ? { error: "The invitation batch stopped. Check the results before retrying." } : {}) };
  }
}
