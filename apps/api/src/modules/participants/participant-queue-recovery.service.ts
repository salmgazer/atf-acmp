import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Interval } from "@nestjs/schedule";
import { Queue } from "bullmq";
import { DataSource, In } from "typeorm";
import { ParticipantInviteBatchRecord } from "@/database/entities/participant-invite-batch.entity";
import { ParticipantImportBatch } from "@/database/entities/participant-import-batch.entity";
import { PARTICIPANT_IMPORT_QUEUE } from "./participant-import.service";
import { ParticipantInviteJob, ParticipantInvitesService, PARTICIPANT_INVITES_QUEUE } from "./participant-invites.service";
import { withParticipantQueueLock } from "./participant-queue-lock";

@Injectable()
export class ParticipantQueueRecoveryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ParticipantQueueRecoveryService.name);
  private reconciling = false;
  constructor(
    private readonly db: DataSource,
    @InjectQueue(PARTICIPANT_INVITES_QUEUE) private readonly inviteQueue: Queue<ParticipantInviteJob>,
    @InjectQueue(PARTICIPANT_IMPORT_QUEUE) private readonly importQueue: Queue<{ batchId: string }>,
    private readonly invites: ParticipantInvitesService,
  ) {}

  onApplicationBootstrap() { void this.reconcile(); }

  @Interval(30000)
  async reconcile() {
    if (this.reconciling) return;
    this.reconciling = true;
    try {
      await withParticipantQueueLock(this.db, "participant-queue-recovery", async manager => {
        // FLUSHDB/replacement also loses BullMQ's global concurrency setting.
        await this.inviteQueue.setGlobalConcurrency(1);
        await this.importQueue.setGlobalConcurrency(1);
        // Adopt pre-upgrade jobs while their Redis checkpoints are still available.
        for (let offset = 0; ; offset += 200) {
          const jobs = await this.inviteQueue.getJobs(["wait", "active", "delayed", "paused"], offset, offset + 199);
          for (const job of jobs) await this.invites.adopt(job);
          if (jobs.length < 200) break;
        }
        for (let offset = 0; ; offset += 200) {
          const batches = await manager.find(ParticipantInviteBatchRecord, { where: { state: In(["queued", "active"]) }, order: { createdAt: "ASC", id: "ASC" }, skip: offset, take: 200 });
          for (const batch of batches) {
            const job = await this.inviteQueue.getJob(batch.id), state = await job?.getState();
            if (job) {
              // A legacy worker may have finished since the startup adoption.
              await this.invites.adopt(job);
              const current = await manager.findOneByOrFail(ParticipantInviteBatchRecord, { id: batch.id });
              if (["completed", "failed"].includes(current.state)) continue;
            }
            if (job && !["completed", "failed", "unknown"].includes(state!)) continue;
            if (job) await job.remove();
            await this.invites.dispatch(batch.id, batch.participantIds, batch.requestedBy);
          }
          if (batches.length < 200) break;
        }
        for (let offset = 0; ; offset += 200) {
          const batches = await manager.getRepository(ParticipantImportBatch).createQueryBuilder("batch")
            .where("batch.state IN ('queued','active') OR (batch.state = 'completed' AND batch.result->>'invitationState' = 'pending')")
            .orderBy("batch.createdAt", "ASC").addOrderBy("batch.id", "ASC").skip(offset).take(200).getMany();
          for (const batch of batches) {
            const job = await this.importQueue.getJob(batch.id), state = await job?.getState();
            if (job && !["completed", "failed", "unknown"].includes(state!)) continue;
            if (job) await job.remove();
            await this.importQueue.add("apply", { batchId: batch.id }, { jobId: batch.id, attempts: 5, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: { age: 86400 }, removeOnFail: { age: 604800 } });
          }
          if (batches.length < 200) break;
        }
      });
    } catch {
      this.logger.warn("Participant queue reconciliation deferred; durable batches remain in PostgreSQL and will retry");
    } finally { this.reconciling = false; }
  }
}
