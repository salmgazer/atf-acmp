import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TEAM_WORKFLOW_STEPS, TEAM_BRIEF_FIELDS, validateProgrammeForm, fieldVisible, normalizeTeamCountry, TeamBriefPreference } from "@acmp/shared";
import { BriefContact } from "@/database/entities/brief-contact.entity";
import { CacheService, CACHE_KEYS } from "@/common/cache/cache.service";
import { Team, TeamMember, TeamMemberStatus, TeamRole, TeamStatus } from "@/database/entities/team.entity";
import { Brief, BriefStatus, calculateBriefScores } from "@/database/entities/brief.entity";
import { TeamBriefDetails } from "@/database/entities/team-brief-details.entity";
import { Stage, Submission } from "@/database/entities/stage.entity";
import { Vertical } from "@/database/entities/vertical.entity";
import { GitHubAnalysis } from "@/database/entities/github-analysis.entity";
import { assertProposalPassed } from "@/common/services/team-workflow";
import { JournalEntry } from "@/database/entities/journal.entity";
import { teamRuleContext } from "@/common/services/team-rules";
import { UploadService } from "@/common/services/upload.service";
import { afterCommit, Transactional } from "@/common/decorators/transactional.decorator";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationRecipientType, NotificationType } from "@/database/entities/notification.entity";
import { User, Role } from "@/database/entities/user.entity";
import { ReviewTeamBriefDto, SaveTeamBriefDto } from "./team-workflow.dto";

@Injectable()
export class TeamWorkflowService {
  constructor(@InjectRepository(Team) private readonly teams: Repository<Team>, private readonly uploads: UploadService,
    private readonly notifications: NotificationsService, @Optional() private readonly cache?: CacheService) {}
  private get manager() { return this.teams.manager; }

  async membership(participantId: string, leadOnly = false) {
    const member = participantId ? await this.manager.findOne(TeamMember, { where: { participantId, status: TeamMemberStatus.CONFIRMED } }) : null;
    if (!member || (leadOnly && member.role !== TeamRole.LEAD)) throw new ForbiddenException(leadOnly ? "Only the confirmed team lead can submit a team brief" : "Join a confirmed team first");
    return member;
  }

  async progressForParticipant(participantId: string) {
    const member = await this.manager.findOne(TeamMember, { where: { participantId, status: TeamMemberStatus.CONFIRMED } });
    if (!member) return { team: null, steps: TEAM_WORKFLOW_STEPS.map(step => ({ ...step, completed: false, status: step.key === "team" ? "available" : "locked" })), canEdit: false, canSubmitOwnBrief: false };
    return { ...await this.progress(member.teamId), canEdit: [TeamRole.LEAD, TeamRole.CO_LEAD].includes(member.role), canSubmitOwnBrief: member.role === TeamRole.LEAD };
  }

