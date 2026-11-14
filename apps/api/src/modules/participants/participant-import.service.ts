import { SocketSessionsService } from "@/auth/socket-sessions.service";
import { applyProgrammeOptOut } from "@/common/services/team-rules";
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit, Optional } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { createHash, randomUUID } from "crypto";
import * as bcrypt from "bcrypt";
import { DataSource, EntityManager, In, Raw } from "typeorm";
import { PARTICIPANT_IMPORT_FIELDS, PARTICIPANT_LEARNING_FIELDS } from "@acmp/shared";
import { Participant, ParticipantStatus } from "@/database/entities/participant.entity";
import { ParticipantImportBatch } from "@/database/entities/participant-import-batch.entity";
import { Cohort } from "@/database/entities/cohort.entity";
import { Role, User } from "@/database/entities/user.entity";
import { AuditAction, AuditLog } from "@/database/entities/audit-log.entity";
import { resolveCohortGroup } from "@/common/services/cohort-groups";
import { ApplyParticipantImportDto, ParticipantImportDto } from "./dto/participant-import.dto";
import { ImportValue, canonicalCountry, parseParticipantCsv } from "./participant-import-parser";
import { ParticipantInvitesService } from "./participant-invites.service";
import { withParticipantQueueLock } from "./participant-queue-lock";

export const PARTICIPANT_IMPORT_QUEUE = "participant-imports";
interface Actor { id: string; email?: string; role: string }
export interface ParticipantImportRecord {
  row: number; participantId: string; email?: string; name: string; existingId?: string;
  outcome: "new" | "updated" | "unchanged" | "excluded" | "conflict";
  reason?: string; warnings: string[]; changes: { field: string; before: ImportValue; after: ImportValue }[];
  data: Record<string, ImportValue>; version?: string;
}
// PostgreSQL jsonb does not preserve object-key order. Hash canonical JSON so
// queued input validates identically after it has been stored and read back.
const canonicalJson = (value: unknown): unknown => Array.isArray(value) ? value.map(canonicalJson)
  : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalJson(item)])) : value;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(canonicalJson(value))).digest("hex");

@Injectable()
export class ParticipantImportService implements OnModuleInit {
  private readonly logger = new Logger(ParticipantImportService.name);
  constructor(private readonly db: DataSource, @InjectQueue(PARTICIPANT_IMPORT_QUEUE) private readonly queue: Queue<{ batchId: string }>, private readonly invites: ParticipantInvitesService, @Optional() private readonly socketSessions?: SocketSessionsService) {}
  async onModuleInit() { void this.queue.setGlobalConcurrency(1).catch(() => this.logger.warn("Redis is unavailable; participant imports remain in PostgreSQL")); }
  private authorize(actor: Actor) {
    if (![Role.SUPER_ADMIN, Role.PROGRAM_MANAGER].includes(actor.role as Role)) throw new ForbiddenException("Only program managers can import participants");
  }
  async preview(dto: ParticipantImportDto, actor: Actor) {
    this.authorize(actor);
    return this.db.transaction("REPEATABLE READ", async manager => {
      await manager.query("SET TRANSACTION READ ONLY");
      return this.plan(dto, manager);
    });
  }

