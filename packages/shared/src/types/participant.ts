export interface ParticipantLearningProfile {
  programmeOptedOut?: boolean;
  programmeOptedOutAt?: string | null;
  programmeOptOutReason?: string | null;
  codeLabsCompleted?: boolean;
  codeLabsVerifiedAt?: string | null;
  codeLabsVerifiedBy?: string | null;
  lmsEmail?: string | null;
  whatsappNumber?: string | null;
  city?: string | null;
  locationType?: string | null;
  gender?: string | null;
  educationLevel?: string | null;
  currentAffiliation?: string | null;
  fieldOfStudy?: string | null;
  pythonSkill?: string | null;
  gitSkill?: string | null;
  aiExperience?: string | null;
  githubUsername?: string | null;
  githubAccountStatus?: "has_account" | "no_account" | null;
  profileConfirmedAt?: string | null;
  learningCertificateIssued?: boolean | null;
  learningCertificateId?: string | null;
  learningCertificateDate?: string | null;
  learningFinishedAllLessons?: boolean | null;
  learningHalfwayReached?: boolean | null;
  learningImportedAt?: string | null;
}

export interface Participant extends ParticipantLearningProfile {
  id: string;
  participantId: string;
  email: string;
  firstName: string;
  lastName: string;
  country: string;
  institution?: string;
  phoneNumber?: string;
  skills: string[];
  firebaseUid?: string;
  mustChangePassword: boolean;
  onboardingComplete: boolean;
  cohortId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ParticipantWithTeam extends Participant {
  team?: {
    id: string;
    name: string;
    role: string;
  };
}

/** The consented profile available to other participants for team matching. */
export interface ParticipantPeerProfile {
  id: string;
  firstName: string;
  lastName: string;
  country: string;
  email?: string | null;
  phoneNumber?: string | null;
  whatsappNumber?: string | null;
  profileImageUrl?: string | null;
  institution?: string | null;
  educationLevel?: string | null;
  fieldOfStudy?: string | null;
  currentAffiliation?: string | null;
  pythonSkill?: string | null;
  gitSkill?: string | null;
  aiExperience?: string | null;
  githubUsername?: string | null;
  skills: string[];
  interests: string[];
  qualifiedBuilder: boolean;
  nonComputingStudy: boolean;
  matching: Pick<import("../constants/participant-matching").ParticipantMatchingProfile, "buildDeployAbility" | "preferredRole" | "firstChoiceSector" | "backupSector" | "teamStatus"> & { crossCountryWilling: boolean };
}
