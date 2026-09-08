import { z } from "zod";

export const cohortDeadlinesSchema = z.object({
  registrationEnd: z.string().datetime(),
  teamFormationEnd: z.string().datetime(),
  stage1End: z.string().datetime(),
  stage2End: z.string().datetime(),
  stage3End: z.string().datetime(),
  demoDay: z.string().datetime(),
});

export const rubricCriteriaSchema = z.object({
  name: z.string().min(1),
  weight: z.number().min(0).max(100),
  description: z.string(),
});

export const createCohortSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  description: z.string().optional(),
  teamSizeMin: z.number().int().min(2).max(10).default(3),
  teamSizeMax: z.number().int().min(2).max(10).default(5),
  deadlines: cohortDeadlinesSchema,
  countries: z.array(z.string()).min(1, "Select at least one country"),
  verticals: z.array(z.string()).min(1, "Select at least one vertical"),
  briefCap: z.number().int().min(1).default(50),
  maxTeamsPerBrief: z.number().int().min(1).default(25),
  rubric: z.object({ criteria: z.array(rubricCriteriaSchema) }).optional(),
});

export const updateCohortSchema = createCohortSchema.partial();

export type CreateCohortInput = z.infer<typeof createCohortSchema>;
export type UpdateCohortInput = z.infer<typeof updateCohortSchema>;
