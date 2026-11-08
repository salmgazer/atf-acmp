import { EntityManager, In } from "typeorm";
import { BadRequestException } from "@nestjs/common";
import { Cohort } from "@/database/entities/cohort.entity";
import { Stage } from "@/database/entities/stage.entity";

export async function resolveCohortTeamDeadlines(manager: EntityManager, cohort: Cohort) {
  const ids = [...new Set([cohort.teamJoiningStageId, cohort.learningCertificationStageId].filter(Boolean))] as string[];
  const stages = ids.length ? await manager.find(Stage, { where: { id: In(ids), cohortId: cohort.id } }) : [];
  const joining = stages.find(stage => stage.id === cohort.teamJoiningStageId), certification = stages.find(stage => stage.id === cohort.learningCertificationStageId);
  cohort.teamRuleDeadlines = { joining: joining?.deadline.toISOString() || null, certification: certification?.deadline.toISOString() || null };
  cohort.teamRuleDeadlineVersion = JSON.stringify([cohort.teamJoiningStageId || null, cohort.learningCertificationStageId || null,
    ...stages.sort((a, b) => a.id.localeCompare(b.id)).map(stage => [stage.id, stage.deadline.toISOString(), stage.updatedAt.toISOString()])]);
  return cohort.teamRuleDeadlines;
}
export async function validateCohortDeadlineStages(manager: EntityManager, cohort: Cohort) {
  await resolveCohortTeamDeadlines(manager, cohort);
  if ((cohort.teamJoiningStageId && !cohort.teamRuleDeadlines?.joining) || (cohort.learningCertificationStageId && !cohort.teamRuleDeadlines?.certification)) throw new BadRequestException("Select deadline stages belonging to this cohort");
  if (cohort.teamRuleDeadlines?.joining && cohort.teamRuleDeadlines.certification && Date.parse(cohort.teamRuleDeadlines.joining) > Date.parse(cohort.teamRuleDeadlines.certification)) throw new BadRequestException("The learning-certification stage deadline cannot precede the team-joining stage deadline");
}
