import "reflect-metadata";
import { DataSource } from "typeorm";
import * as path from "path";
import { randomUUID } from "crypto";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { TEAM_BRIEF_FIELDS, PROPOSAL_FIELDS, ProgrammeField, FormAnswers, validateProgrammeForm, TeamBriefPreference } from "@acmp/shared";
import { Cohort, CohortStatus } from "@/database/entities/cohort.entity";
import { Participant, ParticipantPreference, ParticipantStatus } from "@/database/entities/participant.entity";
import { Team, TeamMember, TeamMemberStatus, TeamRole } from "@/database/entities/team.entity";
import { Brief, BriefStatus } from "@/database/entities/brief.entity";
import { Organization } from "@/database/entities/organization.entity";
import { Stage, StageType, Submission, SubmissionHistory } from "@/database/entities/stage.entity";
import { User } from "@/database/entities/user.entity";
import { TeamWorkflowService } from "@/modules/team-workflow/team-workflow.service";
import { SubmissionsService } from "@/modules/submissions/submissions.service";
import { BriefsService } from "@/modules/briefs/briefs.service";
import { BriefsController } from "@/modules/briefs/briefs.controller";
import { MentorClaimsService } from "@/modules/mentors/mentor-claims.service";
import { ResourceAccessGuard } from "@/common/guards/resource-access.guard";
import { UploadService } from "@/common/services/upload.service";
import { GitHubAnalysis } from "@/database/entities/github-analysis.entity";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { TeamWorkflowController, AdminTeamWorkflowController } from "@/modules/team-workflow/team-workflow.controller";

function completeAnswers(fields: readonly ProgrammeField[]): FormAnswers {
  return Object.fromEntries(fields.filter(field => !field.optional && !field.when).map(field => [field.name,
    field.type === "checkbox" ? true : field.type === "select" ? field.options![0] : field.type === "checks" ? [field.options![0]] : field.type === "number" ? 3
    : field.type === "milestones" ? [1, 2, 3].map(i => ({ milestone: `Milestone ${i}`, date: `2040-01-0${i}` }))
    : field.type === "indicators" ? [1, 2].map(i => ({ indicator: `Metric ${i}`, measurement: "User interviews", target: "20" }))
    : field.type === "email" ? "external@example.test" : "Example answer"]));
}
describe("ATF programme form validation", () => {
  it("restricts participant endpoints and staff review endpoints to their intended roles", () => {
    const roles = new RolesGuard(new Reflector());
    const context = (controller: any, handler: string, role: string) => ({ getClass: () => controller, getHandler: () => controller.prototype[handler], switchToHttp: () => ({ getRequest: () => ({ user: { id: randomUUID(), role } }) }) }) as any;
    for (const role of ["organization", "mentor", "viewer", "program_manager"]) expect(() => roles.canActivate(context(TeamWorkflowController, "save", role))).toThrow("Access denied");
    for (const role of ["participant", "organization", "mentor", "viewer"]) expect(() => roles.canActivate(context(AdminTeamWorkflowController, "review", role))).toThrow("Access denied");
    expect(roles.canActivate(context(AdminTeamWorkflowController, "brief", "viewer"))).toBe(true);
    expect(roles.canActivate(context(AdminTeamWorkflowController, "review", "evaluator"))).toBe(true);
    expect(() => roles.canActivate(context(AdminTeamWorkflowController, "resources", "evaluator"))).toThrow("Access denied");
  });
  it("validates conditional fields, word limits, tables, declarations and safe evidence links", () => {
    const answers = completeAnswers(PROPOSAL_FIELDS);
    answers.aiWriting = "No";
    expect(validateProgrammeForm(PROPOSAL_FIELDS, answers, true)).toEqual([]);
    expect(validateProgrammeForm(PROPOSAL_FIELDS, { ...answers, summary: "word ".repeat(101), aiWriting: "Yes", original: false, supportingLinks: "javascript:alert(1)" }, true)).toEqual(expect.arrayContaining([expect.stringContaining("100 words"), expect.stringContaining("confirmed"), expect.stringContaining("Explain how AI"), expect.stringContaining("HTTP(S)")]));
    expect(validateProgrammeForm(PROPOSAL_FIELDS, { ...answers, milestones: [{ milestone: "Bad date", date: "2040-02-31" }] }, true)).not.toEqual([]);
    expect(validateProgrammeForm(PROPOSAL_FIELDS, {}, false)).toEqual([]);
    expect(validateProgrammeForm(PROPOSAL_FIELDS, { forgedPass: true }, false)).toEqual(["Unknown field: forgedPass"]);
  });
});

