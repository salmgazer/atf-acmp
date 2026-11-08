import { Processor, WorkerHost } from "@nestjs/bullmq";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Job } from "bullmq";
import { ConfigService } from "@nestjs/config";
import { EmailService } from "@/email/email.service";
import { Participant, ParticipantStatus } from "@/database/entities/participant.entity";
import { CohortStatus } from "@/database/entities/cohort.entity";
import { PARTICIPANT_INVITES_QUEUE, ParticipantInviteJob } from "./participant-invites.service";
import { ParticipantInviteProgress } from "./dto/participant-invites.dto";
import { ParticipantInviteLedgerService, emptyInviteProgress } from "./participant-invite-ledger.service";
import { ParticipantInviteBatchRecord } from "@/database/entities/participant-invite-batch.entity";
import { withParticipantQueueLock } from "./participant-queue-lock";

@Processor(PARTICIPANT_INVITES_QUEUE, { concurrency: 1 })
export class ParticipantInvitesProcessor extends WorkerHost {
  constructor(
    @InjectRepository(Participant) private readonly participants: Repository<Participant>,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly ledger: ParticipantInviteLedgerService,
  ) { super(); }

  async process(job: Job<ParticipantInviteJob>): Promise<ParticipantInviteProgress> {
    // Adopt a pre-upgrade Redis job once; subsequently PostgreSQL is authoritative.
    await this.ledger.record(job.id!, job.data.participantIds, job.data.requestedBy,
      typeof job.progress === "object" ? job.progress as ParticipantInviteProgress : emptyInviteProgress(job.data.participantIds.length));
    return withParticipantQueueLock(this.ledger.db, "participant-invitation-delivery", async manager => {
      const batch = await manager.findOneByOrFail(ParticipantInviteBatchRecord, { id: job.id! });
      const progress = batch.progress;
      if (["completed", "failed"].includes(batch.state)) return progress;
      await manager.update(ParticipantInviteBatchRecord, batch.id, { state: "active", error: null });
      const portalUrl = `${this.config.get<string>("FRONTEND_URL", "https://challenge.atf.africa").replace(/\/$/, "")}/participant/login`;
      // Each recipient is checkpointed in PostgreSQL before advancing, independently of Redis.
      for (let index = progress.processed; index < batch.participantIds.length; index++) {
        // Verify the lock's PostgreSQL session is still alive before another external send.
        await manager.query("SELECT 1");
        const id = batch.participantIds[index];
        const participant = await this.participants.findOne({ where: { id }, relations: ["cohort"] });
        if (!participant || participant.programmeOptedOut || !participant.mustChangePassword || participant.onboardingComplete || participant.status === ParticipantStatus.INACTIVE
          || !participant.cohort || [CohortStatus.DRAFT, CohortStatus.ARCHIVED].includes(participant.cohort.status)) {
          progress.skipped++;
        } else {
          try {
            await this.email.sendParticipantInviteEmail({ to: participant.email, firstName: participant.firstName, participantId: participant.participantId, portalUrl });
            progress.sent++;
          } catch {
            progress.failed++;
            if (progress.failures.length < 100) progress.failures.push({ participantId: participant.participantId, message: "Email delivery failed" });
          }
        }
        progress.processed++;
        await this.ledger.checkpoint(manager, batch.id, { ...progress, failures: [...progress.failures] });
        // One batch globally, with a modest send rate across all API replicas.
        if (index < batch.participantIds.length - 1) await new Promise(resolve => setTimeout(resolve, 1000));
      }
      // Also closes adopted legacy jobs whose final checkpoint preceded Redis completion.
      await this.ledger.checkpoint(manager, batch.id, progress);
      return progress;
    });
  }
}
