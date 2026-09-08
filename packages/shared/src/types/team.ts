export type TeamStatus = "forming" | "active" | "submitted" | "evaluated" | "disqualified";

export type TeamRole = "lead" | "co_lead" | "member";

export interface Team {
  id: string;
  name: string;
  description?: string;
  status: TeamStatus;
  cohortId: string;
  briefId?: string;
  mentorId?: string;
  inviteCode: string;
  membersCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  participantId: string;
  role: TeamRole;
  joinedAt: string;
  participant?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
  };
}

export interface TeamWithMembers extends Team {
  members: TeamMember[];
}
