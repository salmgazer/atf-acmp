import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { DataSource, EntityManager, In } from "typeorm";
import { randomUUID } from "crypto";
import { Cohort } from "@/database/entities/cohort.entity";
import { Organization, OrganizationStatus, OrganizationUser } from "@/database/entities/organization.entity";
import { Brief, BriefStatus } from "@/database/entities/brief.entity";
import { User, Role } from "@/database/entities/user.entity";
import { PartnerImportRecord } from "@/database/entities/partner-import-record.entity";
import { AuditAction, AuditLog } from "@/database/entities/audit-log.entity";
import { ensurePartnerContactLogin, saveBriefContacts } from "@/common/services/brief-contacts";
import { SubmissionImportDto, ApplySubmissionImportDto } from "./dto/submission-import.dto";
import { ImportIssue, organizationKey, ParsedSubmission, parseSubmissionCsv, sourceHash } from "./submission-import-parser";

interface ImportActor { id: string; email?: string; role: string }
export interface OrganizationPlan {
  key: string; name: string; country: string; organizationId?: string; primaryEmail: string;
  primaryCandidates: { email: string; name: string }[]; rows: number[]; newBriefs: number; skippedBriefs: number;
}
export interface ImportBriefPreview {
  row: number; title: string; partner: string; submittedAt: string; status: "new" | "skipped";
  submitter: { name: string; email: string }; host: { name: string; email: string; source: "brief" | "partner" };
  fitScore: number; impactScore: number | null;
}

@Injectable()
export class SubmissionImportService {
  constructor(private readonly db: DataSource) {}

  private authorize(actor: ImportActor) {
    if (![Role.SUPER_ADMIN, Role.PROGRAM_MANAGER].includes(actor.role as Role)) throw new ForbiddenException("Only program managers can import partner submissions");
  }

  async preview(dto: SubmissionImportDto, actor: ImportActor) {
    this.authorize(actor);
    return this.db.transaction("REPEATABLE READ", async manager => {
      await manager.query("SET TRANSACTION READ ONLY");
      return (await this.plan(dto, manager)).preview;
    });
  }

