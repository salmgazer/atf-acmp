import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { DataSource } from "typeorm";
import { BuilderBroadcast } from "@/database/entities/builder-broadcast.entity";
import { EmailService } from "@/email/email.service";
import { BuildersService, BUILDER_BROADCAST_QUEUE } from "./builders.service";
import { withParticipantQueueLock } from "./participant-queue-lock";

@Processor(BUILDER_BROADCAST_QUEUE, { concurrency: 1 })
export class BuilderBroadcastProcessor extends WorkerHost {
  constructor(private readonly db: DataSource, private readonly builders: BuildersService, private readonly email: EmailService) { super(); }

  async process(job: Job<{ batchId: string }>) {
    return withParticipantQueueLock(this.db, "builder-broadcast-delivery", async manager => {
      const batch = await manager.findOneByOrFail(BuilderBroadcast, { id: job.data.batchId });
      if (["completed", "failed"].includes(batch.state)) return batch.progress;
      await manager.update(BuilderBroadcast, batch.id, { state: "active" });
      const progress = batch.progress;
      for (let i = progress.processed; i < batch.recipients.length; i++) {
        await manager.query("SELECT 1");
        const recipient = batch.recipients[i];
        // Never send to opted-out/deactivated/deleted builders, changed addresses,
        // or participants who no longer match the reviewed audience filters.
        const current = await this.builders.query(batch.filters).andWhere("p.id = :recipientId AND p.email = :recipientEmail", { recipientId: recipient.id, recipientEmail: recipient.email }).select('p.participantId', 'participantId').getRawOne<{ participantId: string }>();
        if (!current) progress.skipped++;
        else {
          try {
            await this.email.sendBuilderBroadcastEmail({ to: recipient.email, firstName: recipient.firstName, subject: batch.subject, message: batch.message });
            progress.sent++;
          } catch {
            progress.failed++;
            if (progress.failures.length < 100) progress.failures.push({ participantId: current.participantId, message: "Email delivery failed" });
          }
        }
        progress.processed++;
        await manager.update(BuilderBroadcast, batch.id, { progress, state: progress.processed === progress.total ? "completed" : "active" });
        if (i < batch.recipients.length - 1) await new Promise(resolve => setTimeout(resolve, 1000));
      }
      return progress;
    });
  }
}
