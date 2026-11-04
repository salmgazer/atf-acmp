import * as Papa from "papaparse";
import { randomUUID } from "crypto";

export function submissionFixture() {
  const suffix = randomUUID(), sessionId = randomUUID(), anotherSession = randomUUID();
  const owner = `owner-${suffix}@example.test`, submitter = `submitter-${suffix}@example.test`;
  const hosts = [1, 2, 3].map(index => `host-${index}-${suffix}@example.test`);
  const base: Record<string, string> = {
    "Timestamp": "11/4/2026 8:17:18", "Session ID": sessionId, "Opportunity #": "1", "Total briefs": "2",
    "Organisation name": `Example partner ${suffix}`, "Sector": "Healthcare", "Sector (if Other)": "", "Country": "Ghana", "City or town": "Accra",
    "Submitter name": "First Submitter", "Designation": "Director", "Department": "Research", "Email": owner, "Phone": "+233200000001",
    "Opportunity title": "First opportunity", "The opportunity and who it affects": "An opportunity affecting people across the district.",
    "If addressed, what changes?": "Faster service delivery", "Roughly how many people?": "Thousands", "Records and data that exist": "Digital records, paper forms and interviews.",
    "Can data be shared?": "Yes, with some conditions or restrictions", "Name of contact person": "Brief Host One", "Role of contact person": "Research lead", "Email of contact person": hosts[0], "Phone of contact person": "+233200000002",
    "Q1 answer": "sense_making", "Q2 answer": "good_records", "Q3 answer": "mixed", "Q4 answer": "yes", "Q5 answer": "clear", "Q6 answer": "very_often", "Q7 Depth answer": "meaningful", "Q8 Breadth answer": "thousands",
    "AI-Challenge Fit Score": "95", "Fit band": "Strong fit", "Score override": "None", "Depth score (1-3)": "2", "Breadth score (1-3)": "2", "Impact score (Depth x Breadth)": "4", "Impact band": "Moderate impact", "Country lead notes": "Keep this review note",
  };
  const rows = [base, { ...base, "Opportunity #": "2", "Opportunity title": "Second opportunity", "Email of contact person": hosts[1], "Name of contact person": "Brief Host Two", "Q7 Depth answer": "", "Q8 Breadth answer": "", "Depth score (1-3)": "", "Breadth score (1-3)": "", "Impact score (Depth x Breadth)": "", "Impact band": "" },
    { ...base, "Session ID": anotherSession, "Total briefs": "1", "Submitter name": "Other Submitter", "Email": submitter, "Opportunity title": "Third opportunity", "Email of contact person": hosts[2], "Name of contact person": "Brief Host Three" }];
  return { rows, owner, submitter, hosts, sessionId, name: base["Organisation name"], csv: () => Papa.unparse(rows) };
}
