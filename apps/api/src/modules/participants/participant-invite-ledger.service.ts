import { Injectable, NotFoundException } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { ParticipantInviteBatchRecord } from "@/database/entities/participant-invite-batch.entity";
import { ParticipantInviteBatch, ParticipantInviteProgress } from "./dto/participant-invites.dto";

export const emptyInviteProgress = (total: number): ParticipantInviteProgress => ({ total, processed: 0, sent: 0, failed: 0, skipped: 0, failures: [] });

@Injectable()
export class ParticipantInviteLedgerService {
  constructor(readonly db: DataSource) {}

  find(id: string) { return this.db.getRepository(ParticipantInviteBatchRecord).findOneBy({ id }); }

  async record(id: string, participantIds: string[], requestedBy: string, progress = emptyInviteProgress(participantIds.length), state: ParticipantInviteBatchRecord["state"] = "queued") {
    // A deterministic imported batch may already exist after a partial queue outage.
    await this.db.getRepository(ParticipantInviteBatchRecord).createQueryBuilder().insert().values({ id, requestedBy, participantIds, progress, state,
      error: state === "failed" ? "The invitation batch stopped. Check the results before retrying." : null }).orIgnore().execute();
    return this.db.getRepository(ParticipantInviteBatchRecord).findOneByOrFail({ id });
  }

  async checkpoint(manager: EntityManager, id: string, progress: ParticipantInviteProgress) {
    await manager.update(ParticipantInviteBatchRecord, id, { progress, state: progress.processed === progress.total ? "completed" : "active", error: null });
  }

  async status(id: string): Promise<ParticipantInviteBatch> {
    const batch = await this.find(id);
    if (!batch) throw new NotFoundException("Invitation batch not found or expired");
    return { ...batch.progress, id: batch.id, state: batch.state, ...(batch.error ? { error: batch.error } : {}) };
  }
}
