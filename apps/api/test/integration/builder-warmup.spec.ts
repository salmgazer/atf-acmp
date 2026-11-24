import "reflect-metadata";
import * as path from "path";
import { plainToInstance } from "class-transformer";
import { UpdateStageDto } from "@/modules/submissions/dto/submission.dto";
import { DataSource } from "typeorm";
import { randomUUID } from "crypto";
import { Cohort, CohortStatus } from "@/database/entities/cohort.entity";
import { Participant, ParticipantPreference, ParticipantStatus } from "@/database/entities/participant.entity";
import { Team, TeamMember, TeamRole, TeamMemberStatus } from "@/database/entities/team.entity";
import { Brief, BriefStatus } from "@/database/entities/brief.entity";
import { Stage, StageType, Submission, SubmissionHistory, SubmissionStatus } from "@/database/entities/stage.entity";
import { User } from "@/database/entities/user.entity";
import { Evaluation, EvaluationJob } from "@/database/entities/evaluation.entity";
import { ParticipantsService } from "@/modules/participants/participants.service";
import { SubmissionsService } from "@/modules/submissions/submissions.service";
import { TeamWorkflowService } from "@/modules/team-workflow/team-workflow.service";
import { EvaluationProcessor } from "@/modules/evaluations/evaluation.processor";
import { inspectWarmupDeployment, WarmupEvidenceError } from "@/modules/evaluations/warmup-deployment";
import { assertProposalPassed } from "@/common/services/team-workflow";
import { assertChallengeStarted } from "@/common/services/team-rules";
import { isQualifiedBuilder } from "@acmp/shared";
jest.mock("@/modules/evaluations/warmup-deployment", () => ({ ...jest.requireActual("@/modules/evaluations/warmup-deployment"), inspectWarmupDeployment: jest.fn() }));
const databaseUrl = process.env.ACMP_TEST_DATABASE_URL;
(databaseUrl ? describe : describe.skip)("Builder confirmation and warmup gates with PostgreSQL", () => {
  let db: DataSource, cohort: Cohort, team: Team, lead: Participant, warmup: Stage, proposalStage: Stage, proposal: Submission;
  let participants: ParticipantsService, submissions: SubmissionsService, workflow: TeamWorkflowService, processor: EvaluationProcessor;
  const ai = { isAvailable: () => true, evaluateSubmission: jest.fn() };
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!/^\/acmp_regression_[a-z0-9_]+_test$/.test(url.pathname) || !["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("Disposable local database required");
    db = await new DataSource({ type: "postgres", url: databaseUrl, entities: [path.join(__dirname, "../../src/database/entities/*.entity.ts")], migrations: [path.join(__dirname, "../../src/database/migrations/*.ts")] }).initialize(); await db.runMigrations();
    participants = Object.assign(Object.create(ParticipantsService.prototype), { participantRepository: db.getRepository(Participant), preferenceRepository: db.getRepository(ParticipantPreference) });
    submissions = new SubmissionsService(db.getRepository(Stage), db.getRepository(Submission), db.getRepository(SubmissionHistory), db.getRepository(Team), db.getRepository(TeamMember), db.getRepository(User), {} as any, { validateSubmissionDocuments: async (f: unknown) => f, validateSubmissionVideo: async () => {} } as any);
    workflow = new TeamWorkflowService(db.getRepository(Team), {} as any, {} as any);
    processor = new EvaluationProcessor(db.getRepository(Evaluation), db.getRepository(EvaluationJob), db.getRepository(Submission), db.getRepository(Team), db.getRepository(Stage), ai as any, {} as any, {} as any);
  }, 120000);
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });
  beforeEach(async () => {
    jest.clearAllMocks();
    (inspectWarmupDeployment as jest.Mock).mockResolvedValue({ url: "https://warmup.example.test/", html: "<html><main>Todo app</main></html>" });
    ai.evaluateSubmission.mockResolvedValue({ scores: [{ criterionId: "warmup_web_app", score: 1, maxScore: 1, weight: 100, feedback: "Source and deployment support the app" }], overallScore: 100, feedback: "Warmup evidence passed", strengths: [], improvements: [] });
    jest.spyOn(processor as any, "analyzeGitHub").mockResolvedValue({ repoUrl: "https://github.com/example/warmup", sampleCode: ["function TodoApp() { return <main>Tasks</main> }"], languages: ["TypeScript"], commits: [], fileCount: 3, totalLines: 0 });
    cohort = await db.getRepository(Cohort).save({ name: randomUUID(), status: CohortStatus.ACTIVE });
    const stages: Stage[] = [];
    for (const [i, key] of ["team", "problem", "proposal", "warmup", "evaluation", "build"].entries()) stages.push(await db.getRepository(Stage).save({ cohortId: cohort.id, workflowKey: key as any, number: i + 1, name: key, type: StageType.MIXED, deadline: new Date("2040-12-01T23:59Z"), isActive: true, allowLateSubmissions: false, requiresManualApproval: false, requiresAiEvaluation: key === "warmup", requirements: key === "warmup" ? { exerciseUrl: "https://atf.example.test/warmup" } : {} }));
    warmup = stages[3]; proposalStage = stages[2];
    await db.getRepository(Cohort).update(cohort.id, { teamJoiningStageId: stages[0].id, learningCertificationStageId: stages[2].id });
    const brief = await db.getRepository(Brief).save({ title: "Synthetic challenge", description: "Test problem", problemStatement: "Synthetic problem statement", expectedOutcomes: "A working demonstration", dataDescription: "Synthetic data", cohortId: cohort.id, problemCountry: "Ghana", status: BriefStatus.APPROVED });
    team = await db.getRepository(Team).save({ name: randomUUID(), cohortId: cohort.id, inviteCode: randomUUID(), briefId: brief.id, competitionCountry: "Ghana", registeredAt: new Date() });
    for (const i of [0, 1, 2]) {
      const p = await db.getRepository(Participant).save({ participantId: randomUUID(), email: `${randomUUID()}@example.test`, firstName: "Synthetic", lastName: "Learner", cohortId: cohort.id, country: "Ghana", fieldOfStudy: i === 1 ? "Medicine" : "Computer Science", status: ParticipantStatus.ASSIGNED, mustChangePassword: false, onboardingComplete: true, learningHalfwayReached: true, learningFinishedAllLessons: true, learningCertificateIssued: true, learningCertificateId: randomUUID(), learningCertificateDate: "2026-11-01", preferredLanguage: "TypeScript", languageProficiency: "Beginner", developmentExperience: i === 0, testingExperience: i === 0, deploymentExperience: i === 0, builderConfirm: false });
      if (!i) lead = p;
      await db.getRepository(ParticipantPreference).save({ participantId: p.id, matchingProfileCompletedAt: new Date(), preferredRole: i === 0 ? "builder" : "sector_specialist", crossCountryWilling: false });
      await db.getRepository(TeamMember).save({ teamId: team.id, participantId: p.id, role: i ? TeamRole.MEMBER : TeamRole.LEAD, status: TeamMemberStatus.CONFIRMED });
    }
    proposal = await db.getRepository(Submission).save({ teamId: team.id, stageId: proposalStage.id, status: SubmissionStatus.SUBMITTED, submittedAt: new Date(), content: { briefId: team.briefId } });
  });
  const answers = () => ({ preferredLanguage: "Other", otherLanguage: "Elixir", languageProficiency: "Beginner", developmentExperience: true, testingExperience: true, deploymentExperience: true });
  const payload = () => ({ stageId: warmup.id, content: { deploymentUrl: "https://warmup.example.test/", repositoryUrl: "https://github.com/example/warmup" } });
  async function evaluate() {
    const job = await db.getRepository(EvaluationJob).findOneOrFail({ where: { teamId: team.id }, order: { createdAt: "DESC" } });
    await processor.process({ id: job.id, data: { teamId: team.id, stageId: warmup.id, cohortId: cohort.id, evaluationJobId: job.id }, attemptsMade: 0, opts: { attempts: 1 } } as any);
    return db.getRepository(Submission).findOneByOrFail({ teamId: team.id, stageId: warmup.id });
  }
  it("retains builder qualification pending confirmation, confirms Other language without a proficiency threshold and rejects stale writes", async () => {
    expect(isQualifiedBuilder(lead)).toBe(true);
    const saved = await participants.confirmBuilderProfile(lead.id, { ...answers(), expectedUpdatedAt: lead.updatedAt.toISOString() });
    expect(saved).toMatchObject({ builderConfirm: true, preferredLanguage: "Other", otherLanguage: "Elixir", languageProficiency: "Beginner" });
    expect(isQualifiedBuilder(saved)).toBe(true);
    await expect(participants.confirmBuilderProfile(lead.id, { ...answers(), expectedUpdatedAt: lead.updatedAt.toISOString() })).rejects.toThrow("profile changed");
    await expect(participants.confirmBuilderProfile(lead.id, { ...answers(), otherLanguage: "", expectedUpdatedAt: saved.updatedAt.toISOString() })).rejects.toThrow("preferred programming language");
    const corrected = await participants.confirmBuilderProfile(lead.id, { ...answers(), deploymentExperience: false, expectedUpdatedAt: saved.updatedAt.toISOString() });
    expect(corrected.builderConfirm).toBe(true); expect(isQualifiedBuilder(corrected)).toBe(false);
  });
  it("preserves warmup identity and requirements on date-only edits and allows configuring the exercise link", async () => {
    const updated = await submissions.updateStage(warmup.id, plainToInstance(UpdateStageDto, { deadline: "2040-12-02T23:59:00Z" }));
    expect(updated).toMatchObject({ id: warmup.id, name: "warmup", workflowKey: "warmup", requiresAiEvaluation: true, requirements: { exerciseUrl: "https://atf.example.test/warmup" } });
    await expect(submissions.updateStage(warmup.id, { name: "Replacement" })).rejects.toThrow("Only dates");
    await expect(submissions.updateStage(warmup.id, { requirements: { exerciseUrl: "javascript:alert(1)" } })).rejects.toThrow("HTTPS");
    expect((await submissions.updateStage(warmup.id, { requirements: { exerciseUrl: "https://atf.example.test/revised" } })).requirements.exerciseUrl).toBe("https://atf.example.test/revised");
  });

  it("requires proposal submission, certification and the supplied ATF exercise before warmup submission", async () => {
    await db.getRepository(Submission).update(proposal.id, { status: SubmissionStatus.DRAFT });
    await expect(submissions.submit(lead.id, payload())).rejects.toThrow("Submit the proposal");
    await db.getRepository(Submission).update(proposal.id, { status: SubmissionStatus.SUBMITTED });
    await db.getRepository(Participant).update(lead.id, { learningCertificateIssued: false });
    await expect(submissions.submit(lead.id, payload())).rejects.toThrow("learning certificate");
    await db.getRepository(Participant).update(lead.id, { learningCertificateIssued: true });
    await db.getRepository(Stage).update(warmup.id, { requirements: {} });
    await expect(submissions.submit(lead.id, payload())).rejects.toThrow("exercise link");
    expect(await db.getRepository(EvaluationJob).countBy({ teamId: team.id })).toBe(0);
  });
  it("durably queues AI review, ignores client pass claims, and unlocks building after a submitted proposal and successful warmup", async () => {
    await expect(assertProposalPassed(db.manager, team)).rejects.toThrow("warmup");
    const input = payload(); Object.assign(input.content, { passed: true, evaluation: { passed: true } });
    const submitted = await submissions.submit(lead.id, input);
    expect(submitted.content).not.toHaveProperty("passed");
    expect(await db.getRepository(EvaluationJob).countBy({ teamId: team.id })).toBe(1);
    await expect(assertProposalPassed(db.manager, team)).rejects.toThrow("warmup");
    const result = await evaluate(); expect(result).toMatchObject({ status: "evaluated", feedback: { warmup: { passed: true } } });
    await expect(assertProposalPassed(db.manager, team)).resolves.toBeUndefined();
    await expect(assertChallengeStarted(db.manager, team.id)).resolves.toBeUndefined();
    const progress = await workflow.progress(team.id);
    expect(progress.steps.map(s => s.key)).toEqual(["team", "problem", "proposal", "warmup", "evaluation", "build"]);
    expect(progress.steps.map(s => s.completed)).toEqual([true, true, true, true, true, false]);
    expect((await db.getRepository(Submission).findOneByOrFail({ id: proposal.id })).approvedAt).toBeNull();
  });
  it("records a failed check with feedback and supports a revised submission without retaining its old result", async () => {
    (inspectWarmupDeployment as jest.Mock).mockRejectedValue(new WarmupEvidenceError("The deployment must serve a publicly accessible HTML web app (HTTP 200)"));
    await submissions.submit(lead.id, payload());
    const rejected = await evaluate(); expect(rejected).toMatchObject({ status: "rejected", feedback: { warmup: { passed: false } } });
    await expect(assertProposalPassed(db.manager, team)).rejects.toThrow("warmup");
    (inspectWarmupDeployment as jest.Mock).mockResolvedValue({ url: "https://warmup.example.test/", html: "<html>Todo</html>" });
    const revised = await submissions.submit(lead.id, payload()); expect(revised.version).toBe(rejected.version + 1); expect(revised.feedback).toBeNull();
    expect((await evaluate()).feedback?.warmup?.passed).toBe(true);
  });
  it.each(["submission", "configuration", "brief"])("discards AI results if the %s changes while evaluation is running", async change => {
    await submissions.submit(lead.id, payload());
    ai.evaluateSubmission.mockImplementationOnce(async () => {
      if (change === "submission") await db.getRepository(Submission).increment({ teamId: team.id, stageId: warmup.id }, "version", 1);
      if (change === "configuration") await db.getRepository(Stage).update(warmup.id, { instructions: "Revised exercise" });
      if (change === "brief") await db.getRepository(Team).update(team.id, { briefId: null as any });
      return { scores: [{ score: 1 }], feedback: "Passed" };
    });
    expect((await evaluate()).feedback).toBeNull();
    expect((await db.getRepository(EvaluationJob).findOneByOrFail({ teamId: team.id })).status).toBe("cancelled");
  });
});
