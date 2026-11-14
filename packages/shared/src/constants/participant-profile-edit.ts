/** Participant self-service exclusions; staff corrections use a separate endpoint. */
export const PARTICIPANT_SELF_READ_ONLY_FIELDS = [
  "firstName", "lastName", "age", "dateOfBirth", "institution", "educationLevel", "fieldOfStudy", "gender",
  "phoneNumber", "whatsappNumber", "email", "lmsEmail", "certificateId", "learningCertificateId",
] as const;
export const PARTICIPANT_SELF_PROFILE_FIELDS = ["country", "city", "locationType", "currentAffiliation", "pythonSkill", "gitSkill", "aiExperience", "githubUsername", "skills", "interests"] as const;
export const isParticipantReadOnlyField = (field: string) => PARTICIPANT_SELF_READ_ONLY_FIELDS.some(value => value === field);
