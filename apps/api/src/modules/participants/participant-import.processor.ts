import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PARTICIPANT_IMPORT_QUEUE, ParticipantImportService } from "./participant-import.service";

@Processor(PARTICIPANT_IMPORT_QUEUE, { concurrency: 1 })
export class ParticipantImportProcessor extends WorkerHost {
  constructor(private readonly imports: ParticipantImportService) { super(); }
  async process(job: Job<{ batchId: string }>) { await this.imports.process(job.data.batchId); }
}