  async progress(teamId: string) {
    const { team, members, report } = await teamRuleContext(this.manager, teamId);
    const stages = await this.manager.find(Stage, { where: { cohortId: team.cohortId }, order: { number: "ASC" } });
    const submissions = await this.manager.find(Submission, { where: { teamId } });
    const proposal = submissions.find(submission => stages.find(stage => stage.id === submission.stageId)?.workflowKey === "proposal");
    const final = submissions.find(submission => stages.find(stage => stage.id === submission.stageId)?.workflowKey === "build");
    const ownBrief = await this.manager.findOne(Brief, { where: { submittedByTeamId: teamId, source: "team" } });
    const problemChosen = !!team.registeredAt && !!team.briefId && team.brief?.status === BriefStatus.APPROVED;
    const proposalSubmitted = !!proposal?.submittedAt && proposal.status !== "draft" && proposal.status !== "rejected" && proposal.content.briefId === team.briefId;
    const learningComplete = !report.challengeIssues.some(issue => ["certificate", "certificate_date", "certificate_deadline"].includes(issue.code)) && members.every(member => member.learningFinishedAllLessons && member.learningCertificateIssued && member.learningCertificateId?.trim());
    const passed = !!proposal?.approvedAt && ["approved", "evaluated"].includes(proposal.status) && proposal.content.briefId === team.briefId;
    const completed = [true, problemChosen, proposalSubmitted && learningComplete, passed, !!final?.submittedAt && final.content.briefId === team.briefId && !["draft", "rejected"].includes(final.status)];
    const lastJournal = await this.manager.findOne(JournalEntry, { where: { teamId }, order: { updatedAt: "DESC" } });
    const analysis = await this.manager.findOne(GitHubAnalysis, { where: { teamId }, order: { analyzedAt: "DESC" } });
    const lastPush = Date.parse(analysis?.metrics?.lastPushedAt || "");
    const activity = Math.max(stages.find(stage => stage.workflowKey === "build")?.startDate?.getTime() || 0, Number.isFinite(lastPush) ? lastPush : 0, team.challengeStartedAt?.getTime() || 0, lastJournal?.updatedAt.getTime() || 0,
      ...submissions.filter(item => stages.find(stage => stage.id === item.stageId)?.workflowKey === "build").map(item => (item.lastSavedAt || item.updatedAt).getTime()));
    return {
      team: { id: team.id, name: team.name, briefId: team.briefId, briefTitle: team.brief?.title, briefPreference: team.briefPreference, registered: !!team.registeredAt, githubRepoUrl: team.githubRepoUrl },
      ownBrief: ownBrief ? { id: ownBrief.id, title: ownBrief.title, status: ownBrief.status, reviewFeedback: ownBrief.reviewFeedback } : null,
      resourcesIssuedAt: team.programmeResourcesBriefId === team.briefId ? team.programmeResourcesIssuedAt : null,
      learningComplete, eligibilityIssues: report.challengeIssues,
      inactiveFor14Days: passed && report.canStartChallenge && !final?.submittedAt && activity > 0 && Date.now() - activity >= 14 * 86400000,
      lastBuildActivityAt: activity ? new Date(activity).toISOString() : null,
      steps: TEAM_WORKFLOW_STEPS.map((step, index) => {
        const stage = stages.find(item => item.workflowKey === step.key);
        return { ...step, stageId: stage?.id, startDate: stage?.startDate, deadline: stage?.deadline, completed: completed[index],
          status: completed[index] ? "completed" : (step.key === "build" && !report.canStartChallenge) || (index > 0 && !completed[index - 1]) ? "locked" : step.key === "evaluation" ? "awaiting_review" : "available" };
      }),
      proposal: proposal ? { id: proposal.id, status: proposal.status, score: proposal.score, approvalNotes: proposal.approvalNotes, rejectionReason: proposal.rejectionReason, evaluationNotes: proposal.evaluationNotes } : null,
    };
  }

  async ownBrief(participantId: string) {
    const member = await this.membership(participantId);
    const brief = await this.manager.findOne(Brief, { where: { submittedByTeamId: member.teamId, source: "team" } });
    if (!brief) return null;
    const details = await this.manager.findOne(TeamBriefDetails, { where: { briefId: brief.id } });
    return { id: brief.id, status: brief.status, reviewFeedback: brief.reviewFeedback, answers: details?.answers || {}, fileUrls: details?.fileUrls || [] };
  }