  private async plan(dto: ParticipantImportDto, manager: EntityManager) {
    const parsed = parseParticipantCsv(dto.csv), errors = [...parsed.errors];
    const mode = dto.mode || "create_and_update";
    const fields = dto.updateFields || [...PARTICIPANT_LEARNING_FIELDS];
    if (!fields.length || fields.some(field => !(PARTICIPANT_IMPORT_FIELDS as readonly string[]).includes(field))) errors.push("Select supported participant fields only");
    const cohort = await manager.findOneBy(Cohort, { id: dto.cohortId });
    if (!cohort || cohort.status !== "active") errors.push("Choose an active cohort");
    const ids = parsed.rows.map(row => row.participantId).filter(Boolean), emails = parsed.rows.map(row => row.lmsEmail).filter(Boolean) as string[];
    const certificates = parsed.rows.map(row => row.values.learningCertificateId).filter(Boolean) as string[];
    const participants = ids.length ? await manager.find(Participant, { withDeleted: true, where: [
      { participantId: In(ids) },
      ...(emails.length ? [{ email: Raw(alias => `LOWER(${alias}) IN (:...sourceEmails)`, { sourceEmails: emails }) }, { lmsEmail: In(emails) }] : []),
      ...(certificates.length ? [{ learningCertificateId: In(certificates) }] : []),
    ] }) : [];
    const byId = new Map(participants.map(item => [item.participantId, item]));
    const frequencies = (values: string[]) => values.reduce((counts, value) => counts.set(value, (counts.get(value) || 0) + 1), new Map<string, number>());
    const idCounts = frequencies(ids), emailCounts = frequencies(emails), certCounts = frequencies(certificates);
    const records: ParticipantImportRecord[] = parsed.rows.map(row => {
      const existing = byId.get(row.participantId);
      const item: ParticipantImportRecord = { row: row.row, participantId: row.participantId, email: row.lmsEmail, name: [row.values.firstName, row.values.lastName].filter(Boolean).join(" ") || existing?.fullName || row.participantId,
        existingId: existing?.id, version: existing?.updatedAt.toISOString(), outcome: "conflict", warnings: [...row.warnings], changes: [], data: { ...row.values, ...(row.lmsEmail ? { lmsEmail: row.lmsEmail } : {}), ...(row.country ? { country: row.country } : {}) } };
      const reject = (reason: string) => { item.reason = reason; return item; };
      if (row.errors.length) return reject(row.errors.join("; "));
      if ((idCounts.get(row.participantId) || 0) > 1 || (row.lmsEmail && (emailCounts.get(row.lmsEmail) || 0) > 1) || (row.values.learningCertificateId && (certCounts.get(String(row.values.learningCertificateId)) || 0) > 1)) return reject("Duplicate participant ID, LMS email or certificate ID in this file");
      if (existing?.deletedAt) return reject("This participant was deleted; restore the account separately before importing updates");
      if (existing && existing.cohortId !== dto.cohortId) return reject("Participant belongs to another cohort; imports never move accounts");
      const emailOwner = row.lmsEmail ? participants.find(person => (person.email.toLowerCase() === row.lmsEmail || person.lmsEmail?.toLowerCase() === row.lmsEmail) && person.id !== existing?.id) : undefined;
      if (emailOwner) return reject("The LMS email belongs to another participant");
      if (existing && row.lmsEmail && (existing.lmsEmail?.toLowerCase() || existing.email.toLowerCase()) !== row.lmsEmail) return reject("Participant ID and LMS email do not identify the same account; review the identity separately");
      if (!existing && mode === "update_only") { item.outcome = "excluded"; return reject("No existing participant matches; update-only imports never create accounts"); }
      if (existing && mode === "create_only") { item.outcome = "excluded"; return reject("Existing account preserved by create-only mode"); }
      const patch: Record<string, ImportValue> = {};
      if (!existing) {
        if (row.values.programmeOptedOut === true) { item.outcome = "excluded"; return reject("Opted-out participants cannot be admitted to the programme"); }
        if (row.values.learningHalfwayReached !== true) { item.outcome = "excluded"; return reject("New participants must have halfway_reached = Yes"); }
        if (!row.lmsEmail || !row.values.firstName || !row.values.lastName || !row.country) return reject("New accounts require LMS email, first name, last name and country");
        if (cohort?.countries?.length && !cohort.countries.map(canonicalCountry).includes(row.country)) return reject("Country is not enabled in the selected cohort");
        try { patch.group = resolveCohortGroup(cohort || {}, dto.group); }
        catch { return reject("Select a cohort group for new participants"); }
        Object.assign(patch, row.values, { lmsEmail: row.lmsEmail, country: row.country });
      } else {
        for (const field of fields) if (row.values[field] !== undefined) patch[field] = row.values[field]!;
        // Anchor a legacy account to the corroborated LMS identity once, without
        // changing its login address or subsequent participant-entered profile.
        if (!existing.lmsEmail && row.lmsEmail) patch.lmsEmail = row.lmsEmail;
      }
      const previous = (field: string): ImportValue => existing ? ((existing as any)[field] ?? null) : null;
      let correction = false;
      if (existing) {
        correction = ["learningCertificateIssued", "learningFinishedAllLessons", "learningHalfwayReached"].some(field => previous(field) === true && patch[field] === false)
          || ["learningCertificateId", "learningCertificateDate"].some(field => previous(field) && patch[field] !== undefined && patch[field] !== previous(field));
        if (correction && !dto.allowLearningCorrections) return reject("Learning status reversal or certificate correction requires explicit review and permission in the preview options");
        if (correction) item.warnings.push("Reviewed learning correction: affected teams may need an eligibility review");
      }
      // An explicitly reviewed withdrawal clears the associated certificate;
      // ordinary blank cells still never clear data.
      if (patch.learningCertificateIssued === false) {
        if (previous("learningCertificateId") || previous("learningCertificateDate")) item.warnings.push("Setting certificate issued to No clears its previous ID and date");
        patch.learningCertificateId = null; patch.learningCertificateDate = null;
      }
      const final = { ...existing, ...patch };
      if (final.learningCertificateIssued === true && !final.learningCertificateId) return reject("A learning certificate marked Yes requires a certificate ID");
      if (final.learningCertificateIssued !== true && (final.learningCertificateId || final.learningCertificateDate)) return reject("Include certificate = Yes when providing a certificate ID or date");
      if (final.learningCertificateId && participants.some(person => person.id !== existing?.id && person.learningCertificateId === final.learningCertificateId)) return reject("Learning certificate ID belongs to another participant");
      if (existing && row.country && row.country !== existing.country) item.warnings.push("Country was preserved; imports do not change an existing account's country");
      item.changes = Object.entries(patch).filter(([field, value]) => previous(field) !== value).map(([field, value]) => ({ field, before: previous(field), after: value }));
      item.outcome = existing ? item.changes.length ? "updated" : "unchanged" : "new";
      return item;
    });
    const counts = Object.fromEntries(["new", "updated", "unchanged", "excluded", "conflict"].map(outcome => [outcome, records.filter(row => row.outcome === outcome).length])) as Record<ParticipantImportRecord["outcome"], number>;
    const previewHash = digest({ input: { ...dto, previewHash: undefined, updateFields: [...fields].sort(), mode }, records });
    return { ready: !errors.length && !counts.conflict && counts.new + counts.updated + counts.unchanged > 0, previewHash, sourceName: dto.sourceName, total: records.length, counts, records, errors, warnings: parsed.warnings };
  }

