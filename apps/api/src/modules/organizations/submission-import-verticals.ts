import { EntityManager } from "typeorm";
import { v5 as uuidv5 } from "uuid";
import { sectorToIndustry } from "@acmp/shared";
import { Vertical } from "@/database/entities/vertical.entity";
import { Brief, BriefStatus } from "@/database/entities/brief.entity";
import { ImportIssue, ParsedSubmission } from "./submission-import-parser";
import { SubmissionUpdate } from "./submission-import-updates";

export interface SubmissionVerticalPlan {
  id: string; name: string; isNew: boolean; sectors: string[]; rows: number[];
  briefCap: number; briefCount: number; projectedBriefCount: number; displayOrder: number;
}
const counted = new Set([BriefStatus.SUBMITTED, BriefStatus.IN_REVIEW, BriefStatus.APPROVED]);
const normalize = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ").replace(/\s*\/\s*/g, "/");

/** Read-only planning: only matched updates / genuinely new briefs can create verticals. */
export async function planSubmissionVerticals(manager: EntityManager, cohortId: string,
  assignments: { row: ParsedSubmission; brief?: Brief }[], errors: ImportIssue[]) {
  const verticals = await manager.find(Vertical, { where: { cohortId }, withDeleted: true, order: { id: "ASC" } });
  const usage = verticals.length ? await manager.getRepository(Brief).createQueryBuilder("brief")
    .select("brief.verticalId", "verticalId").addSelect("COUNT(*)", "count")
    .where("brief.verticalId IN (:...ids)", { ids: verticals.map(vertical => vertical.id) })
    .andWhere("brief.status IN (:...statuses)", { statuses: [...counted] }).groupBy("brief.verticalId")
    .getRawMany<{ verticalId: string; count: string }>() : [];
  const counts = new Map(usage.map(item => [item.verticalId, Number(item.count)]));
  const plans = new Map<string, SubmissionVerticalPlan>(), targets = new Map<string, string>(), deltas = new Map<string, number>();
  const bump = (id: string, amount: number) => deltas.set(id, (deltas.get(id) || 0) + amount);
  for (const { row, brief } of assignments) {
    const sector = sectorToIndustry(row.org.sector, row.org.sectorOther), key = normalize(sector);
    if (!sector || sector.length > 255 || key === "other") {
      errors.push({ row: row.row, message: "Provide a specific sector of at most 255 characters to assign a brief vertical" }); continue;
    }
    let matches = verticals.filter(vertical => normalize(vertical.name) === key);
    // Existing cohorts call Healthcare "Health". Prefer an exact match if present.
    if (!matches.length && ["health", "healthcare"].includes(key)) matches = verticals.filter(vertical => ["health", "healthcare"].includes(normalize(vertical.name)));
    if (matches.length > 1 || matches[0]?.deletedAt || matches[0]?.isActive === false) {
      errors.push({ row: row.row, message: `Vertical for sector "${sector}" is ambiguous, inactive or deleted; resolve it in the cohort before importing` }); continue;
    }
    const existing = matches[0];
    const planned = [...plans.values()].find(plan => normalize(plan.name) === key || (["health", "healthcare"].includes(key) && ["health", "healthcare"].includes(normalize(plan.name))));
    // Include existing IDs so a previously auto-created, subsequently renamed
    // vertical cannot be mistaken for a new row with its old deterministic ID.
    const id = existing?.id || planned?.id || uuidv5(`submission-vertical:${key}:${verticals.map(vertical => vertical.id).join(",")}`, cohortId);
    let plan = plans.get(id);
    if (!plan) {
      plan = { id, name: existing?.name || sector, isNew: !existing, sectors: [], rows: [], briefCap: existing?.briefCap ?? 10,
        briefCount: counts.get(id) || 0, projectedBriefCount: counts.get(id) || 0, displayOrder: existing?.displayOrder ?? Math.max(0, ...verticals.map(vertical => vertical.displayOrder)) + plans.size + 1 };
      plans.set(id, plan);
    }
    if (!plan.sectors.includes(sector)) plan.sectors.push(sector);
    plan.rows.push(row.row); targets.set(row.key, id);
    if ((!brief || counted.has(brief.status)) && brief?.verticalId !== id) {
      bump(id, 1);
      if (brief?.verticalId) bump(brief.verticalId, -1);
    }
  }
  for (const plan of plans.values()) {
    plan.projectedBriefCount = plan.briefCount + (deltas.get(plan.id) || 0);
    if (plan.isNew) plan.briefCap = Math.min(100, Math.max(10, plan.projectedBriefCount));
    if ((deltas.get(plan.id) || 0) > 0 && plan.projectedBriefCount > plan.briefCap) errors.push({ message: `Vertical "${plan.name}" would contain ${plan.projectedBriefCount} submitted briefs, exceeding its capacity (${plan.briefCap}). Increase its cohort capacity before importing.` });
  }
  // Include counts and metadata in the hash so a changed destination needs a new preview.
  const versions = verticals.map(vertical => ({ id: vertical.id, name: vertical.name, active: vertical.isActive, deletedAt: vertical.deletedAt?.toISOString(),
    updatedAt: vertical.updatedAt.toISOString(), cap: vertical.briefCap, count: counts.get(vertical.id) || 0, cachedCount: vertical.briefCount }));
  return { plans: [...plans.values()], targets, versions, verticals, counts, deltas };
}

export function appendVerticalUpdates(updates: SubmissionUpdate[], matched: Map<string, { brief: Brief }>, rows: ParsedSubmission[], plan: Awaited<ReturnType<typeof planSubmissionVerticals>>) {
  for (const row of rows) {
    const brief = matched.get(row.key)?.brief, id = plan.targets.get(row.key);
    if (!brief || !id || brief.verticalId === id) continue;
    let update = updates.find(item => item.entity === "brief" && item.id === brief.id);
    if (!update) { update = { entity: "brief", id: brief.id, name: brief.title, rows: [row.row], updatedAt: brief.updatedAt.toISOString(), changes: [] }; updates.push(update); }
    update.changes.push({ field: "verticalId", label: "Brief vertical", before: { verticalId: brief.verticalId ?? null }, after: { verticalId: id },
      beforeLabel: plan.verticals.find(vertical => vertical.id === brief.verticalId)?.name || (brief.verticalId ? "Previous vertical" : "Empty"), afterLabel: plan.plans.find(vertical => vertical.id === id)!.name });
  }
}

/** Called in the same serializable transaction as briefs, revisions and audit receipts. */
export async function createSubmissionVerticals(manager: EntityManager, cohortId: string, plans: SubmissionVerticalPlan[]) {
  for (const plan of plans.filter(plan => plan.isNew)) await manager.insert(Vertical, {
    id: plan.id, name: plan.name, cohortId, briefCap: plan.briefCap, briefCount: 0, displayOrder: plan.displayOrder, isActive: true,
  });
}

export async function refreshSubmissionVerticalCounts(manager: EntityManager, ids: string[]) {
  for (const id of [...new Set(ids)].sort()) {
    const briefCount = await manager.getRepository(Brief).createQueryBuilder("brief").where("brief.verticalId = :id", { id })
      .andWhere("brief.status IN (:...statuses)", { statuses: [...counted] }).getCount();
    await manager.update(Vertical, id, { briefCount });
  }
}