  @Transactional()
  async saveOwnBrief(participantId: string, dto: SaveTeamBriefDto) {
    const member = await this.membership(participantId, true);
    await this.manager.query("SELECT id FROM teams WHERE id=$1 FOR UPDATE", [member.teamId]);
    await this.membership(participantId, true);
    const { team, members } = await teamRuleContext(this.manager, member.teamId);
    if (team.status === TeamStatus.DISQUALIFIED || team.briefPreference !== TeamBriefPreference.OWN) throw new BadRequestException("Choose the own-brief route for an eligible team first");
    const stage = await this.manager.findOne(Stage, { where: { cohortId: team.cohortId, workflowKey: "problem" } });
    if (!stage || !stage.isOpen()) throw new BadRequestException("The problem-selection window is closed; contact staff");
    let brief = await this.manager.findOne(Brief, { where: { submittedByTeamId: team.id, source: "team" } });
    if (brief && ![BriefStatus.DRAFT, BriefStatus.REVISION_REQUESTED, BriefStatus.REJECTED].includes(brief.status)) throw new BadRequestException("This brief has been submitted; wait for ATF's review");
    if (team.briefId) throw new BadRequestException("Ask staff to unassign the current brief before replacing it");
    const errors = validateProgrammeForm(TEAM_BRIEF_FIELDS, dto.answers, !!dto.submit);
    const answers = { ...(dto.answers || {}) };
    for (const field of TEAM_BRIEF_FIELDS) if (!fieldVisible(field, answers)) delete answers[field.name];
    if (dto.submit) {
      if (Number(answers.consultationCount) < (stage.requirements.minimumConsultations ?? 3)) errors.push(`Speak to at least ${stage.requirements.minimumConsultations ?? 3} affected people or people working on this problem`);
      if (!team.registeredAt) errors.push("Register your team before submitting its brief");
      if (!members.some(person => normalizeTeamCountry(person.country) === answers.country)) errors.push("The problem country must be a confirmed member's country");
      if (members.some(person => person.email.trim().toLowerCase() === String(answers.contactEmail).trim().toLowerCase())) errors.push("The real-world contact must not be a team member");
    }
    if (errors.length) throw new BadRequestException(errors.join("; "));
    const files = await this.uploads.validateSubmissionDocuments(dto.fileUrls || [], team.id);
    if (!brief) brief = this.manager.create(Brief, { source: "team", submittedByTeamId: team.id, cohortId: team.cohortId, title: "Untitled team brief", description: "", problemStatement: "", expectedOutcomes: "", status: BriefStatus.DRAFT });
    for (const key of ["title", "description", "problemStatement", "expectedOutcomes", "dataDescription", "dataAccess"] as const) if (typeof answers[key] === "string") brief[key] = String(answers[key]);
    brief.problemCountry = typeof answers.country === "string" ? answers.country : null;
    brief.affectedCount = String(answers.affected || ""); brief.whatChanges = brief.expectedOutcomes;
    brief.shareWithTeams = answers.shareWithTeams === true;
    brief.scoringAnswers = Object.fromEntries(["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"].filter(key => typeof answers[key] === "string").map(key => [key, answers[key]]));
    if (dto.submit) {
      const sector = String(answers.sector === "Other" ? answers.otherSector : answers.sector).trim();
      // Serialize sector creation across team and import requests using the unique key.
      const aliases: Record<string, string> = { healthcare: "health", "legal services": "legal", "local government (mmda)": "public service" };
      const normalized = (name: string) => aliases[name.toLowerCase()] || name.toLowerCase();
      const verticals = await this.manager.find(Vertical, { where: { cohortId: team.cohortId } });
      let vertical = verticals.find(item => normalized(item.name) === normalized(sector));
      if (!vertical) {
        await this.manager.createQueryBuilder().insert().into(Vertical).values({ name: sector, cohortId: team.cohortId }).orIgnore().execute();
        vertical = (await this.manager.findOne(Vertical, { where: { cohortId: team.cohortId, name: sector } }))!;
      }
      brief.verticalId = vertical.id;
      const scores = calculateBriefScores({ ...brief.scoringAnswers, q2: answers.q2 === "public_data" ? "good_records" : answers.q2 === "collectable" ? "partial" : String(answers.q2) });
      Object.assign(brief, scores, { priorityScore: scores.fitScore, status: BriefStatus.SUBMITTED, submittedAt: new Date() });
    }
    brief = await this.manager.save(brief);
    if (dto.submit) {
      await this.manager.delete(BriefContact, { briefId: brief.id });
      await this.manager.save(BriefContact, this.manager.create(BriefContact, { briefId: brief.id, name: String(answers.contactName).trim(), email: String(answers.contactEmail).trim().toLowerCase(), role: String(answers.contactRole), phone: String(answers.contactPhone), isPrimary: true }));
    }
    let details = await this.manager.findOne(TeamBriefDetails, { where: { briefId: brief.id } });
    if (!details) details = this.manager.create(TeamBriefDetails, { briefId: brief.id });
    if (details.id) details.history = [...(details.history || []), { answers: details.answers, fileUrls: details.fileUrls, savedAt: new Date().toISOString(), actorId: participantId, status: brief.status }];
    Object.assign(details, { answers, fileUrls: files, submittedBy: participantId, contactVerifiedByStaff: false });
    await this.manager.save(details);
    if (dto.submit) {
      const staff = await this.manager.find(User, { where: [{ role: Role.SUPER_ADMIN, isActive: true }, { role: Role.PROGRAM_MANAGER, isActive: true }], select: ["id"] });
      afterCommit(this, () => this.notifications.createBulk({ recipientIds: staff.map(person => person.id), recipientType: NotificationRecipientType.USER, type: NotificationType.BRIEF_SUBMITTED,
        title: "Team brief awaiting review", body: `${team.name} submitted “${brief!.title}”`, actionUrl: `/staff/briefs/${brief!.id}` }));
    }
    return this.ownBrief(participantId);
  }