  async enqueue(dto: ApplyParticipantImportDto, actor: Actor) {
    const preview = await this.preview(dto, actor);
    if (!preview.ready) throw new BadRequestException("Resolve the preview errors before importing");
    if (preview.previewHash !== dto.previewHash) throw new ConflictException("The source or participant records changed. Refresh the preview before importing");
    const batch = await this.db.getRepository(ParticipantImportBatch).save({ id: randomUUID(), cohortId: dto.cohortId, requestedBy: actor.id, sourceName: dto.sourceName, input: { ...dto }, state: "queued", result: { stage: "queued", total: preview.total } });
    void this.queue.add("apply", { batchId: batch.id }, { jobId: batch.id, attempts: 5, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: { age: 86400 }, removeOnFail: { age: 604800 } })
      .catch(() => this.logger.warn("Participant import saved; Redis dispatch will retry"));
    return this.status(batch.id, actor);
  }

  async status(id: string, actor: Actor) {
    this.authorize(actor);
    const batch = await this.db.getRepository(ParticipantImportBatch).findOneBy({ id });
    if (!batch) throw new NotFoundException("Import batch not found");
    return { id: batch.id, state: batch.state === "completed" && batch.result.invitationState === "pending" ? "active" : batch.state, sourceName: batch.sourceName, cohortId: batch.cohortId, result: batch.result, error: batch.error, createdAt: batch.createdAt };
  }

  async process(batchId: string) {
    return withParticipantQueueLock(this.db, `participant-import:${batchId}`, () => this.processBatch(batchId));
  }

