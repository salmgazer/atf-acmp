import { z } from "zod";

export const createTeamSchema = z.object({
  name: z.string().min(3, "Team name must be at least 3 characters").max(50),
  description: z.string().max(500).optional(),
  cohortId: z.string().uuid(),
});

export const updateTeamSchema = z.object({
  name: z.string().min(3).max(50).optional(),
  description: z.string().max(500).optional(),
});

export const joinTeamSchema = z.object({
  inviteCode: z.string().length(8, "Invalid invite code"),
});

export const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["lead", "co_lead", "member"]),
});

export const selectBriefSchema = z.object({
  briefId: z.string().uuid(),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type JoinTeamInput = z.infer<typeof joinTeamSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type SelectBriefInput = z.infer<typeof selectBriefSchema>;
