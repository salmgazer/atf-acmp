import { Processor, WorkerHost } from "@nestjs/bullmq";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Job } from "bullmq";
import { Organization, OrganizationStatus } from "@/database/entities/organization.entity";
import { OrganizationsService } from "./organizations.service";
import { PARTNER_INVITES_QUEUE, PartnerInviteJob } from "./partner-invites.service";
import { PartnerInviteProgress } from "./dto/partner-invites.dto";

@Processor(PARTNER_INVITES_QUEUE, { concurrency: 1 })
export class PartnerInvitesProcessor extends WorkerHost {
  constructor(
    @InjectRepository(Organization) private readonly organizations: Repository<Organization>,
    private readonly service: OrganizationsService,
  ) { super(); }

  async process(job: Job<PartnerInviteJob>): Promise<PartnerInviteProgress> {
    const progress: PartnerInviteProgress = typeof job.progress === "object" ? { ...job.progress as PartnerInviteProgress }
      : { total: job.data.organizationIds.length, processed: 0, sent: 0, failed: 0, skipped: 0, failures: [] };
    for (let index = progress.processed; index < job.data.organizationIds.length; index++) {
      const id = job.data.organizationIds[index];
      const organization = await this.organizations.findOne({ where: { id } });
      if (!organization || organization.status !== OrganizationStatus.APPROVED || !organization.isActive) progress.skipped++;
      else {
        try {
          // Reuse the single-invite eligibility check and current partner email.
          const result = await this.service.sendInvite(id);
          if (!result.success) throw new Error("Email delivery failed");
          progress.sent++;
        } catch {
          const current = await this.organizations.findOne({ where: { id } });
          if (!current || current.status !== OrganizationStatus.APPROVED || !current.isActive) progress.skipped++;
          else {
            progress.failed++;
            if (progress.failures.length < 100) progress.failures.push({ organizationId: id, email: current.email, message: "Email delivery failed" });
          }
        }
      }
      progress.processed++;
      await job.updateProgress({ ...progress, failures: [...progress.failures] });
      if (index < job.data.organizationIds.length - 1) await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return progress;
  }
}
