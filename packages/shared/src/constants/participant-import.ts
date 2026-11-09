export const PARTICIPANT_LMS_CSV_HEADERS = [
  "participant_id", "first_name", "last_name", "lms_email", "phone", "whatsapp_number", "country", "city_clean", "location_type_clean", "gender",
  "institution_name_clean", "education_level_clean", "current_affiliation_clean", "field_of_study_clean", "python_skill", "git_skill", "ai_experience", "github_username",
  "certificate", "certificate_date", "finished_all_lessons", "halfway_reached", "certificate_id",
] as const;

export const PARTICIPANT_LEARNING_FIELDS = ["learningCertificateIssued", "learningCertificateId", "learningCertificateDate", "learningFinishedAllLessons", "learningHalfwayReached"] as const;
export const PARTICIPANT_PROFILE_IMPORT_FIELDS = ["firstName", "lastName", "phoneNumber", "whatsappNumber", "institution", "city", "locationType", "gender", "educationLevel", "currentAffiliation", "fieldOfStudy", "pythonSkill", "gitSkill", "aiExperience", "githubUsername"] as const;
export const PARTICIPANT_PROGRAMME_IMPORT_FIELDS = ["programmeOptedOut", "codeLabsCompleted"] as const;
export const PARTICIPANT_IMPORT_FIELDS = [...PARTICIPANT_LEARNING_FIELDS, ...PARTICIPANT_PROFILE_IMPORT_FIELDS, ...PARTICIPANT_PROGRAMME_IMPORT_FIELDS] as const;
export type ParticipantImportField = typeof PARTICIPANT_IMPORT_FIELDS[number];
export const PARTICIPANT_IMPORT_LABELS: Record<ParticipantImportField, string> = {
  programmeOptedOut: "Programme opt-out", codeLabsCompleted: "Staff-verified CodeLabs completion",
  firstName: "First name", lastName: "Last name", phoneNumber: "Phone", whatsappNumber: "WhatsApp", institution: "Institution", city: "City", locationType: "Location type", gender: "Gender",
  educationLevel: "Education level", currentAffiliation: "Current affiliation", fieldOfStudy: "Field of study", pythonSkill: "Python skill", gitSkill: "Git skill", aiExperience: "AI experience", githubUsername: "GitHub username",
  learningCertificateIssued: "Learning certificate issued", learningCertificateId: "Learning certificate ID", learningCertificateDate: "Learning certificate date", learningFinishedAllLessons: "All learning lessons finished", learningHalfwayReached: "Halfway reached",
};
