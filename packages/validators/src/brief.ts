import { z } from "zod";

export const briefResourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  type: z.string(),
});

export const createBriefSchema = z.object({
  title: z.string().min(10, "Title must be at least 10 characters").max(200),
  description: z.string().min(50, "Description must be at least 50 characters"),
  problemStatement: z.string().min(100, "Problem statement must be at least 100 characters"),
  expectedOutcomes: z.string().min(50, "Expected outcomes must be at least 50 characters"),
  vertical: z.string().min(1, "Select a vertical"),
  cohortId: z.string().uuid(),
  tags: z.array(z.string()).default([]),
  resources: z.array(briefResourceSchema).optional(),
  maxTeams: z.number().int().min(1).max(100).default(25),
});

export const updateBriefSchema = createBriefSchema.partial().omit({ cohortId: true });

export const reviewBriefSchema = z.object({
  status: z.enum(["approved", "rejected", "revision_requested"]),
  feedback: z.string().min(1, "Feedback is required when rejecting or requesting revision"),
});

export type CreateBriefInput = z.infer<typeof createBriefSchema>;
export type UpdateBriefInput = z.infer<typeof updateBriefSchema>;
export type ReviewBriefInput = z.infer<typeof reviewBriefSchema>;
