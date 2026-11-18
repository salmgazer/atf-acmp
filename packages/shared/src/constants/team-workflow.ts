/** The ATF programme has fixed steps; dates and review rubrics belong to cohorts. */
export const TEAM_WORKFLOW_STEPS = [
  { key: "team", number: 1, name: "Form a team" },
  { key: "problem", number: 2, name: "Choose a problem" },
  { key: "proposal", number: 3, name: "Submit a proposal" },
  { key: "evaluation", number: 4, name: "Pass evaluation" },
  { key: "build", number: 5, name: "Build and submit" },
] as const;
export type TeamWorkflowStep = typeof TEAM_WORKFLOW_STEPS[number]["key"];
export type FormAnswers = Record<string, unknown>;
export interface ProgrammeField {
  name: string; section: string; label: string;
  type?: "text" | "email" | "number" | "select" | "checkbox" | "checks" | "milestones" | "indicators" | "links";
  words?: number; maxChars?: number; options?: readonly string[]; optional?: boolean;
  when?: { field: string; value: unknown };
  help?: string;
}
const yesNo = ["Yes", "No"];
export const TEAM_BRIEF_FIELDS: readonly ProgrammeField[] = [
  { section: "Context", name: "hasOrganization", label: "Does an organisation own or manage this problem?", type: "select", options: yesNo },
  { section: "Context", name: "setting", label: "Organisation name, or community, group or setting affected", words: 50 },
  { section: "Context", name: "sector", label: "Sector", type: "select", options: ["Healthcare", "Agriculture", "Finance", "Local government (MMDA)", "Education", "Legal services", "Retail / SME", "Logistics", "Manufacturing", "Other"] },
  { section: "Context", name: "otherSector", label: "Specify the sector", words: 15, when: { field: "sector", value: "Other" } },
  { section: "Context", name: "country", label: "Country", type: "select", options: ["Ghana", "Nigeria", "Kenya", "South Africa"] },
  { section: "Context", name: "city", label: "City, town or area", words: 30 },
  { section: "Problem", name: "title", label: "Brief title", words: 10 },
  { section: "Problem", name: "problemStatement", label: "State the problem in one sentence", words: 30 },
  { section: "Problem", name: "description", label: "What is not working, or what opportunity is being missed?", words: 150, help: "Describe the problem, not your solution." },
  { section: "Problem", name: "affected", label: "Who is affected, roughly how many, and where does your estimate come from?", words: 100 },
  { section: "Problem", name: "cost", label: "What does this problem cost the people affected?", words: 100 },
  { section: "Problem", name: "workarounds", label: "How do people deal with this today, and why is that not enough?", words: 100 },
  { section: "Problem", name: "urgency", label: "Why does this problem matter now?", words: 75 },
  { section: "Problem", name: "expectedOutcomes", label: "If this is solved, what changes?", words: 75 },
  { section: "Problem", name: "improvement", label: "How would you know things had improved?", words: 50 },
  { section: "Data", name: "dataDescription", label: "What information or records exist? Include format and history.", words: 100 },
  { section: "Data", name: "dataAccess", label: "Could the organisation's records be shared?", type: "select", options: ["Yes, freely", "Yes, with conditions", "Partially", "No, confidential or restricted", "Not yet confirmed"], when: { field: "hasOrganization", value: "Yes" } },
  { section: "Real-world contact", maxChars: 255, name: "contactName", label: "Contact name", words: 30, help: "Someone who lives with or works on the problem; not a team member." },
  { section: "Real-world contact", maxChars: 255, name: "contactRole", label: "Contact role", words: 30 },
  { section: "Real-world contact", name: "contactOrganization", label: "Contact organisation", optional: true, words: 50 },
  { section: "Real-world contact", maxChars: 254, name: "contactEmail", label: "Contact email", type: "email" },
  { section: "Real-world contact", maxChars: 50, name: "contactPhone", label: "Contact phone", words: 10 },
  { section: "Real-world contact", name: "contactConnection", label: "What is their connection to the problem?", words: 50 },
  { section: "Real-world contact", name: "contactSupport", label: "Have they agreed to support your team?", type: "select", options: ["Yes", "No", "Not yet asked"] },
  { section: "Real-world contact", name: "organizationOutreach", label: "Would the organisation be open to hearing from ATF?", type: "select", options: ["Yes", "No", "Not sure"], when: { field: "hasOrganization", value: "Yes" } },
  { section: "Real-world contact", name: "contactConsent", label: "This person has agreed to their details being shared with ATF", type: "checkbox" },
  { section: "Evidence", name: "discovery", label: "How did your team come across this problem?", type: "select", options: ["Personal experience", "Community or volunteer work", "Work or internship", "Research", "Conversation with someone in the sector", "Other"] },
  { section: "Evidence", name: "discoveryDetails", label: "Explain how you found the problem", words: 75 },
  { section: "Evidence", name: "consultationCount", label: "How many affected people or people working on this problem have you spoken to?", type: "number" },
  { section: "Evidence", name: "findings", label: "What did they tell you?", words: 150 },
  { section: "Evidence", name: "evidenceLinks", label: "Supporting evidence links", type: "links", optional: true, help: "One HTTP(S) link per line; uploaded documents can be added below." },
  { section: "Suitability", name: "q1", label: "What best describes the problem?", type: "select", options: ["routine", "judgement", "sense_making", "no_system", "new_capability"] },
  { section: "Suitability", name: "q2", label: "What past information could you point to?", type: "select", options: ["good_records", "public_data", "partial", "collectable", "very_little"] },
  { section: "Suitability", name: "dataSourceDetails", label: "Name the public data or explain how you will collect data", words: 100, optional: true },
  { section: "Suitability", name: "q3", label: "How would teaching someone new to handle this go?", type: "select", options: ["straightforward", "mixed", "hard"] },
  { section: "Suitability", name: "q4", label: "Would mostly correct answers help if a person checked before acting?", type: "select", options: ["yes", "no_exact"] },
  { section: "Suitability", name: "q5", label: "What difference would solving it make, and are users ready?", type: "select", options: ["clear", "vague"] },
  { section: "Suitability", name: "q6", label: "How often does this come up?", type: "select", options: ["very_often", "now_and_then"] },
  { section: "Suitability", name: "contactReviewed", label: "Has your contact reviewed and agreed your suitability answers?", type: "select", options: yesNo },
  { section: "Impact", name: "q7", label: "How significant would the change be?", type: "select", options: ["convenient", "meaningful", "transformative"] },
  { section: "Impact", name: "q8", label: "How many people would benefit?", type: "select", options: ["local", "thousands", "national"] },
  { section: "Sensitivities", name: "sensitivities", label: "Does the problem involve any of these?", type: "checks", options: ["Health information", "Children under 18", "Financial data", "Personal ID data", "Other vulnerable groups", "None of these"] },
  { section: "Sensitivities", name: "conflict", label: "Does any member have a personal or business interest in the problem or organisation?", type: "select", options: yesNo },
  { section: "Sensitivities", name: "conflictDetails", label: "Explain the interest", words: 100, when: { field: "conflict", value: "Yes" } },
  { section: "Declarations", name: "original", label: "Our team identified this problem and the information is accurate", type: "checkbox" },
  { section: "Declarations", name: "acceptReview", label: "We understand ATF may approve, request changes or decline", type: "checkbox" },
  { section: "Declarations", name: "shareWithTeams", label: "ATF may offer this brief to other teams if approved", type: "checkbox", optional: true },
];
export const PROPOSAL_FIELDS: readonly ProgrammeField[] = [
  { section: "Overview", name: "projectName", label: "Project name", words: 30 },
  { section: "Overview", name: "summary", label: "Project summary: what will you build, for whom, and what will change?", words: 100 },
  { section: "Overview", name: "learning", label: "What have you learned since choosing the brief?", words: 100 },
  { section: "Solution", name: "solution", label: "What will you build, and how will someone use it?", words: 200 },
  { section: "Solution", name: "aiApproach", label: "Which AI tools or techniques will you use, and what will each do?", words: 150 },
  { section: "Solution", name: "whyAi", label: "Why is AI needed? What simpler options did you consider?", words: 100 },
  { section: "Solution", name: "technology", label: "Other technologies and development approach", words: 100 },
  { section: "Solution", name: "dataPermission", label: "Data needed, sources and permission to use it", words: 100 },
  { section: "Solution", name: "llmPlatform", label: "LLM platform requested", words: 20, help: "Subject to ATF's available platforms and approval; credits are released after evaluation." },
  { section: "Solution", name: "creditsPlan", label: "How would you use the platform and credits, and roughly how much?", words: 75 },
  { section: "Delivery", name: "demoScope", label: "What will work by Demo Day, and what are you leaving out?", words: 100 },
  { section: "Delivery", name: "milestones", label: "Three to four milestones and target dates", type: "milestones" },
  { section: "Delivery", name: "testing", label: "How, when and with whom will you test?", words: 100 },
  { section: "Delivery", name: "risks", label: "What could stop delivery, and how will you handle it?", words: 100 },
  { section: "Delivery", name: "responsibleAi", label: "Risks to users and how you will reduce them", words: 100 },
  { section: "Impact", name: "directBeneficiaries", label: "Who benefits directly, and how?", words: 75 },
  { section: "Impact", name: "indirectBeneficiaries", label: "Who benefits indirectly, and how?", words: 75 },
  { section: "Impact", name: "indicators", label: "Two to three success indicators", type: "indicators" },
  { section: "Impact", name: "impactType", label: "Main aim", type: "select", options: ["Social impact", "Commercial potential", "Both"] },
  { section: "Impact", name: "impactExplanation", label: "Explain the aim and an example outcome", words: 100 },
  { section: "Impact", name: "afterChallenge", label: "Next steps after the Challenge, scaling and barriers", words: 100 },
  { section: "Team", name: "skills", label: "Team skills and gaps", words: 75 },
  { section: "Team", name: "mentorSupport", label: "What mentor support would help most?", type: "checks", options: ["Technical or AI", "Product or design", "Sector expertise", "Business and pitching"] },
  { section: "Team", name: "mentorSupportDetails", label: "Explain the support needed", words: 50 },
  { section: "Team", name: "weeklyHours", label: "Average hours each member can commit per week", type: "number" },
  { section: "Additional", name: "additional", label: "Anything else reviewers should know?", words: 100, optional: true },
  { section: "Additional", name: "supportingLinks", label: "Supporting material links (videos up to three minutes)", type: "links", optional: true },
  { section: "Declarations", name: "original", label: "This proposal is our team's original work", type: "checkbox" },
  { section: "Declarations", name: "aiWriting", label: "Did you use AI tools to help write this?", type: "select", options: yesNo },
  { section: "Declarations", name: "aiWritingDetails", label: "Explain how AI helped write this proposal", words: 30, when: { field: "aiWriting", value: "Yes" } },
  { section: "Declarations", name: "acceptRules", label: "We accept the Challenge rules and IP terms", type: "checkbox" },
  { section: "Declarations", name: "shareWithContact", label: "ATF may share our proposal with the brief sponsor or contact", type: "checkbox" },
  { section: "Declarations", name: "surveyConsent", label: "We agree to programme surveys, including follow-up at 6 and 12 months", type: "checkbox" },
];
export const PROGRAMME_OPTION_LABELS: Record<string, string> = {
  routine: "Repeating routine steps", judgement: "Experience and judgement calls", sense_making: "Making sense of documents, images or messages", no_system: "No real system yet", new_capability: "A new capability or service",
  good_records: "Good digital records over time", public_data: "Public or open data", partial: "Scattered, patchy or paper records", collectable: "Nothing yet, but we can collect data", very_little: "Very little; starting fresh",
  straightforward: "Straightforward procedure", mixed: "Procedure with exceptions", hard: "Experience and judgement needed", yes: "Yes, with human checking", no_exact: "No, it must be exactly right",
  clear: "Clear difference, with specific users ready", vague: "Some benefit, but unclear users or impact", very_often: "Very often", now_and_then: "Now and then",
  convenient: "Convenient improvement", meaningful: "Meaningful reduction in friction, time, cost or errors", transformative: "Transformative change", local: "A handful to hundreds", thousands: "Thousands", national: "Hundreds of thousands or more",
};
export const fieldVisible = (field: ProgrammeField, answers: FormAnswers) => !field.when || answers[field.when.field] === field.when.value;
export const wordCount = (value: unknown) => typeof value === "string" ? value.trim().split(/\s+/u).filter(Boolean).length : 0;
/** Shared presentation rules; the API always validates independently of the browser. */
export function validateProgrammeForm(fields: readonly ProgrammeField[], answers: FormAnswers, final: boolean): string[] {
  const errors: string[] = [];
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return ["Answers must be an object"];
  const names = new Set(fields.map(field => field.name));
  for (const name of Object.keys(answers)) if (!names.has(name) && !["briefId", "schemaVersion"].includes(name)) errors.push(`Unknown field: ${name}`);
  for (const field of fields) {
    if (!fieldVisible(field, answers)) continue;
    const value = answers[field.name];
    const empty = value === undefined || value === null || value === "" || (typeof value === "string" && !value.trim()) || (Array.isArray(value) && value.length === 0);
    if (empty) { if (final && !field.optional) errors.push(`${field.label} is required`); continue; }
    if (field.type === "checkbox") { if (typeof value !== "boolean" || (final && !field.optional && value !== true)) errors.push(`${field.label} must be confirmed`); }
    else if (field.type === "number") { if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100000 || (field.name === "consultationCount" && !Number.isInteger(value)) || (field.name === "weeklyHours" && (value <= 0 || value > 168))) errors.push(`${field.label} must be a valid number`); }
    else if (field.type === "checks") { if (!Array.isArray(value) || !value.every(item => field.options?.includes(item)) || new Set(value).size !== value.length || (value.includes("None of these") && value.length > 1)) errors.push(`${field.label} has invalid choices`); }
    else if (field.type === "milestones" || field.type === "indicators") {
      const keys = field.type === "milestones" ? ["milestone", "date"] : ["indicator", "measurement", "target"];
      const min = field.type === "milestones" ? 3 : 2;
      if (!Array.isArray(value) || value.length > min + 1 || (final && value.length < min)) errors.push(`${field.label} needs ${min}–${min + 1} rows`);
      else for (const row of value) {
        if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).some(key => !keys.includes(key)) || keys.some(key => typeof row[key] !== "string" || row[key].length > 500 || (final && !row[key].trim()))) { errors.push(`${field.label} has an incomplete or invalid row`); continue; }
        if (field.type === "milestones" && row.date && (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(Date.parse(row.date)) || new Date(row.date).toISOString().slice(0, 10) !== row.date)) errors.push("Milestone dates must be valid dates");
      }
    } else {
      if (typeof value !== "string" || value.length > 12000) { errors.push(`${field.label} must be text`); continue; }
      if (field.maxChars && value.length > field.maxChars) errors.push(`${field.label} is too long`);
      if (field.words && wordCount(value) > field.words) errors.push(`${field.label} must be ${field.words} words or fewer`);
      if (field.options && !field.options.includes(value)) errors.push(`${field.label} has an invalid choice`);
      if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors.push("Contact email must be valid");
      if (field.type === "links") for (const link of value.split(/\n/).map(item => item.trim()).filter(Boolean)) { try { if (!["https:", "http:"].includes(new URL(link).protocol)) throw new Error(); } catch { errors.push(`${field.label} must contain HTTP(S) links`); } }
    }
  }
  if (final && fields === TEAM_BRIEF_FIELDS && ["public_data", "collectable"].includes(String(answers.q2)) && !String(answers.dataSourceDetails || "").trim()) errors.push("Name the public data or explain how you will collect it");
  return errors;
}
