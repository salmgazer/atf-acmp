import { BadRequestException } from "@nestjs/common";
import { isEmail, isUUID, validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { DateTime } from "luxon";
import * as Papa from "papaparse";
import { createHash } from "crypto";
import { PublicSubmissionDto, VALID_COUNTRIES } from "@/modules/public/dto/public-submission.dto";
import { BriefScoringService } from "@/modules/briefs/brief-scoring.service";
import { ScoringAnswers } from "@/database/entities/brief.entity";

const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value;
export const sourceHash = (value: unknown) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
export const organizationKey = (country: string, name: string) => `${country.trim().toLowerCase()}::${name.trim().replace(/\s+/g, " ").toLowerCase()}`;
export interface ImportIssue { row?: number; message: string }
export interface ParsedSubmission {
  row: number; key: string; organizationKey: string; sessionId: string; opportunityNumber: number; total: number;
  submittedAt: Date; raw: Record<string, string>; contentHash: string;
  org: PublicSubmissionDto["org"]; opportunity: Omit<PublicSubmissionDto["opportunities"][number], "scoringAnswers"> & { scoringAnswers: ScoringAnswers };
  scores: ReturnType<BriefScoringService["calculateScores"]>;
}
const legacyOptions: Record<string, Record<string, string>> = {
 q1: {routine:'Repeating the same routine steps again and again',judgement:'Weighing things up and making judgement calls from experience',sense_making:'Working through lots of documents, images, messages or recordings',no_system:"There is no real system yet, so it is mostly manual, on paper, or in people's heads",new_capability:'Something we want to be able to do but cannot currently'},
 q2: {good_records:'Good digital records built up over time',partial:'A little, but on paper, scattered or patchy',very_little:'Very little, we would mostly be starting fresh'},
 q3: {straightforward:'Straightforward: a clear step by step procedure',mixed:'Mixed: there is a procedure, but plenty of exceptions',hard:'Hard: it takes experience and judgement'},
 q4: {yes:'Yes, that would still be a big help',no_exact:'No, it has to be exactly right every time'},
 q5: {vague:'Vague or hard to pin down',clear:'A clear, noticeable difference, with specific people ready to use it'},
 q6: {very_often:'Very often: many times a day, or across large numbers of cases',now_and_then:'Now and then: a handful of times'},
 q7: {convenient:'Convenient improvement: makes an existing process easier or more efficient',meaningful:'Meaningful change: significantly reduces time, cost or errors',transformative:'Transformative: unlocks something we currently cannot do'},
 q8: {local:'A handful to hundreds: one team, office, site or community',thousands:'Thousands: a district, a city, or a network of sites',national:'Hundreds of thousands or more: a national hub, system or widely-used service'},
};
export const scoringColumns: Record<string, string> = {q1:'Q1 answer',q2:'Q2 answer',q3:'Q3 answer',q4:'Q4 answer',q5:'Q5 answer',q6:'Q6 answer',q7:'Q7 Depth answer',q8:'Q8 Breadth answer'};

const requiredColumns = ["Timestamp", "Session ID", "Opportunity #", "Total briefs", "Organisation name", "Sector", "Country", "City or town", "Submitter name", "Designation", "Email", "Phone", "Opportunity title", "The opportunity and who it affects", "If addressed, what changes?", "Roughly how many people?", "Records and data that exist", "Can data be shared?", ...Object.values(scoringColumns).slice(0, 6)];
const flatten = (errors: Awaited<ReturnType<typeof validate>>, prefix = ""): { field: string; message: string }[] => errors.flatMap(error => [
  ...Object.values(error.constraints || {}).map(message => ({ field: prefix + error.property, message })), ...flatten(error.children || [], prefix + error.property + "."),
]);

export async function parseSubmissionCsv(csv: string, timezone: string) {
  if (Buffer.byteLength(csv, "utf8") > 500000) throw new BadRequestException("Choose a CSV smaller than 500 KB");
  if (!DateTime.now().setZone(timezone).isValid) throw new BadRequestException("Choose a valid source timezone");
  const parsed = Papa.parse<string[]>(csv.replace(/^\uFEFF/, ""), { skipEmptyLines: "greedy" });
  if (parsed.errors.length) throw new BadRequestException("CSV contains malformed quotes or rows");
  const headers = parsed.data[0]?.map(header => header.trim()) || [];
  if (new Set(headers).size !== headers.length || requiredColumns.some(header => !headers.includes(header))) throw new BadRequestException("CSV must contain the original partner brief-submission column headers, without duplicates");
  if (parsed.data.length < 2 || parsed.data.length > 501) throw new BadRequestException("Import between 1 and 500 brief rows at a time");
  const rows: ParsedSubmission[] = [], errors: ImportIssue[] = [], warnings: ImportIssue[] = [];
  const scorer = new BriefScoringService();
  for (let index = 1; index < parsed.data.length; index++) {
    const rowNumber = index + 1, cells = parsed.data[index];
    if (cells.length !== headers.length) { errors.push({ row: rowNumber, message: "Column count does not match the header" }); continue; }
    const raw = Object.fromEntries(headers.map((header, i) => [header, cells[i]]));
    const text = (key: string) => (raw[key] || "").trim();
    const sessionId = text("Session ID"), opportunityNumber = Number(text("Opportunity #")), total = Number(text("Total briefs"));
    if (!isUUID(sessionId) || !Number.isInteger(opportunityNumber) || opportunityNumber < 1 || opportunityNumber > 3 || !Number.isInteger(total) || total < opportunityNumber || total > 3) errors.push({ row: rowNumber, message: "Invalid session ID, opportunity number or total briefs" });
    const submittedAt = DateTime.fromFormat(text("Timestamp"), "M/d/yyyy H:mm:ss", { zone: timezone });
    if (!submittedAt.isValid) errors.push({ row: rowNumber, message: "Timestamp must use M/D/YYYY H:mm:ss in the selected source timezone" });
    const scoringAnswers: ScoringAnswers = {};
    for (const [key, column] of Object.entries(scoringColumns)) {
      const answer = text(column);
      const code = Object.entries(legacyOptions[key]).find(([value, label]) => value === answer || label === answer)?.[0];
      if (!code && (answer || !["q7", "q8"].includes(key))) errors.push({ row: rowNumber, message: `Unrecognized or missing answer: ${column}` });
      Object.assign(scoringAnswers, { [key]: code || "", [key + "_text"]: answer });
    }
    if (!scoringAnswers.q7 || !scoringAnswers.q8) warnings.push({ row: rowNumber, message: "Missing impact answers are preserved as missing; no impact value will be invented" });
    const org = { orgName: text("Organisation name"), sector: text("Sector").replace("Local / Municipal Government", "Local/Municipal Government"), sectorOther: text("Sector (if Other)") || undefined,
      country: text("Country") as typeof VALID_COUNTRIES[number], city: text("City or town"), contactName: text("Submitter name"), designation: text("Designation"), department: text("Department") || undefined, email: text("Email").toLowerCase(), phone: text("Phone") };
    const secondaryContact = { name: text("Name of contact person") || undefined, role: text("Role of contact person") || undefined, email: text("Email of contact person").toLowerCase() || undefined, phone: text("Phone of contact person") || undefined };
    const opportunity = { title: text("Opportunity title"), description: text("The opportunity and who it affects"), whatChanges: text("If addressed, what changes?"), howMany: text("Roughly how many people?"), dataDescription: text("Records and data that exist"), dataAccess: text("Can data be shared?"), scoringAnswers,
      secondaryContact: Object.values(secondaryContact).some(Boolean) ? secondaryContact : undefined };
    const dto = plainToInstance(PublicSubmissionDto, { sessionId, org, opportunities: [opportunity], consentGiven: false });
    const validation = flatten(await validate(dto)).filter(error => !["opportunities.0.scoringAnswers.q7", "opportunities.0.scoringAnswers.q8"].includes(error.field) || !!scoringAnswers[error.field.endsWith("q7") ? "q7" : "q8"]);
    for (const error of validation) errors.push({ row: rowNumber, message: error.message });
    if (org.email.length > 255 || opportunity.howMany.length > 10000 || Object.values(raw).some(value => value.length > 100000)) errors.push({ row: rowNumber, message: "A field exceeds the supported import size" });
    if (secondaryContact.email && !isEmail(secondaryContact.email)) errors.push({ row: rowNumber, message: "Brief main contact email is invalid" });
    const scores = scorer.calculateScores(scoringAnswers);
    const expected: Record<string, string | number | null> = { "AI-Challenge Fit Score": scores.fitScore, "Fit band": scorer.getFitBandLabel(scores.fitBand), "Score override": scores.scoreOverride,
      "Depth score (1-3)": scores.depthScore, "Breadth score (1-3)": scores.breadthScore, "Impact score (Depth x Breadth)": scores.impactScore, "Impact band": scores.impactBand ? scorer.getImpactBandLabel(scores.impactBand) : null };
    for (const [column, value] of Object.entries(expected)) if (text(column)) {
      const supplied = text(column) === "None" ? null : typeof value === "number" ? Number(text(column)) : text(column);
      if (supplied !== value) errors.push({ row: rowNumber, message: `${column} does not match the supplied answers` });
    }
    rows.push({ row: rowNumber, key: `${sessionId}:${opportunityNumber}`, organizationKey: organizationKey(org.country, org.orgName), sessionId, opportunityNumber, total, submittedAt: submittedAt.toJSDate(), raw, contentHash: sourceHash(raw), org, opportunity, scores });
  }
  const sessions = new Map<string, ParsedSubmission[]>();
  for (const row of rows) sessions.set(row.sessionId, [...(sessions.get(row.sessionId) || []), row]);
  for (const group of sessions.values()) {
    const numbers = group.map(row => row.opportunityNumber);
    if (new Set(numbers).size !== numbers.length || group.length !== group[0].total || group.some(row => row.total !== group[0].total || row.organizationKey !== group[0].organizationKey || JSON.stringify(row.org) !== JSON.stringify(group[0].org))) errors.push({ row: group[0].row, message: "Submission rows are duplicated, incomplete or have inconsistent organization/submitter details" });
  }
  return { rows, errors, warnings };
}