  @Transactional()
  async recordResourcesIssued(teamId: string, actorId: string) {
    await this.manager.query("SELECT id FROM teams WHERE id=$1 FOR UPDATE", [teamId]);
    const { team, report } = await teamRuleContext(this.manager, teamId);
    await assertProposalPassed(this.manager, team);
    if (!report.canStartChallenge) throw new BadRequestException("The team no longer meets build eligibility checks");
    if (!team.programmeResourcesIssuedAt || team.programmeResourcesBriefId !== team.briefId) await this.manager.update(Team, teamId, { programmeResourcesIssuedAt: new Date(), programmeResourcesIssuedBy: actorId, programmeResourcesBriefId: team.briefId });
    return this.progress(teamId);
  }

  async inactiveTeams(cohortId: string) {
    const candidates = await this.manager.query(`SELECT t.id, t.name, GREATEST(t.challenge_started_at,
      (SELECT max(j.updated_at) FROM journal_entries j WHERE j.team_id=t.id AND j.deleted_at IS NULL),
      (SELECT max(x.updated_at) FROM submissions x JOIN stages s ON s.id=x.stage_id WHERE x.team_id=t.id AND s.workflow_key='build' AND x.deleted_at IS NULL)) AS "lastActivityAt"
      FROM teams t JOIN stages p ON p.cohort_id=t.cohort_id AND p.workflow_key='proposal' AND p.deleted_at IS NULL
      JOIN submissions proposal ON proposal.team_id=t.id AND proposal.stage_id=p.id AND proposal.approved_at IS NOT NULL AND proposal.deleted_at IS NULL
      WHERE t.cohort_id=$1 AND t.deleted_at IS NULL AND t.status='active' AND proposal.content->>'briefId'=t.brief_id::text
      AND NOT EXISTS(SELECT 1 FROM submissions x JOIN stages s ON s.id=x.stage_id WHERE x.team_id=t.id AND s.workflow_key='build' AND x.submitted_at IS NOT NULL AND x.status<>'rejected' AND x.deleted_at IS NULL)
      AND GREATEST(t.challenge_started_at, (SELECT max(j.updated_at) FROM journal_entries j WHERE j.team_id=t.id AND j.deleted_at IS NULL),
      (SELECT max(x.updated_at) FROM submissions x JOIN stages s ON s.id=x.stage_id WHERE x.team_id=t.id AND s.workflow_key='build' AND x.deleted_at IS NULL)) < now()-interval '14 days'`, [cohortId]);
    const checked = await Promise.all(candidates.map(async (team: { id: string; name: string }) => ({ team, progress: await this.progress(team.id) })));
    return checked.filter(item => item.progress.inactiveFor14Days).map(item => ({ ...item.team, lastActivityAt: item.progress.lastBuildActivityAt }));
  }

