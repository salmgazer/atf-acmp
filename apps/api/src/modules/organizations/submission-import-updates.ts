import { BadRequestException } from "@nestjs/common";
import { SUBMISSION_UPDATE_FIELDS, SubmissionUpdateField, sectorToIndustry } from "@acmp/shared";
import { Organization } from "@/database/entities/organization.entity";
import { Brief } from "@/database/entities/brief.entity";
import { PartnerImportRecord } from "@/database/entities/partner-import-record.entity";
import { SubmissionImportDto } from "./dto/submission-import.dto";
import { ImportIssue, organizationKey, ParsedSubmission } from "./submission-import-parser";

export interface SubmissionFieldChange { field: SubmissionUpdateField; label: string; before: Record<string, unknown>; after: Record<string, string>; beforeLabel?: string; afterLabel?: string }
export interface SubmissionUpdate {
  entity: "partner" | "brief"; id: string; name: string; rows: number[]; updatedAt: string;
  changes: SubmissionFieldChange[];
}
export function submissionImportOptions(dto: SubmissionImportDto) {
  const mode = dto.mode || "create";
  const fields = dto.updateFields || [];
  if (!["create", "update_existing"].includes(mode) || !Array.isArray(fields) || new Set(fields).size !== fields.length || fields.some(key => !SUBMISSION_UPDATE_FIELDS.some(field => field.key === key))) throw new BadRequestException("Choose a valid import mode and unique supported update fields");
  if (mode === "update_existing" && !fields.length) throw new BadRequestException("Select at least one field to update");
  if (mode === "create" && fields.length) throw new BadRequestException("Field updates require Update existing only mode");
  return { mode, fields: [...fields].sort() };
}

function incoming(row: ParsedSubmission, field: SubmissionUpdateField): Record<string, string> {
  switch (field) {
    case "industry": return { industry: sectorToIndustry(row.org.sector, row.org.sectorOther) };
    // Resolved against the cohort after stable source identities have matched.
    case "verticalId": return {};
    case "sector": return { sector: row.org.sector, ...(row.org.sectorOther ? { sectorOther: row.org.sectorOther } : {}) };
    case "city": return { city: row.org.city };
    case "title": return { title: row.opportunity.title };
    case "description": return { description: row.opportunity.description, problemStatement: row.opportunity.description };
    case "expectedOutcomes": return { expectedOutcomes: row.opportunity.whatChanges, whatChanges: row.opportunity.whatChanges };
    case "affectedCount": return { affectedCount: row.opportunity.howMany };
    case "dataDescription": return { dataDescription: row.opportunity.dataDescription };
    case "dataAccess": return { dataAccess: row.opportunity.dataAccess };
    case "countryLeadNotes": return { countryLeadNotes: (row.raw["Country lead notes"] || "").trim() };
    case "problemCountry": return { problemCountry: row.org.country };
  }
}

/** Match only by stable source identity; never by a mutable title or email. */
export function planSubmissionUpdates(dto: SubmissionImportDto, rows: ParsedSubmission[], partners: Organization[], receipts: PartnerImportRecord[], briefs: Brief[], errors: ImportIssue[], warnings: ImportIssue[]) {
  const { fields } = submissionImportOptions(dto);
  const updates: SubmissionUpdate[] = [], matched = new Map<string, { partner: Organization; brief: Brief }>();
  const candidates = new Map<string, { entity: "partner" | "brief"; record: Organization | Brief; rows: ParsedSubmission[] }>();
  for (const row of rows) {
    const receipt = receipts.find(item => item.sessionId === row.sessionId && item.opportunityNumber === row.opportunityNumber);
    const matches = receipt ? briefs.filter(brief => brief.id === receipt.briefId) : briefs.filter(brief => brief.cohortId === dto.cohortId && brief.sessionId === row.sessionId && brief.opportunityNumber === row.opportunityNumber);
    if (!receipt && !matches.length) { warnings.push({ row: row.row, message: "No existing brief matches this session and opportunity number; skipped in update-only mode" }); continue; }
    const brief = matches[0], partner = partners.find(partner => partner.id === brief?.organizationId);
    if (matches.length !== 1 || receipt?.deletedAt || !brief || brief.deletedAt || brief.cohortId !== dto.cohortId || brief.sessionId !== row.sessionId || brief.opportunityNumber !== row.opportunityNumber || !partner || partner.deletedAt || partner.cohortId !== dto.cohortId || organizationKey(partner.country || "", partner.name) !== row.organizationKey) {
      errors.push({ row: row.row, message: "The source identity matches a removed, ambiguous, reassigned or different-partner record; resolve it before updating" }); continue;
    }
    matched.set(row.key, { partner, brief });
    for (const [entity, record] of [["partner", partner], ["brief", brief]] as const) {
      const key = `${entity}:${record.id}`, candidate = candidates.get(key);
      if (candidate) candidate.rows.push(row); else candidates.set(key, { entity, record, rows: [row] });
    }
  }
  for (const candidate of candidates.values()) {
    const changes: SubmissionFieldChange[] = [];
    for (const field of SUBMISSION_UPDATE_FIELDS.filter(field => fields.includes(field.key) && field.entity === candidate.entity)) {
      const values = candidate.rows.map(row => Object.fromEntries(Object.entries(incoming(row, field.key)).filter(([, value]) => value?.trim())));
      const nonblank = values.filter(value => Object.keys(value).length);
      if (!nonblank.length) continue;
      if (new Set(nonblank.map(value => JSON.stringify(value))).size > 1) {
        errors.push({ row: candidate.rows[0].row, message: `Conflicting ${field.label.toLowerCase()} values for the same partner; use a consistent source before updating` }); continue;
      }
      const after = nonblank[0], before = Object.fromEntries(Object.keys(after).map(key => [key, (candidate.record as unknown as Record<string, unknown>)[key] ?? null]));
      if (Object.entries(after).some(([key, value]) => before[key] !== value)) changes.push({ field: field.key, label: field.label, before, after });
    }
    if (changes.length) updates.push({ entity: candidate.entity, id: candidate.record.id, name: candidate.entity === "partner" ? (candidate.record as Organization).name : (candidate.record as Brief).title, rows: candidate.rows.map(row => row.row), updatedAt: candidate.record.updatedAt.toISOString(), changes });
  }
  const versions = [...candidates.values()].map(item => ({ entity: item.entity, id: item.record.id, updatedAt: item.record.updatedAt.toISOString(), deletedAt: item.record.deletedAt, sourceId: item.entity === "brief" ? [(item.record as Brief).sessionId, (item.record as Brief).opportunityNumber] : null })).sort((a, b) => a.id.localeCompare(b.id));
  return { updates, matched, versions };
}
