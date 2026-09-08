import { z } from "zod";

export const participantOnboardingSchema = z.object({
  skills: z.array(z.string()).min(1, "Select at least one skill"),
  institution: z.string().optional(),
  phoneNumber: z.string().optional(),
});

export const updateParticipantProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  institution: z.string().optional(),
  phoneNumber: z.string().optional(),
  skills: z.array(z.string()).optional(),
});

export const bulkImportParticipantSchema = z.object({
  participantId: z.string().min(1),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  country: z.string().length(2),
  institution: z.string().optional(),
});

export type ParticipantOnboardingInput = z.infer<typeof participantOnboardingSchema>;
export type UpdateParticipantProfileInput = z.infer<typeof updateParticipantProfileSchema>;
export type BulkImportParticipantInput = z.infer<typeof bulkImportParticipantSchema>;