  async briefDetails(briefId: string) {
    const details = await this.manager.findOne(TeamBriefDetails, { where: { briefId } });
    if (!details) throw new NotFoundException("Team brief details not found");
    const brief = await this.manager.findOneByOrFail(Brief, { id: briefId });
    const problem = await this.manager.findOne(Stage, { where: { cohortId: brief.cohortId, workflowKey: "problem" } });
    return Object.assign(details, { minimumConsultations: problem?.requirements.minimumConsultations ?? 3 });
  }

  @Transactional()
  async reviewBrief(briefId: string, dto: ReviewTeamBriefDto, reviewerId: string) {
    let brief = await this.manager.findOne(Brief, { where: { id: briefId, source: "team" } });
    if (!brief?.submittedByTeamId) throw new NotFoundException("Team brief not found");
    // Match participant-save and assignment lock order: team, then brief.
    await this.manager.query("SELECT id FROM teams WHERE id=$1 FOR UPDATE", [brief.submittedByTeamId]);
    await this.manager.query("SELECT id FROM briefs WHERE id=$1 FOR UPDATE", [briefId]);
    brief = (await this.manager.findOne(Brief, { where: { id: briefId } }))!;
    if (![BriefStatus.SUBMITTED, BriefStatus.IN_REVIEW].includes(brief.status)) throw new BadRequestException("This brief is not awaiting review");
    if (!dto.feedback.trim()) throw new BadRequestException("A review reason is required");
    const details = await this.briefDetails(briefId);
    const { team, members } = await teamRuleContext(this.manager, brief.submittedByTeamId!);
    if (dto.action === "approved") {
      const errors = validateProgrammeForm(TEAM_BRIEF_FIELDS, details.answers, true);
      if (Number(details.answers.consultationCount) < details.minimumConsultations) errors.push(`At least ${details.minimumConsultations} real-world consultations are required`);
      if (!(details.answers.contactSupport === "Yes" && details.answers.contactReviewed === "Yes") && !dto.contactVerified) errors.push("The contact must support the team and verify the answers, or staff must confirm verification on a call");
      if ((brief.fitScore ?? 0) < 45 || brief.scoreOverride) errors.push("The brief does not meet the suitability threshold; request changes or decline with feedback");
      if (team.status === TeamStatus.DISQUALIFIED || team.briefPreference !== TeamBriefPreference.OWN || (team.briefId && team.briefId !== briefId)) errors.push("The originating team is no longer eligible for this brief");
      if (!members.some(person => normalizeTeamCountry(person.country) === brief.problemCountry)) errors.push("The problem country must still be represented on the team");
      if (errors.length) throw new BadRequestException(errors.join("; "));
      brief.approvedAt = new Date();
      await this.manager.update(Brief, briefId, { status: BriefStatus.APPROVED, approvedAt: brief.approvedAt });
      await this.manager.update(Team, team.id, { briefId, competitionCountry: brief.problemCountry!, challengeStartedAt: null, status: TeamStatus.FORMING });
      brief.teamsCount = 1;
      if (brief.verticalId) await this.manager.increment(Vertical, { id: brief.verticalId }, "briefCount", 1);
    }
    details.history = [...(details.history || []), { action: dto.action, feedback: dto.feedback.trim(), reviewerId, reviewedAt: new Date().toISOString(), contactVerified: dto.contactVerified === true }];
    brief.status = dto.action as BriefStatus; brief.reviewFeedback = dto.feedback.trim(); brief.reviewedBy = reviewerId; brief.reviewedAt = new Date();
    details.contactVerifiedByStaff = dto.contactVerified === true;
    await this.manager.save(details); await this.manager.save(brief);
    afterCommit(this, () => this.notifications.createBulk({ recipientIds: members.map(person => person.id), recipientType: NotificationRecipientType.PARTICIPANT, type: NotificationType.BRIEF_STATUS_CHANGED,
      title: `Team brief ${dto.action.replace(/_/g, " ")}`, body: dto.feedback.trim(), actionUrl: "/participant/submissions" }));
    afterCommit(this, () => this.cache?.del(this.cache.buildKey(CACHE_KEYS.BRIEFS_BY_COHORT, brief!.cohortId, "approved-pool-v2")));
    return brief;
  }
}
