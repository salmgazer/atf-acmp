import type { ParticipantLearningProfile } from "@acmp/shared";

export function LearningProfile({ profile }: { profile: ParticipantLearningProfile }) {
  const entries: [string, string | boolean | null | undefined][] = [
    ["LMS email", profile.lmsEmail], ["WhatsApp", profile.whatsappNumber], ["City", profile.city], ["Location type", profile.locationType], ["Gender", profile.gender],
    ["Education level", profile.educationLevel], ["Current affiliation", profile.currentAffiliation], ["Field of study", profile.fieldOfStudy], ["Python skill", profile.pythonSkill],
    ["Git skill", profile.gitSkill], ["AI experience", profile.aiExperience], ["GitHub username", profile.githubUsername],
    ["Halfway reached", profile.learningHalfwayReached], ["All lessons finished", profile.learningFinishedAllLessons], ["Learning certificate issued", profile.learningCertificateIssued],
    ["Learning certificate ID", profile.learningCertificateId], ["Learning certificate date", profile.learningCertificateDate],
  ];
  if (!entries.some(([, value]) => value !== undefined && value !== null && value !== "")) return null;
  return <section className="space-y-4 rounded-xl border border-border bg-card p-6"><div><h2 className="text-lg font-semibold">Learning programme and imported profile</h2><p className="text-sm text-muted-foreground">Learning completion is recorded separately from ACMP practice progress.</p></div><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{entries.map(([name, value]) => <div key={name}><dt className="text-sm text-muted-foreground">{name}</dt><dd className="break-words text-sm font-medium">{value === null || value === undefined || value === "" ? "Not provided" : typeof value === "boolean" ? value ? "Yes" : "No" : value}</dd></div>)}</dl></section>;
}
