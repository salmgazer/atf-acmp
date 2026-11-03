const FALLBACK = "We couldn't submit your form. Please try again.";

const FIELD_LABELS: Record<string, string> = {
  orgName: "Organisation name", sector: "Sector", sectorOther: "Other sector",
  country: "Country", city: "City or town", contactName: "Your name",
  designation: "Designation/title", department: "Department", email: "Email address",
  phone: "Phone number", title: "Title", description: "Description",
  whatChanges: "Expected impact", howMany: "Number of people affected",
  dataDescription: "Available data", dataAccess: "Data sharing",
  "secondaryContact.name": "Secondary contact name", "secondaryContact.role": "Secondary contact role",
  "secondaryContact.email": "Secondary contact email", "secondaryContact.phone": "Secondary contact phone",
  secondaryContact: "Secondary contact", scoringAnswers: "Fit assessment",
};

function formatMessage(message: string): string {
  // Nest prefixes a custom validator message with the nested object's path.
  const contactEmail = message.match(/^opportunities\.(\d+)\.secondaryContact\.Please enter a valid email address$/);
  if (contactEmail) return `Opportunity ${Number(contactEmail[1]) + 1}: Secondary contact email must be a valid email address.`;

  const match = message.match(/^((?:org|opportunities|sessionId|consentGiven)(?:\.[\w]+)*)\s+(.+)$/);
  if (!match) return message;
  const [, path, constraint] = match;
  if (path === "sessionId") return "Your form session is invalid. Please refresh the page and try again.";
  if (path === "consentGiven") return "Please confirm your consent before submitting.";
  if (path === "opportunities") return "Please provide between 1 and 3 opportunities.";

  const opportunity = path.match(/^opportunities\.(\d+)\.(.+)$/);
  const field = opportunity ? opportunity[2] : path.replace(/^org\./, "");
  const prefix = opportunity ? `Opportunity ${Number(opportunity[1]) + 1}: ` : "";
  const question = field.match(/^scoringAnswers\.q([1-8])(?:_text)?$/);
  const label = question ? `Fit question ${question[1]}` : FIELD_LABELS[field];
  if (!label) return `${prefix}Please review the information in this section.`;

  const minimum = constraint.match(/^must be longer than or equal to (\d+) characters$/);
  const maximum = constraint.match(/^must be shorter than or equal to (\d+) characters$/);
  if (minimum) return `${prefix}${label} must be at least ${minimum[1]} characters.`;
  if (maximum) return `${prefix}${label} must be ${maximum[1]} characters or fewer.`;
  if (constraint === "should not be empty") return `${prefix}${label} is required.`;
  if (constraint === "must be an email") return `${prefix}${label} must be a valid email address.`;
  if (constraint.startsWith("must be one of the following values:")) return `${prefix}Please select a valid answer for ${label.toLowerCase()}.`;
  return `${prefix}Please check ${label.toLowerCase()}.`;
}

/** Preserve business errors and display each validation error separately. */
export function getSubmissionErrors(message: unknown): string[] {
  const messages = (Array.isArray(message) ? message : [message])
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map(formatMessage);
  return messages.length ? [...new Set(messages)] : [FALLBACK];
}
