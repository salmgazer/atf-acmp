export interface Mentor {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  company?: string;
  jobTitle?: string;
  bio?: string;
  linkedinUrl?: string;
  expertise: string[];
  verticals: string[];
  maxTeams: number;
  assignedTeamsCount: number;
  isActive: boolean;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MentorWithTeams extends Mentor {
  teams: Array<{
    id: string;
    name: string;
    vertical: string;
  }>;
}