  private async plan(dto: SubmissionImportDto, manager: EntityManager) {
    const parsed = await parseSubmissionCsv(dto.csv, dto.sourceTimezone);
    const errors: ImportIssue[] = [...parsed.errors], warnings: ImportIssue[] = [...parsed.warnings];
    const cohort = await manager.findOneBy(Cohort, { id: dto.cohortId });
    if (!cohort || cohort.status !== "active") errors.push({ message: "Choose an active cohort" });
    for (const country of new Set(parsed.rows.map(row => row.org.country))) if (cohort?.countries?.length && !cohort.countries.includes(country)) errors.push({ message: `${country} is not enabled in this cohort` });
    const organizations: OrganizationPlan[] = [];
    const preview = { ready: false, previewHash: "", sourceName: dto.sourceName, cohortId: dto.cohortId, sourceTimezone: dto.sourceTimezone,
      totalBriefs: parsed.rows.length, newPartners: 0, newUsers: 0, newBriefs: 0, skippedBriefs: 0, organizations, briefs: [] as ImportBriefPreview[], errors, warnings };
    if (errors.length) return { preview, rows: parsed.rows, skipped: new Set<string>() };

    const partners = await manager.find(Organization, { withDeleted: true });
    const receipts = await manager.find(PartnerImportRecord, { where: { cohortId: dto.cohortId, sessionId: In([...new Set(parsed.rows.map(row => row.sessionId))]) }, withDeleted: true });
    const existingBriefs = await manager.find(Brief, { where: [{ sessionId: In([...new Set(parsed.rows.map(row => row.sessionId))]) }, ...partners.filter(partner => partner.cohortId === dto.cohortId).map(partner => ({ organizationId: partner.id }))], withDeleted: true });
    const grouped = new Map<string, ParsedSubmission[]>();
    for (const row of parsed.rows) grouped.set(row.organizationKey, [...(grouped.get(row.organizationKey) || []), row]);
    if (Object.keys(dto.primaryContacts || {}).some(key => !grouped.has(key)) || Object.values(dto.primaryContacts || {}).some(value => typeof value !== "string")) errors.push({ message: "Partner contact selections are invalid" });
    const emailGroups = new Map<string, string>(), skipped = new Set<string>();
    for (const [key, rows] of grouped) {
      const matches = partners.filter(partner => organizationKey(partner.country || "", partner.name) === key);
      const existing = matches[0];
      if (matches.length > 1 || existing?.deletedAt || (existing && existing.cohortId !== dto.cohortId)) errors.push({ row: rows[0].row, message: "Partner name matches a deleted, ambiguous or different-cohort record; resolve it before importing" });
      const candidates = [...new Map(rows.map(row => [row.org.email, { email: row.org.email, name: row.org.contactName }])).values()];
      const first = [...rows].sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime() || a.row - b.row)[0];
      const selected = dto.primaryContacts?.[key]?.trim().toLowerCase();
      const primaryEmail = existing?.email.toLowerCase() || selected || first.org.email;
      if (selected && (existing ? selected !== existing.email.toLowerCase() : !candidates.some(candidate => candidate.email === selected))) errors.push({ row: rows[0].row, message: "Choose a partner main contact from this organization's submitters; existing partner contacts cannot be overwritten by import" });
      const item: OrganizationPlan = { key, name: first.org.orgName, country: first.org.country, organizationId: existing?.id, primaryEmail, primaryCandidates: existing ? [{ email: existing.email, name: existing.contactPerson || existing.name }] : candidates, rows: rows.map(row => row.row), newBriefs: 0, skippedBriefs: 0 };
      organizations.push(item);
      if (!existing) preview.newPartners++;
      for (const row of rows) {
        for (const email of [row.org.email, row.opportunity.secondaryContact?.email, primaryEmail].filter(Boolean) as string[]) {
          const reserved = partners.find(partner => partner.email.toLowerCase() === email && partner.id !== existing?.id);
          if (reserved || (emailGroups.has(email) && emailGroups.get(email) !== key)) errors.push({ row: row.row, message: "A contact email belongs to another partner or appears under multiple organizations" });
          emailGroups.set(email, key);
        }
        const receipt = receipts.find(receipt => receipt.sessionId === row.sessionId && receipt.opportunityNumber === row.opportunityNumber);
        if (receipt) {
          const brief = existingBriefs.find(brief => brief.id === receipt.briefId);
          if (receipt.contentHash !== row.contentHash || receipt.sourceTimezone !== dto.sourceTimezone || !brief || brief.deletedAt || brief.organizationId !== existing?.id) errors.push({ row: row.row, message: "Previously imported source row was changed, removed or reassigned; it will not be overwritten" });
          else { skipped.add(row.key); preview.skippedBriefs++; item.skippedBriefs++; }
        } else {
          if (existingBriefs.some(brief => (brief.sessionId === row.sessionId && brief.opportunityNumber === row.opportunityNumber) || (brief.organizationId === existing?.id && brief.title.trim().toLowerCase() === row.opportunity.title.toLowerCase()))) errors.push({ row: row.row, message: "A matching brief already exists without an import receipt; review it before importing" });
          preview.newBriefs++; item.newBriefs++;
        }
      }
    }
    const emails = [...emailGroups.keys()];
    const users = emails.length ? await manager.getRepository(User).createQueryBuilder("account").withDeleted().where("LOWER(account.email) IN (:...emails)", { emails }).getMany() : [];
    const memberships = users.length ? await manager.find(OrganizationUser, { where: { userId: In(users.map(user => user.id)) }, withDeleted: true }) : [];
    for (const user of users) {
      const group = organizations.find(item => item.key === emailGroups.get(user.email.toLowerCase()));
      if (user.deletedAt || !user.isActive || user.role !== Role.ORGANIZATION || memberships.some(link => link.userId === user.id && (link.deletedAt || link.organizationId !== group?.organizationId))) errors.push({ message: `An account used by ${group?.name || "this CSV"} is unavailable, has another role or belongs to another partner` });
    }
    preview.newUsers = emails.filter(email => !users.some(user => user.email.toLowerCase() === email)).length;
    preview.briefs = parsed.rows.map(row => {
      const group = organizations.find(item => item.key === row.organizationKey)!;
      const contact = row.opportunity.secondaryContact;
      return { row: row.row, title: row.opportunity.title, partner: group.name, submittedAt: row.submittedAt.toISOString(), status: skipped.has(row.key) ? "skipped" : "new",
        submitter: { name: row.org.contactName, email: row.org.email }, host: contact?.email ? { name: contact.name || contact.email, email: contact.email, source: "brief" }
          : { name: group.primaryCandidates.find(candidate => candidate.email === group.primaryEmail)?.name || group.name, email: group.primaryEmail, source: "partner" },
        fitScore: row.scores.fitScore, impactScore: row.scores.impactScore };
    });
    preview.ready = !errors.length;
    preview.previewHash = sourceHash({ csv: dto.csv, sourceName: dto.sourceName, cohortId: dto.cohortId, timezone: dto.sourceTimezone, organizations, users: users.map(user => ({ id: user.id, email: user.email, active: user.isActive, role: user.role })).sort((a, b) => a.email.localeCompare(b.email)), skipped: [...skipped].sort() });
    return { preview, rows: parsed.rows, skipped };
  }

  async apply(dto: ApplySubmissionImportDto, actor: ImportActor) {
    this.authorize(actor);
    try { return await this.db.transaction("SERIALIZABLE", async manager => {
      await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["partner-submission-import"]);
      const account = await manager.findOneBy(User, { id: actor.id });
      if (!account?.isActive || ![Role.SUPER_ADMIN, Role.PROGRAM_MANAGER].includes(account.role)) throw new ForbiddenException("Staff account is no longer authorized");
      const { preview, rows, skipped } = await this.plan(dto, manager);
      if (!preview.ready) throw new ConflictException({ message: "Import conflicts must be resolved before loading records", errors: preview.errors });
      if (dto.previewHash !== preview.previewHash) throw new ConflictException("The file, contact selections or existing data changed. Refresh the preview before importing.");
      const batchId = randomUUID(), briefIds: string[] = [];
      for (const plan of preview.organizations) {
        const group = rows.filter(row => row.organizationKey === plan.key);
        const selected = group.find(row => row.org.email === plan.primaryEmail) || group[0];
        let partner = plan.organizationId ? await manager.findOneByOrFail(Organization, { id: plan.organizationId }) : null;
        if (!partner) partner = await manager.save(Organization, manager.create(Organization, {
          name: selected.org.orgName, email: plan.primaryEmail, country: selected.org.country, city: selected.org.city,
          sector: selected.org.sector, sectorOther: selected.org.sectorOther, contactPerson: selected.org.contactName, contactPhone: selected.org.phone,
          submitterName: selected.org.contactName, submitterDesignation: selected.org.designation, submitterDepartment: selected.org.department,
          cohortId: dto.cohortId, status: OrganizationStatus.PENDING, isActive: true, publicSubmission: false, consentGiven: false,
        }));
        // Only a newly created partner's selected main contact receives owner membership.
        await ensurePartnerContactLogin(manager, partner.id, { name: partner.contactPerson || partner.name, email: partner.email, phone: partner.contactPhone }, !plan.organizationId);
        for (const row of group) {
          if (skipped.has(row.key)) continue;
          const opp = row.opportunity;
          const brief = await manager.save(Brief, manager.create(Brief, {
            title: opp.title, description: opp.description, problemStatement: opp.description, expectedOutcomes: opp.whatChanges,
            organizationId: partner.id, cohortId: dto.cohortId, status: BriefStatus.SUBMITTED, sessionId: row.sessionId,
            opportunityNumber: row.opportunityNumber, whatChanges: opp.whatChanges, affectedCount: opp.howMany,
            dataDescription: opp.dataDescription, dataAccess: opp.dataAccess, secondaryContact: opp.secondaryContact,
            scoringAnswers: opp.scoringAnswers, ...row.scores,
            scoreOverride: row.scores.scoreOverride ?? undefined, depthScore: row.scores.depthScore ?? undefined, breadthScore: row.scores.breadthScore ?? undefined,
            impactScore: row.scores.impactScore ?? undefined, impactBand: row.scores.impactBand ?? undefined, countryLeadNotes: row.raw["Country lead notes"] || undefined, submittedAt: row.submittedAt,
          }));
          await saveBriefContacts(manager, brief, opp.secondaryContact, { name: row.org.contactName, email: row.org.email, phone: row.org.phone, role: row.org.designation });
          await manager.save(PartnerImportRecord, manager.create(PartnerImportRecord, {
            cohortId: dto.cohortId, sessionId: row.sessionId, opportunityNumber: row.opportunityNumber, briefId: brief.id,
            batchId, actorId: actor.id, contentHash: row.contentHash, sourceName: dto.sourceName, sourceTimezone: dto.sourceTimezone, sourceRow: row.row, sourceData: row.raw,
          }));
          briefIds.push(brief.id);
        }
      }
      const result = { batchId, createdPartners: preview.newPartners, createdUsers: preview.newUsers, createdBriefs: briefIds.length, skippedBriefs: skipped.size, briefIds };
      await manager.save(AuditLog, manager.create(AuditLog, { actorId: actor.id, actorEmail: account.email, action: AuditAction.BULK_IMPORT,
        entityType: "PartnerSubmissionImport", entityId: batchId, description: `Imported ${briefIds.length} briefs from ${dto.sourceName}`, metadata: { ...result, sourceHash: sourceHash(dto.csv), cohortId: dto.cohortId, sourceTimezone: dto.sourceTimezone } }));
      return result;
    }); } catch (error) {
      const code = (error as { driverError?: { code?: string } }).driverError?.code;
      if (code === "40001" || code === "23505") throw new ConflictException("Existing data changed during import. Refresh the preview before retrying.");
      throw error;
    }
  }
}
