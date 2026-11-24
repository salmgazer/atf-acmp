import { createHash } from "crypto";
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
export function proposalIsSubmitted(proposal: Submission | null | undefined, team: Team): boolean {
  return !!proposal?.submittedAt && ![SubmissionStatus.DRAFT, SubmissionStatus.REJECTED].includes(proposal.status) && proposal.content.briefId === team.briefId;
}
export function warmupIsPassed(warmup: Submission | null | undefined, stage: Stage | null | undefined, team: Team): boolean {
  const result = warmup?.feedback?.warmup;
  return !!stage && !!result?.passed && warmup?.status === SubmissionStatus.EVALUATED && !!warmup.evaluatedAt &&
    result.briefId === team.briefId && warmup.content.briefId === team.briefId && result.submissionVersion === warmup.version &&
    result.deploymentUrl === warmup.content.deploymentUrl && result.repositoryUrl === warmup.githubUrl && result.configHash === warmupConfigHash(stage);
}
export async function assertProposalSubmitted(manager: EntityManager, team: Team) {
  const stage = await manager.findOne(Stage, { where: { cohortId: team.cohortId, workflowKey: "proposal", isActive: true } });
  const proposal = stage && await manager.findOne(Submission, { where: { teamId: team.id, stageId: stage.id } });
  if (!proposalIsSubmitted(proposal, team)) throw new ForbiddenException("Submit the proposal for your current brief before starting team warmup");
}
export async function assertProposalPassed(manager: EntityManager, team: Team) {
  const stage = await manager.findOne(Stage, { where: { cohortId: team.cohortId, workflowKey: "proposal", isActive: true } });
  if (!stage) return; // Historical cohorts without the fixed workflow retain their existing access.
  const proposal = await manager.findOne(Submission, { where: { teamId: team.id, stageId: stage.id } });
  const warmupStage = await manager.findOne(Stage, { where: { cohortId: team.cohortId, workflowKey: "warmup", isActive: true } });
  if (warmupStage) {
    const warmup = await manager.findOne(Submission, { where: { teamId: team.id, stageId: warmupStage.id } });
    if (!proposalIsSubmitted(proposal, team) || !warmupIsPassed(warmup, warmupStage, team)) throw new ForbiddenException("Submit your proposal and successfully deploy and pass the team warmup before building starts");
    return;
  }
  if (!proposal?.approvedAt || ![SubmissionStatus.APPROVED, SubmissionStatus.EVALUATED].includes(proposal.status) || proposal.content.briefId !== team.briefId) throw new ForbiddenException("ATF must approve the proposal for your current brief before building starts");
}

export const warmupConfigHash = (stage: Stage) => createHash("sha256").update(JSON.stringify([stage.instructions, stage.requirements?.exerciseUrl, stage.evaluationPrompt, stage.evaluationCriteria])).digest("hex");
