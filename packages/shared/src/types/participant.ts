export interface Participant {
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
