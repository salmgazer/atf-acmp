import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { Stage, Submission, SubmissionStatus } from "@/database/entities/stage.entity";
import { Team } from "@/database/entities/team.entity";
import { teamRuleContext } from "./team-rules";

export const isPoolBrief = (brief: { source?: string; shareWithTeams?: boolean }) => brief.source !== "team" || brief.shareWithTeams === true;
export async function assertProblemChosen(manager: EntityManager, teamId: string) {
  const context = await teamRuleContext(manager, teamId);
  if (context.team.status === "disqualified") throw new ForbiddenException("Disqualified teams cannot progress");
  if (!context.team.briefId || context.team.brief?.status !== "approved") throw new BadRequestException("An approved brief must be assigned before continuing");
  if (!context.team.registeredAt) throw new BadRequestException("Register your team before continuing");
  return context;
}
export async function assertProposalPassed(manager: EntityManager, team: Team) {
  const stage = await manager.findOne(Stage, { where: { cohortId: team.cohortId, workflowKey: "proposal", isActive: true } });
  if (!stage) return; // Historical cohorts without the fixed workflow retain their existing access.
  const proposal = await manager.findOne(Submission, { where: { teamId: team.id, stageId: stage.id } });
  if (!proposal?.approvedAt || ![SubmissionStatus.APPROVED, SubmissionStatus.EVALUATED].includes(proposal.status) || proposal.content.briefId !== team.briefId) throw new ForbiddenException("ATF must approve the proposal for your current brief before building starts");
}
