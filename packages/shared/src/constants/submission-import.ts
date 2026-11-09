export const SUBMISSION_UPDATE_FIELDS = [
  { key: "industry", label: "Partner industry", source: "Sector / Sector (if Other)", entity: "partner" },
  { key: "verticalId", label: "Brief vertical", source: "Sector / Sector (if Other)", entity: "brief" },
  { key: "sector", label: "Partner sector and other-sector detail", source: "Sector / Sector (if Other)", entity: "partner" },
  { key: "city", label: "Partner city", source: "City or town", entity: "partner" },
  { key: "title", label: "Brief title", source: "Opportunity title", entity: "brief" },
  { key: "description", label: "Brief description and problem statement", source: "The opportunity and who it affects", entity: "brief" },
  { key: "expectedOutcomes", label: "Brief expected outcomes", source: "If addressed, what changes?", entity: "brief" },
  { key: "affectedCount", label: "People affected", source: "Roughly how many people?", entity: "brief" },
  { key: "dataDescription", label: "Available data", source: "Records and data that exist", entity: "brief" },
  { key: "dataAccess", label: "Data access", source: "Can data be shared?", entity: "brief" },
  { key: "countryLeadNotes", label: "Country lead notes", source: "Country lead notes", entity: "brief" },
  { key: "problemCountry", label: "Problem country", source: "Country", entity: "brief" },
] as const;
export type SubmissionUpdateField = typeof SUBMISSION_UPDATE_FIELDS[number]["key"];
export type SubmissionImportMode = "create" | "update_existing";

/** Preserve the submitted sector wording; use its specific detail for Other. */
export function sectorToIndustry(sector: string, other?: string): string {
  return (sector.trim().toLowerCase() === "other" ? other?.trim() || sector.trim() : sector.trim());
}