const databaseUrl = process.env.ACMP_TEST_DATABASE_URL;
(databaseUrl ? describe : describe.skip)("ATF five-step workflow", () => {
  let db: DataSource, workflow: TeamWorkflowService, submissions: SubmissionsService, briefs: BriefsService;
  let cohort: Cohort, team: Team, members: Participant[], stages: Stage[];
  const notifications = { createBulk: jest.fn().mockResolvedValue(1) };
  const uploads = { validateSubmissionDocuments: jest.fn(async files => files), validateSubmissionVideo: jest.fn().mockResolvedValue(undefined) };
  const triggers = { onSubmissionNeedsApproval: jest.fn(), onSubmissionApproved: jest.fn(), onSubmissionRejected: jest.fn() };
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!/^\/acmp_regression_[a-z0-9_]+_test$/.test(url.pathname) || !["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("Disposable local regression database required");
    db = new DataSource({ type: "postgres", url: databaseUrl, entities: [path.join(__dirname, "../../src/database/entities/*.entity.ts")], migrations: [path.join(__dirname, "../../src/database/migrations/*.ts")], synchronize: false });
    await db.initialize(); await db.runMigrations();
    workflow = new TeamWorkflowService(db.getRepository(Team), uploads as any, notifications as any);
    submissions = new SubmissionsService(db.getRepository(Stage), db.getRepository(Submission), db.getRepository(SubmissionHistory), db.getRepository(Team), db.getRepository(TeamMember), db.getRepository(User), triggers as any, uploads as any);
    briefs = Object.assign(Object.create(BriefsService.prototype), { briefRepository: db.getRepository(Brief), cacheService: { buildKey: (...items: string[]) => items.join(":"), get: async () => null, set: async () => {} } });
  }, 120000);
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });
  beforeEach(async () => {
    jest.clearAllMocks();
    cohort = await db.getRepository(Cohort).save({ name: randomUUID(), status: CohortStatus.ACTIVE });
    stages = [];
    for (const [index, key] of ["team", "problem", "proposal", "evaluation", "build"].entries()) stages.push(await db.getRepository(Stage).save({ cohortId: cohort.id, workflowKey: key as any, number: index + 1, name: key, deadline: new Date("2040-02-01T23:59:00Z"), type: StageType.MIXED, isActive: true, allowLateSubmissions: false, requiresManualApproval: key === "proposal", requirements: key === "build" ? { documentRequired: true, githubRequired: true, videoRequired: true } : {} }));
    await db.getRepository(Cohort).update(cohort.id, { teamJoiningStageId: stages[0].id, learningCertificationStageId: stages[2].id });
    members = [];
    for (const index of [0, 1, 2]) {
      const person = await db.getRepository(Participant).save({ participantId: randomUUID(), firstName: "Synthetic", lastName: `Member ${index}`, email: `${randomUUID()}@example.test`, country: "Ghana", cohortId: cohort.id, status: ParticipantStatus.READY, onboardingComplete: true, learningHalfwayReached: true, learningFinishedAllLessons: true, learningCertificateIssued: true, learningCertificateId: randomUUID(), learningCertificateDate: "2026-11-01", pythonSkill: "Intermediate", fieldOfStudy: index ? "Medicine" : "Computer Science" });
      await db.getRepository(ParticipantPreference).save({ participantId: person.id, buildDeployAbility: "confident", preferredRole: index ? "sector_specialist" : "builder", firstChoiceSector: "health", matchingProfileCompletedAt: new Date(), crossCountryWilling: false } as any);
      members.push(person);
    }
    team = await db.getRepository(Team).save({ name: randomUUID(), cohortId: cohort.id, inviteCode: randomUUID().slice(0, 8), registeredAt: new Date(), competitionCountry: "Ghana", briefPreference: TeamBriefPreference.OWN, githubRepoUrl: "https://github.com/example/project" });
    for (const [index, person] of members.entries()) await db.getRepository(TeamMember).save({ teamId: team.id, participantId: person.id, role: index ? TeamRole.MEMBER : TeamRole.LEAD, status: TeamMemberStatus.CONFIRMED });
  });
  const briefAnswers = () => ({ ...completeAnswers(TEAM_BRIEF_FIELDS), hasOrganization: "No", country: "Ghana", q1: "judgement", q2: "good_records", q3: "hard", q4: "yes", q5: "clear", q6: "very_often", contactSupport: "Yes", contactReviewed: "Yes", conflict: "No", shareWithTeams: false });
  async function approveBrief() {
    const own = await workflow.saveOwnBrief(members[0].id, { answers: briefAnswers(), submit: true });
    await workflow.reviewBrief(own!.id, { action: "approved", feedback: "Evidence and contact checked" }, randomUUID());
    return own!.id;
  }
  const proposalAnswers = () => ({ ...completeAnswers(PROPOSAL_FIELDS), aiWriting: "No" });
  const scores = { problem: 4, solution: 4, feasibility: 4, responsible_ai: 4, impact: 4, capacity: 4 };

  it("completes membership without a submission and locks downstream steps", async () => {
    const result = await workflow.progressForParticipant(members[0].id);
    expect(result.steps.map(step => step.completed)).toEqual([true, false, false, false, false]);
    await expect(submissions.saveDraft(members[0].id, { stageId: stages[3].id, content: {} })).rejects.toThrow("no submission form");
    await expect(submissions.saveDraft(members[0].id, { stageId: stages[2].id, content: {} })).rejects.toThrow("approved brief");
    expect(await db.getRepository(Submission).count({ where: { teamId: team.id } })).toBe(0);
  });

  it("supports community briefs without creating partner accounts, protects notes and requires the lead", async () => {
    await expect(workflow.saveOwnBrief(members[1].id, { answers: briefAnswers(), submit: true })).rejects.toThrow("team lead");
    const own = await workflow.saveOwnBrief(members[0].id, { answers: briefAnswers(), submit: true });
    expect(await db.getRepository(Brief).findOneByOrFail({ id: own!.id })).toMatchObject({ source: "team", organizationId: null, submittedByTeamId: team.id });
    await expect(workflow.saveOwnBrief(members[0].id, { answers: briefAnswers() })).rejects.toThrow("wait for ATF");
    await workflow.reviewBrief(own!.id, { action: "revision_requested", feedback: "Add stronger evidence" }, randomUUID());
    await workflow.saveOwnBrief(members[0].id, { answers: briefAnswers(), submit: true });
    expect((await workflow.briefDetails(own!.id)).history.length).toBeGreaterThan(0);
    await workflow.reviewBrief(own!.id, { action: "approved", feedback: "Contact verified" }, randomUUID());
    expect((await db.getRepository(Team).findOneByOrFail({ id: team.id })).briefId).toBe(own!.id);
    const manager = Object.assign(Object.create(MentorClaimsService.prototype), { stageRepository: db.getRepository(Stage), teamRepository: db.getRepository(Team) });
    expect(await manager.isMentorClaimUnlockedForTeam(team.id, cohort.id)).toMatchObject({ unlocked: true });
    expect((await workflow.progressForParticipant(members[0].id)).steps[1].completed).toBe(true);
  });

  it("excludes private approved team briefs before pagination, statistics and direct foreign-team access", async () => {
    const briefId = await approveBrief();
    expect(await briefs.findApproved(cohort.id, undefined, undefined, members[0].id)).toEqual([]);
    expect(await briefs.findAll({ cohortId: cohort.id }, members[0].id)).toMatchObject({ total: 0, data: [] });
    expect(await briefs.getStatistics(cohort.id, undefined, members[0].id)).toMatchObject({ total: 0 });
    const foreign = await db.getRepository(Participant).save({ participantId: randomUUID(), firstName: "Other", lastName: "Participant", country: "Ghana", email: `${randomUUID()}@example.test`, cohortId: cohort.id });
    const guard = new ResourceAccessGuard(new Reflector(), db);
    const context = (participant: Participant) => ({ getClass: () => BriefsController, getHandler: () => BriefsController.prototype.findOne, switchToHttp: () => ({ getRequest: () => ({ user: { id: participant.id, role: "participant", cohortId: cohort.id }, method: "GET", params: { id: briefId }, query: {} }) }) }) as any;
    await expect(guard.canActivate(context(foreign))).rejects.toThrow("access");
    await expect(guard.canActivate(context(members[0]))).resolves.toBe(true);
    await db.getRepository(Brief).update(briefId, { shareWithTeams: true });
    expect((await briefs.findAll({}, foreign.id)).total).toBe(1);
    const visible = (await briefs.findApproved(cohort.id, undefined, undefined, foreign.id))[0];
    expect(visible).not.toHaveProperty("answers"); expect(visible).not.toHaveProperty("contactEmail");
  });

  it("allows proposal drafts before certification, but requires learning and six review scores to unlock building", async () => {
    await approveBrief();
    await db.getRepository(Participant).update(members[1].id, { learningCertificateIssued: false });
    await expect(submissions.saveDraft(members[0].id, { stageId: stages[2].id, content: { projectName: "First draft" } })).resolves.toMatchObject({ status: "draft" });
    const proposal = await submissions.submit(members[0].id, { stageId: stages[2].id, content: proposalAnswers() });
    expect(proposal).toMatchObject({ status: "pending_approval", content: { briefId: expect.any(String) } });
    expect((await workflow.progress(team.id)).steps[2].completed).toBe(false);
    await expect(submissions.approveSubmission(proposal.id, randomUUID(), {})).rejects.toThrow("certificate");
    await db.getRepository(Participant).update(members[1].id, { learningCertificateIssued: true });
    await expect(submissions.approveSubmission(proposal.id, randomUUID(), {})).rejects.toThrow("six proposal criteria");
    await submissions.evaluateSubmission(proposal.id, randomUUID(), { criterionScores: scores });
    await submissions.approveSubmission(proposal.id, randomUUID(), { approvalNotes: "Approved for building" });
    expect((await workflow.progress(team.id)).steps.map(step => step.completed)).toEqual([true, true, true, true, false]);
    const files = [{ name: "Slides.pptx", url: `https://storage.example.test/submissions/${team.id}/documents/slides.pptx`, type: "application/vnd.openxmlformats-officedocument.presentationml.presentation", size: 1000 }];
    await expect(submissions.submit(members[0].id, { stageId: stages[4].id, fileUrls: [], videoUrl: "https://storage.example.test/video.mp4", content: { acceptApacheLicense: true } })).rejects.toThrow("PowerPoint");
    const final = await submissions.submit(members[0].id, { stageId: stages[4].id, fileUrls: files, videoUrl: "https://storage.example.test/video.mp4", content: { acceptApacheLicense: true } });
    expect(final.githubUrl).toBe(team.githubRepoUrl);
    expect(uploads.validateSubmissionVideo).toHaveBeenCalledWith(expect.any(String), team.id, 100, undefined, true);
    expect((await workflow.progress(team.id)).steps[4].completed).toBe(true);
  });

  it("denies a foreign stage, wrong brief, fake completion and final submission before review", async () => {
    await approveBrief();
    await expect(submissions.saveDraft(members[1].id, { stageId: stages[2].id, content: {} })).rejects.toThrow("lead or co-lead");
    await expect(submissions.saveDraft(members[0].id, { stageId: stages[4].id, content: {} })).rejects.toThrow("approve the proposal");
    await expect(submissions.submit(members[0].id, { stageId: stages[2].id, content: { ...proposalAnswers(), briefId: randomUUID() } })).rejects.toThrow("assigned brief");
    const other = await db.getRepository(Cohort).save({ name: randomUUID() });
    const foreign = await db.getRepository(Stage).save({ cohortId: other.id, number: 3, name: "Foreign", type: StageType.MIXED, deadline: new Date("2040-01-01") });
    await expect(submissions.saveDraft(members[0].id, { stageId: foreign.id, content: {} })).rejects.toThrow("same cohort");
    await expect(submissions.submit(members[0].id, { stageId: stages[2].id, content: { ...proposalAnswers(), approved: true } })).rejects.toThrow("Unknown field");
  });

  it("requires contact verification, suitability and a represented problem country", async () => {
    await expect(workflow.saveOwnBrief(members[0].id, { answers: { ...briefAnswers(), country: "Nigeria" }, submit: true })).rejects.toThrow("member's country");
    const saved = await workflow.saveOwnBrief(members[0].id, { answers: { ...briefAnswers(), contactSupport: "Not yet asked" }, submit: true });
    await expect(workflow.reviewBrief(saved!.id, { action: "approved", feedback: "Check" }, randomUUID())).rejects.toThrow("contact");
    await workflow.reviewBrief(saved!.id, { action: "approved", feedback: "Confirmed support and answers on call", contactVerified: true }, randomUUID());
  });

  it("enforces the configured cohort window for rejected resubmissions too", async () => {
    await approveBrief();
    const proposal = await submissions.submit(members[0].id, { stageId: stages[2].id, content: proposalAnswers() });
    await submissions.rejectSubmission(proposal.id, randomUUID(), { rejectionReason: "Please revise" });
    await db.getRepository(Stage).update(stages[2].id, { deadline: new Date(Date.now() - 1000) });
    await expect(submissions.submit(members[0].id, { stageId: stages[2].id, content: proposalAnswers() })).rejects.toThrow("not open");
  });

  it("requires a fresh assessment after proposal changes and does not treat scoring as approval", async () => {
    await approveBrief();
    let proposal = await submissions.submit(members[0].id, { stageId: stages[2].id, content: proposalAnswers() });
    await submissions.evaluateSubmission(proposal.id, randomUUID(), { criterionScores: scores });
    expect((await workflow.progress(team.id)).steps[3].completed).toBe(false);
    await expect(submissions.saveDraft(members[0].id, { stageId: stages[4].id })).rejects.toThrow("approve the proposal");
    await submissions.rejectSubmission(proposal.id, randomUUID(), { rejectionReason: "Revise the scope" });
    await expect(submissions.evaluateSubmission(proposal.id, randomUUID(), { criterionScores: scores })).rejects.toThrow("Submit the current proposal");
    proposal = await submissions.submit(members[0].id, { stageId: stages[2].id, content: { ...proposalAnswers(), demoScope: "A revised, smaller prototype" } });
    expect(proposal.evaluatedAt).toBeNull(); expect(proposal.feedback).toBeNull();
    await expect(submissions.approveSubmission(proposal.id, randomUUID(), {})).rejects.toThrow("six proposal criteria");
    await submissions.evaluateSubmission(proposal.id, randomUUID(), { criterionScores: scores });
    await submissions.approveSubmission(proposal.id, randomUUID(), { approvalNotes: "Revised proposal approved" });
    expect((await workflow.progress(team.id)).steps[3].completed).toBe(true);
  });

  it("preserves the previous proposal when staff changes the assigned brief and requires new approval", async () => {
    const originalBriefId = await approveBrief();
    const proposal = await submissions.submit(members[0].id, { stageId: stages[2].id, content: proposalAnswers() });
    await submissions.evaluateSubmission(proposal.id, randomUUID(), { criterionScores: scores });
    await submissions.approveSubmission(proposal.id, randomUUID(), { approvalNotes: "Original proposal approved" });
    const organization = await db.getRepository(Organization).save({ name: "Another partner", email: `${randomUUID()}@example.test`, country: "Ghana", cohortId: cohort.id });
    const replacement = await db.getRepository(Brief).save({ title: "Replacement problem", description: "Another problem", problemStatement: "Another problem", expectedOutcomes: "Useful outcome", cohortId: cohort.id, organizationId: organization.id, problemCountry: "Ghana", status: BriefStatus.APPROVED });
    await db.getRepository(Team).update(team.id, { briefId: replacement.id, challengeStartedAt: null });
    await expect(submissions.saveDraft(members[0].id, { stageId: stages[4].id })).rejects.toThrow("approve the proposal");
    const revised = await submissions.saveDraft(members[0].id, { stageId: stages[2].id, content: { projectName: "Replacement proposal", briefId: replacement.id } });
    expect(revised).toMatchObject({ status: "draft", content: { briefId: replacement.id }, approvedAt: null });
    const history = await db.getRepository(SubmissionHistory).find({ where: { submissionId: proposal.id } });
    expect(history.some(version => version.content.briefId === originalBriefId)).toBe(true);
    expect((await workflow.progress(team.id)).steps[3].completed).toBe(false);
  });

  it("makes the consultation minimum configurable without changing fixed stage identity", async () => {
    await expect(workflow.saveOwnBrief(members[0].id, { answers: { ...briefAnswers(), consultationCount: 2 }, submit: true })).rejects.toThrow("at least 3");
    await submissions.updateStage(stages[1].id, { requirements: { minimumConsultations: 2 } });
    await expect(workflow.saveOwnBrief(members[0].id, { answers: { ...briefAnswers(), consultationCount: 2 }, submit: true })).resolves.toMatchObject({ status: "submitted" });
    await expect(submissions.updateStage(stages[1].id, { number: 7 })).rejects.toThrow("fixed steps");
    await expect(submissions.deleteStage(stages[1].id)).rejects.toThrow("cannot be deleted");
    await expect(submissions.updateStage(stages[2].id, { deadline: "2030-01-01T00:00:00Z" })).rejects.toThrow("cannot precede");
  });

  it("records resource issuance only after approval and flags fourteen days of recorded inactivity", async () => {
    await approveBrief();
    await expect(workflow.recordResourcesIssued(team.id, randomUUID())).rejects.toThrow("approve the proposal");
    const proposal = await submissions.submit(members[0].id, { stageId: stages[2].id, content: proposalAnswers() });
    await submissions.evaluateSubmission(proposal.id, randomUUID(), { criterionScores: scores });
    await submissions.approveSubmission(proposal.id, randomUUID(), { approvalNotes: "Approved" });
    const actor = randomUUID();
    const first = await workflow.recordResourcesIssued(team.id, actor);
    expect((await workflow.recordResourcesIssued(team.id, actor)).resourcesIssuedAt).toEqual(first.resourcesIssuedAt);
    expect((await db.getRepository(Team).findOneByOrFail({ id: team.id })).programmeResourcesIssuedBy).toBe(actor);
    await db.getRepository(Team).update(team.id, { challengeStartedAt: new Date(Date.now() - 15 * 86400000) });
    expect((await workflow.progress(team.id)).inactiveFor14Days).toBe(true);
    expect((await workflow.inactiveTeams(cohort.id)).map(row => row.id)).toContain(team.id);
    await db.getRepository(GitHubAnalysis).save({ teamId: team.id, githubUrl: team.githubRepoUrl!, repoFullName: "example/project", metrics: { lastPushedAt: new Date().toISOString() } as any, codeStructure: {} as any, commitPatterns: {} as any, analyzedAt: new Date() });
    expect((await workflow.progress(team.id)).inactiveFor14Days).toBe(false);
    expect(await workflow.inactiveTeams(cohort.id)).toEqual([]);
  });
});

describe("Final video format enforcement", () => {
  it("uses stored content type and team-owned object keys, not the client filename", async () => {
    const uploads = new UploadService(new ConfigService({ aws: { region: "eu-central-1", s3Bucket: "workflow-test", accessKeyId: "local", secretAccessKey: "local" } }), {} as any);
    jest.spyOn((uploads as any).s3Client, "send").mockResolvedValue({ ContentLength: 1000, ContentType: "video/webm" });
    await expect(uploads.validateSubmissionVideo("https://workflow-test.s3.eu-central-1.amazonaws.com/submissions/team/videos/demo.mp4", "team", 100, undefined, true)).rejects.toThrow("MP4");
    await expect(uploads.validateSubmissionVideo("https://external.example.test/demo.mp4", "team", 100, undefined, true)).rejects.toThrow("Upload an MP4");
  });
});
