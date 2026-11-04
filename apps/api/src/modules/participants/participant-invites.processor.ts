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

@Processor(PARTICIPANT_INVITES_QUEUE, { concurrency: 1 })
export class ParticipantInvitesProcessor extends WorkerHost {
  constructor(
    @InjectRepository(Participant) private readonly participants: Repository<Participant>,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) { super(); }

  async process(job: Job<ParticipantInviteJob>): Promise<ParticipantInviteProgress> {
    const progress: ParticipantInviteProgress = typeof job.progress === "object" ? { ...job.progress as ParticipantInviteProgress }
      : { total: job.data.participantIds.length, processed: 0, sent: 0, failed: 0, skipped: 0, failures: [] };
    const portalUrl = `${this.config.get<string>("FRONTEND_URL", "https://challenge.atf.africa").replace(/\/$/, "")}/participant/login`;
    // Checkpoint each recipient so a restarted worker resumes the batch.
    for (let index = progress.processed; index < job.data.participantIds.length; index++) {
      const id = job.data.participantIds[index];
      const participant = await this.participants.findOne({ where: { id }, relations: ["cohort"] });
      if (!participant || !participant.mustChangePassword || participant.onboardingComplete || participant.status === ParticipantStatus.INACTIVE
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
      await job.updateProgress({ ...progress, failures: [...progress.failures] });
      // One batch globally, with a modest send rate across all API replicas.
      if (index < job.data.participantIds.length - 1) await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return progress;
  }
}
