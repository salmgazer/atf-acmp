import { Processor, WorkerHost } from "@nestjs/bullmq";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Job } from "bullmq";
import { Mentor, MentorStatus } from "@/database/entities/mentor.entity";
import { MentorsService } from "./mentors.service";
import { MENTOR_INVITES_QUEUE, MentorInviteJob } from "./mentor-invites.service";
import { MentorInviteProgress } from "./dto/mentor-invites.dto";

@Processor(MENTOR_INVITES_QUEUE, { concurrency: 1 })
export class MentorInvitesProcessor extends WorkerHost {
  constructor(
    @InjectRepository(Mentor) private readonly mentors: Repository<Mentor>,
    private readonly service: MentorsService,
  ) { super(); }

  async process(job: Job<MentorInviteJob>): Promise<MentorInviteProgress> {
    const progress: MentorInviteProgress = typeof job.progress === "object" ? { ...job.progress as MentorInviteProgress }
      : { total: job.data.mentorIds.length, processed: 0, sent: 0, failed: 0, skipped: 0, failures: [] };
    for (let index = progress.processed; index < job.data.mentorIds.length; index++) {
      const id = job.data.mentorIds[index];
      const mentor = await this.mentors.findOne({ where: { id } });
      if (!mentor || mentor.status !== MentorStatus.IMPORTED) progress.skipped++;
      else {
        try {
          // The existing single-resend service uses the current email and validates the login account.
          await this.service.resendInvite(id);
          progress.sent++;
        } catch {
          const current = await this.mentors.findOne({ where: { id } });
          if (!current || current.status !== MentorStatus.IMPORTED) progress.skipped++;
          else {
            progress.failed++;
            if (progress.failures.length < 100) progress.failures.push({ mentorId: id, email: current.email, message: "Email delivery failed" });
          }
        }
      }
      progress.processed++;
      await job.updateProgress({ ...progress, failures: [...progress.failures] });
      if (index < job.data.mentorIds.length - 1) await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return progress;
  }
}