  private async processBatch(batchId: string) {
    const batches = this.db.getRepository(ParticipantImportBatch);
    const batch = await batches.findOne({ where: { id: batchId }, select: { id: true, requestedBy: true, cohortId: true, sourceName: true, input: true, state: true, result: true } });
    if (!batch || batch.state === "failed") return;
    const dto = batch.input as unknown as ApplyParticipantImportDto;
    let applied = batch.state === "completed";
    try {
      const actor = await this.db.getRepository(User).findOneBy({ id: batch.requestedBy, isActive: true });
      if (!actor) throw new ForbiddenException("The importing staff account is no longer active");
      this.authorize(actor);
      if (batch.state !== "completed") {
        await batches.update(batchId, { state: "active", result: { stage: "validating" } as any });
        const initial = await this.preview(dto, actor);
        if (!initial.ready || initial.previewHash !== dto.previewHash) throw new ConflictException("The source or participant records changed. Refresh the preview before importing");
        const newRows = initial.records.filter(row => row.outcome === "new"), hashes = new Map<string, string>();
        for (let offset = 0; offset < newRows.length; offset += 4) {
          await Promise.all(newRows.slice(offset, offset + 4).map(async row => hashes.set(row.participantId, await bcrypt.hash(row.participantId, 10))));
          if (offset % 100 === 0 || offset + 4 >= newRows.length) await batches.update(batchId, { result: { stage: "preparing credentials", prepared: Math.min(offset + 4, newRows.length), totalNew: newRows.length } as any });
        }
        batch.result = await this.db.transaction("SERIALIZABLE", async manager => {
          await manager.query("SELECT pg_advisory_xact_lock(hashtext('participant-learning-import'))");
          const plan = await this.plan(dto, manager);
          if (!plan.ready || plan.previewHash !== dto.previewHash) throw new ConflictException("Participant records changed while preparing the import. Refresh the preview");
          const newIds: string[] = [], affectedTeamIds = new Set<string>();
          for (const row of plan.records) {
            if (!["new", "updated"].includes(row.outcome)) continue;
            const patch: Record<string, any> = Object.fromEntries(row.changes.map(change => [change.field, change.after]));
            const learningChanged = row.outcome === "new" || row.changes.some(change => (PARTICIPANT_LEARNING_FIELDS as readonly string[]).includes(change.field));
            if (learningChanged) patch.learningImportedAt = new Date();
            if (patch.programmeOptedOut !== undefined) patch.programmeOptedOutAt = patch.programmeOptedOut ? new Date() : null;
            if (patch.codeLabsCompleted !== undefined) { patch.codeLabsVerifiedAt = patch.codeLabsCompleted ? new Date() : null; patch.codeLabsVerifiedBy = patch.codeLabsCompleted ? actor.id : null; }
            if (row.outcome === "new") {
              const participant = await manager.save(Participant, manager.create(Participant, { ...patch, participantId: row.participantId, email: row.email!, passwordHash: hashes.get(row.participantId), status: ParticipantStatus.IMPORTED, cohortId: dto.cohortId, skills: [], interests: [], mustChangePassword: true, onboardingComplete: false }));
              newIds.push(participant.id);
            } else {
              await manager.update(Participant, row.existingId!, patch);
              if (patch.programmeOptedOut === true) for (const teamId of await applyProgrammeOptOut(manager, row.existingId!)) affectedTeamIds.add(teamId);
              if (learningChanged) for (const membership of await manager.getRepository("TeamMember").find({ where: { participantId: row.existingId } })) affectedTeamIds.add(membership.teamId);
            }
          }
          const result = { stage: "completed", counts: plan.counts, total: plan.total, records: plan.records, newIds, optedOutIds: plan.records.filter(row => row.outcome === "updated" && row.changes.some(change => change.field === "programmeOptedOut" && change.after === true)).map(row => row.existingId!), affectedTeamIds: [...affectedTeamIds], invitationState: dto.sendWelcomeEmail && newIds.length ? "pending" : "not_requested", inviteBatches: [] as string[], invitationWarning: null as string | null };
          await manager.update(ParticipantImportBatch, batchId, { state: "completed", result: result as any, error: null });
          await manager.save(AuditLog, manager.create(AuditLog, { actorId: actor.id, actorEmail: actor.email, action: AuditAction.BULK_IMPORT, entityType: "ParticipantImportBatch", entityId: batchId, description: `Imported participants: ${plan.counts.new} created, ${plan.counts.updated} updated`, after: { counts: plan.counts, affectedTeamIds: result.affectedTeamIds } }));
          return result;
        });
        applied = true;
      }
      for (const id of batch.result.optedOutIds || []) this.socketSessions?.revokePrincipal(id);
      if (batch.result.invitationState === "pending") {
        try {
          batch.result.inviteBatches = await this.invites.inviteImported(batch.result.newIds, batch.requestedBy, batchId);
          batch.result.invitationState = "queued";
        } catch { batch.result.invitationState = "failed"; batch.result.invitationWarning = "Participants were imported, but invitations could not be queued. Use Resend invite after checking email configuration."; }
        await batches.update(batchId, { result: batch.result });
      }
    } catch (error) {
      if (applied) {
        batch.result.invitationState = "failed";
        batch.result.invitationWarning = "Participants were imported; invitation delivery needs staff review.";
        await batches.update(batchId, { state: "completed", result: batch.result });
      } else await batches.update(batchId, { state: "failed", error: error instanceof ConflictException || error instanceof ForbiddenException ? error.message : "The import was rolled back. Refresh the preview and review conflicts before retrying.", result: { stage: "failed" } as any });
    }
  }
}
