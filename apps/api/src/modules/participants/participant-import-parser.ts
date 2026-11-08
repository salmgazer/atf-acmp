import * as Papa from "papaparse";
import { isEmail } from "class-validator";
import { COUNTRY_NAMES, PARTICIPANT_IMPORT_FIELDS, ParticipantImportField } from "@acmp/shared";

export type ImportValue = string | boolean | null;
export interface ParticipantSourceRow {
  row: number; participantId: string; lmsEmail?: string; country?: string;
  values: Partial<Record<ParticipantImportField, ImportValue>>;
  errors: string[]; warnings: string[];
}
export const canonicalCountry = (value: string) => Object.entries(COUNTRY_NAMES).find(([code, name]) => code.toLowerCase() === value.toLowerCase() || name.toLowerCase() === value.toLowerCase())?.[1] || value;
const normalizedHeader = (value: string) => value.replace(/^\uFEFF/, "").replace(/[_\s-]/g, "").toLowerCase();
type SourceField = ParticipantImportField | "participantId" | "lmsEmail" | "country";
const aliases: Record<string, SourceField> = {
  participantid: "participantId", id: "participantId", lmsemail: "lmsEmail", email: "lmsEmail", country: "country", firstname: "firstName", first: "firstName", lastname: "lastName", last: "lastName",
  phone: "phoneNumber", phonenumber: "phoneNumber", whatsappnumber: "whatsappNumber", institutionnameclean: "institution", institution: "institution", school: "institution", university: "institution",
  cityclean: "city", city: "city", locationtypeclean: "locationType", locationtype: "locationType", gender: "gender", educationlevelclean: "educationLevel", educationlevel: "educationLevel",
  currentaffiliationclean: "currentAffiliation", currentaffiliation: "currentAffiliation", fieldofstudyclean: "fieldOfStudy", fieldofstudy: "fieldOfStudy",
  pythonskill: "pythonSkill", gitskill: "gitSkill", aiexperience: "aiExperience", githubusername: "githubUsername",
  programmeoptedout: "programmeOptedOut", optedout: "programmeOptedOut", optout: "programmeOptedOut", codelabscompleted: "codeLabsCompleted",
  certificate: "learningCertificateIssued", learningcertificateissued: "learningCertificateIssued", certificateid: "learningCertificateId", learningcertificateid: "learningCertificateId",
  certificatedate: "learningCertificateDate", learningcertificatedate: "learningCertificateDate", finishedalllessons: "learningFinishedAllLessons", learningfinishedalllessons: "learningFinishedAllLessons",
  halfwayreached: "learningHalfwayReached", learninghalfwayreached: "learningHalfwayReached",
};
const booleanFields = new Set<SourceField>(["programmeOptedOut", "codeLabsCompleted", "learningCertificateIssued", "learningFinishedAllLessons", "learningHalfwayReached"]);
const lengths: Partial<Record<SourceField, number>> = { phoneNumber: 50, whatsappNumber: 50, city: 150, locationType: 150, gender: 100, educationLevel: 150, currentAffiliation: 150 };

function github(value: string, warnings: string[]): string {
  let candidate = value.replace(/^@/, "");
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    const parts = url.pathname.split("/").filter(Boolean);
    if (["github.com", "www.github.com"].includes(url.hostname.toLowerCase()) && parts.length === 1) candidate = parts[0];
  } catch { /* A username does not need to be a URL. */ }
  if (/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(candidate)) return candidate;
  warnings.push("GitHub value needs review; the supplied text will be preserved");
  return value;
}

export function parseParticipantCsv(csv: string) {
  const errors: string[] = [], warnings: string[] = [];
  const result = Papa.parse<string[]>(csv.replace(/^\uFEFF/, ""), { skipEmptyLines: "greedy" });
  if (result.errors.length) errors.push("The CSV has invalid quoting or structure");
  const [headers = [], ...data] = result.data;
  if (!data.length) errors.push("Provide a header and at least one participant row");
  if (data.length > 5000) errors.push("Import at most 5,000 participants in one file");
  const columns = new Map<SourceField, number>();
  headers.forEach((header, index) => {
    const field = aliases[normalizedHeader(header)];
    if (!field) { warnings.push(`Unrecognized column '${header.slice(0, 100)}' will be ignored`); return; }
    if (columns.has(field)) errors.push(`More than one column maps to ${field}; keep only one`);
    columns.set(field, index);
  });
  if (!columns.has("participantId")) errors.push("The participant_id column is required");
  const rows: ParticipantSourceRow[] = data.slice(0, 5000).map((cells, index) => {
    const row: ParticipantSourceRow = { row: index + 2, participantId: "", values: {}, errors: [], warnings: [] };
    if (cells.length !== headers.length) row.errors.push("The number of values does not match the header");
    for (const [field, column] of columns) {
      const value = (cells[column] || "").trim();
      if (!value) continue; // Blank cells never erase existing data.
      if (value.length > (lengths[field] || 255)) { row.errors.push(`${field} is too long`); continue; }
      if (field === "participantId") row.participantId = value;
      else if (field === "lmsEmail") {
        if (!isEmail(value)) row.errors.push("Invalid LMS email");
        else row.lmsEmail = value.toLowerCase();
      } else if (field === "country") row.country = canonicalCountry(value);
      else if (booleanFields.has(field)) {
        if (["yes", "true", "1"].includes(value.toLowerCase())) row.values[field] = true;
        else if (["no", "false", "0"].includes(value.toLowerCase())) row.values[field] = false;
        else row.errors.push(`${field} must be Yes/No or True/False`);
      } else if (field === "learningCertificateDate") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) row.errors.push("Certificate date must be a valid YYYY-MM-DD date");
        else row.values[field] = value;
      } else row.values[field] = field === "githubUsername" ? github(value, row.warnings) : value;
    }
    if (!row.participantId) row.errors.push("Missing participant ID");
    if (row.values.learningCertificateIssued === false && (row.values.learningCertificateId || row.values.learningCertificateDate)) row.errors.push("A certificate marked No cannot have an ID or date");
    if (row.values.learningCertificateIssued === true && row.values.learningFinishedAllLessons === false) row.warnings.push("Certificate issued but lessons are marked unfinished; both values will be preserved");
    if (row.values.learningFinishedAllLessons === true && row.values.learningCertificateIssued === false) row.warnings.push("Lessons completed but no certificate issued yet");
    return row;
  });
  return { rows, errors, warnings, recognizedFields: [...columns.keys()].filter(field => (PARTICIPANT_IMPORT_FIELDS as readonly string[]).includes(field)) as ParticipantImportField[] };
}
