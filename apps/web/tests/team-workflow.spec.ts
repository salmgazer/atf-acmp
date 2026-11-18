import { test, expect, Page, BrowserContext } from "@playwright/test";
const cohortId = "workflow-cohort", teamId = "workflow-team", participantId = "workflow-lead", briefId = "workflow-brief", submissionId = "workflow-proposal";
const date = "2040-02-01T23:59:00.000Z";
const briefAnswers = { hasOrganization: "No", setting: "Community clinics", sector: "Healthcare", country: "Ghana", city: "Accra", title: "Missed clinic appointments", problemStatement: "Patients miss appointments in community clinics.", description: "Patients cannot easily track their appointments.", affected: "About 100 people, based on clinic records.", cost: "Lost time and delayed care.", workarounds: "Paper cards are often misplaced.", urgency: "The clinic serves more patients now.", expectedOutcomes: "Fewer missed appointments.", improvement: "More patients attend on time.", dataDescription: "Two years of clinic appointment records.", contactName: "External Contact", contactRole: "Clinic manager", contactEmail: "contact@example.test", contactPhone: "+233123456789", contactConnection: "Manages appointments.", contactSupport: "Yes", contactConsent: true, discovery: "Research", discoveryDetails: "We interviewed clinic users.", consultationCount: 3, findings: "Appointment cards are often lost.", q1: "judgement", q2: "good_records", q3: "hard", q4: "yes", q5: "clear", q6: "very_often", contactReviewed: "Yes", q7: "meaningful", q8: "local", sensitivities: ["Health information"], conflict: "No", original: true, acceptReview: true, shareWithTeams: false };
const proposalAnswers = { projectName: "Clinic reminders", summary: "Help patients keep their appointments.", learning: "Patients need reminders.", solution: "A reminder service.", aiApproach: "Classify incoming requests.", whyAi: "Understand varied messages.", technology: "TypeScript and PostgreSQL.", dataPermission: "Clinic data with permission.", llmPlatform: "To be agreed with ATF", creditsPlan: "Small prototype tests.", demoScope: "Working reminders.", milestones: [1, 2, 3].map(i => ({ milestone: `Milestone ${i}`, date: `2040-01-0${i}` })), testing: "Test with clinic volunteers.", risks: "Data delays; start with synthetic data.", responsibleAi: "Keep a human reviewer.", directBeneficiaries: "Clinic patients.", indirectBeneficiaries: "Families.", indicators: [1, 2].map(i => ({ indicator: `Metric ${i}`, measurement: "Survey", target: "20" })), impactType: "Social impact", impactExplanation: "Improved access to care.", afterChallenge: "Pilot with another clinic.", skills: "Research and engineering.", mentorSupport: ["Technical or AI"], mentorSupportDetails: "Review the architecture.", weeklyHours: 6, original: true, aiWriting: "No", acceptRules: true, shareWithContact: true, surveyConsent: true };

async function setup(page: Page, context: BrowserContext, options: { staff?: boolean; viewer?: boolean; passed?: boolean; own?: boolean; choosing?: boolean; noTeam?: boolean; failProgress?: boolean } = {}) {
  const portal = options.staff ? "staff" : "participant";
  const user = { id: participantId, role: options.staff ? options.viewer ? "viewer" : "program_manager" : "participant", firstName: "Synthetic", lastName: "Lead", email: "synthetic@example.test", participantId: "SYNTHETIC-ID", participant: { id: participantId, cohortId }, cohortId, status: "assigned", onboardingComplete: true, mustChangePassword: false, country: "Ghana", skills: [], interests: [] };
  const team = { id: teamId, name: "Synthetic team", cohortId, briefId: options.choosing ? null : briefId, briefPreference: options.own ? "own" : "partner", githubRepoUrl: "https://github.com/example/project" };
  const stages = ["team", "problem", "proposal", "evaluation", "build"].map((key, index) => ({ id: `workflow-stage-${key}`, cohortId, workflowKey: key, number: index + 1, name: ["Form a team", "Choose a problem", "Submit a proposal", "Pass evaluation", "Build and submit"][index], deadline: date, type: "mixed", requirements: {}, isActive: true, isOpen: true, allowLateSubmissions: false, stats: { total: 0 } }));
  const completedCount = options.noTeam ? 0 : options.passed ? 4 : options.choosing ? 1 : 2;
  const progress: any = { team: options.noTeam ? null : { ...team, briefTitle: options.choosing ? undefined : "Community clinic problem" }, canEdit: true, canSubmitOwnBrief: true, learningComplete: true, ownBrief: options.own ? { id: briefId, status: "draft" } : null, proposal: { id: submissionId, status: options.passed ? "approved" : "draft" }, steps: stages.map((stage, index) => ({ key: stage.workflowKey, number: stage.number, name: stage.name, stageId: stage.id, deadline: date, completed: index < completedCount, status: index < completedCount ? "completed" : index === completedCount ? "available" : "locked" })) };
  let own = { id: briefId, status: "draft", answers: briefAnswers, fileUrls: [] as any[] }, submission: any = { id: submissionId, teamId, stageId: stages[2].id, stage: stages[2], team, status: options.staff ? "pending_approval" : "draft", content: proposalAnswers, fileUrls: [] };
  const writes: Array<{ path: string; body: any }> = [];
  await context.addCookies([{ name: "auth_token", value: "present", url: "http://localhost:63781" }, { name: "auth_portal", value: portal, url: "http://localhost:63781" }]);
  await page.addInitScript(({ user, portal, cohortId }) => { localStorage.setItem("auth_token", "test-token"); localStorage.setItem("acmp-auth-store", JSON.stringify({ state: { user, token: "test-token", portal, isAuthenticated: true }, version: 0 })); localStorage.setItem("acmp-staff-cohort-store", JSON.stringify({ state: { globalCohortId: cohortId }, version: 0 })); }, { user, portal, cohortId });
  await page.routeWebSocket(/socket\.io/, socket => socket.close()); await page.route("**/*onesignal*", route => route.abort());
  await page.route("**/api/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method(); let data: unknown = [];
    if (method !== "GET") writes.push({ path, body: request.headers()["content-type"]?.includes("application/json") ? request.postDataJSON() : "upload" });
    if (path.endsWith("/auth/me") || path.endsWith("/participants/me")) data = user;
    else if (path.endsWith("/team-workflow")) {
      if (options.failProgress) { await route.fulfill({ status: 503, json: { message: "Progress unavailable" } }); return; }
      data = progress;
    } else if (path.endsWith("/team-workflow/brief")) {
      if (method === "POST") { const body = request.postDataJSON(); own = { ...own, answers: body.answers, fileUrls: body.fileUrls, status: body.submit ? "submitted" : "draft" }; }
      data = own;
    } else if (path.endsWith(`/admin/team-workflow/briefs/${briefId}/review`)) data = { id: briefId, status: request.postDataJSON().action };
    else if (path.endsWith(`/admin/team-workflow/briefs/${briefId}`)) data = { answers: briefAnswers, fileUrls: [], minimumConsultations: 3 };
    else if (path.includes("/admin/submissions/")) {
      if (path.endsWith("/evaluate")) submission = { ...submission, status: "evaluated", evaluatedAt: "2026-11-18T12:00:00Z", feedback: { proposalScores: request.postDataJSON().criterionScores } };
      else if (path.endsWith("/approve")) submission = { ...submission, status: "approved" };
      data = submission;
    } else if (path.includes(`/submissions/my/stage/`)) data = path.endsWith("build") ? null : submission;
    else if (path.endsWith("/submissions/draft") || path.endsWith("/submissions/submit")) { const body = request.postDataJSON(); data = submission = { ...submission, ...body, status: path.endsWith("/submit") ? "pending_approval" : "draft" }; }
    else if (path.endsWith("/submissions/upload-video")) data = { url: "https://storage.example.test/demo.mp4" };
    else if (path.endsWith("/submissions/upload-document")) data = { name: "Slides.pptx", url: "https://storage.example.test/slides.pptx", type: "application/vnd.openxmlformats-officedocument.presentationml.presentation", size: 100 };
    else if (path.includes("/admin/stages/") && method === "PATCH") data = { ...stages.find(stage => path.endsWith(stage.id)), ...request.postDataJSON() };
    else if (path.endsWith("/stages") || path.endsWith("/stats")) data = stages;
    else if (path.includes("/stages/")) data = stages.find(stage => path.endsWith(stage.id));
    else if (path.endsWith(`/briefs/${briefId}`)) data = { id: briefId, source: "team", cohortId, title: "Community clinic problem", description: "A clinic problem", status: "submitted", fitScore: 100, impactScore: 4, createdAt: "2026-11-18T12:00:00Z", imageUrls: [], tags: [], maxTeams: 25, teamsCount: 0 };
    else if (path.endsWith("/cohorts")) data = { data: [{ id: cohortId, name: "Synthetic cohort" }], total: 1 };
    else if (path.endsWith(`/cohorts/${cohortId}`)) data = { id: cohortId, name: "Synthetic cohort", status: "active", deadlines: {}, countries: ["Ghana"] };
    else if (path.endsWith(`/teams/my/${participantId}`)) data = options.noTeam ? null : team;
    else if (path.endsWith("/unread-count")) data = { count: 0 };
    await route.fulfill({ json: data });
  });
  return { writes, progress, stages };
}

test("five steps use completion events, with no Stage 4 participant submission", async ({ page, context }) => {
  const state = await setup(page, context); await page.goto("/participant/submissions");
  await expect(page.getByRole("heading", { name: "Your team’s five steps" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^[1-5]\. / })).toHaveCount(5);
  await expect(page.getByRole("link", { name: "Open proposal", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open final submission" })).toHaveCount(0);
  const review = page.locator("section").filter({ has: page.getByRole("heading", { name: "4. Pass evaluation" }) });
  await expect(review).toContainText("No action is required"); await expect(review.getByRole("button")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Browse mentors and book your first call" })).toBeVisible();
  expect(state.writes).toEqual([]);
});

test("membership is required and a non-submission step has no form even at a direct URL", async ({ page, context }) => {
  await setup(page, context, { noTeam: true }); await page.goto("/participant/submissions");
  await expect(page.getByRole("link", { name: "Go to teams" })).toBeVisible();
  await page.goto("/participant/submissions/workflow-stage-evaluation");
  await expect(page.getByText("This step has no submission form.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit", exact: true })).toHaveCount(0);
});

test("the own-problem form validates conditional answers and saves private drafts on mobile", async ({ page, context }) => {
  const state = await setup(page, context, { own: true }); await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/participant/briefs/own");
  await expect(page.getByRole("heading", { name: "Your team's problem brief" })).toBeVisible();
  await page.getByLabel("Sector", { exact: true }).selectOption("Other");
  await page.getByRole("button", { name: "Submit brief for review" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Specify the sector is required" })).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.getByLabel("Specify the sector", { exact: true }).fill("Community transport");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved successfully" })).toBeVisible();
  expect(state.writes[0].body).toMatchObject({ answers: { sector: "Other", otherSector: "Community transport", shareWithTeams: false }, submit: false });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("proposal fields preserve milestones and use the assigned brief without asking users to choose it again", async ({ page, context }) => {
  const state = await setup(page, context); await page.goto("/participant/submissions/workflow-stage-proposal");
  await expect(page.getByText("For your assigned brief: Community clinic problem.", { exact: false })).toBeVisible();
  await page.getByLabel("Project name", { exact: true }).fill("Updated project name");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved successfully" })).toBeVisible();
  expect(state.writes.at(-1)?.body.content).toMatchObject({ projectName: "Updated project name", milestones: proposalAnswers.milestones });
  expect(state.writes.at(-1)?.body.content).not.toHaveProperty("approved");
});

test("MVP uploads require MP4 and PowerPoint and reuse the existing repository", async ({ page, context }) => {
  const state = await setup(page, context, { passed: true }); await page.goto("/participant/submissions/workflow-stage-build");
  await expect(page.getByRole("link", { name: "https://github.com/example/project", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Submit MVP", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Upload an MP4 video" })).toBeVisible(); expect(state.writes).toHaveLength(0);
  await page.getByLabel("MP4 demo video", { exact: false }).setInputFiles({ name: "demo.webm", mimeType: "video/webm", buffer: Buffer.from("synthetic") });
  await expect(page.getByRole("alert").filter({ hasText: "Choose an MP4" })).toBeVisible(); expect(state.writes).toHaveLength(0);
  await page.getByLabel("MP4 demo video", { exact: false }).setInputFiles({ name: "demo.mp4", mimeType: "video/mp4", buffer: Buffer.from("synthetic") });
  await page.getByLabel("Upload document").setInputFiles({ name: "Slides.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", buffer: Buffer.from("synthetic slides") });
  await expect(page.getByRole("link", { name: "Slides.pptx" })).toBeVisible();
  await page.getByRole("checkbox", { name: "We confirm the submitted code is under Apache 2.0." }).check();
  await page.getByRole("button", { name: "Submit MVP", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved successfully" })).toBeVisible();
  expect(state.writes.at(-1)?.body).toMatchObject({ stageId: "workflow-stage-build", videoUrl: "https://storage.example.test/demo.mp4", fileUrls: [{ name: "Slides.pptx" }], content: { acceptApacheLicense: true } });
  expect(state.writes.at(-1)?.body).not.toHaveProperty("githubUrl");
});

test("staff edits fixed step dates in UTC, without add/delete controls", async ({ page, context }) => {
  const state = await setup(page, context, { staff: true }); await page.goto(`/staff/cohorts/${cohortId}/stages`);
  await expect(page.getByRole("heading", { name: "3. Submit a proposal" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Stage", exact: true })).toHaveCount(0);
  await page.locator("#workflow-stage-proposal-deadline").fill("2040-02-02T22:45");
  await page.getByRole("button", { name: "Save step 3", exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0]).toMatchObject({ path: "/api/admin/stages/workflow-stage-proposal", body: { deadline: "2040-02-02T22:45:00Z", startDate: null } });
});

test("staff reads private brief evidence and records an explained contact verification decision", async ({ page, context }) => {
  const state = await setup(page, context, { staff: true }); await page.goto(`/staff/briefs/${briefId}`);
  await expect(page.getByRole("heading", { name: "Team brief review", exact: true })).toBeVisible();
  await expect(page.getByText("contact@example.test", { exact: true })).toBeVisible();
  const approve = page.getByRole("button", { name: "Approve team brief", exact: true }); await expect(approve).toBeDisabled();
  await page.getByLabel("Review reason (required)").fill("We verified evidence and real-world support.");
  await page.getByRole("checkbox", { name: "I verified the contact's support and scored answers on a call." }).check();
  await approve.click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0]).toMatchObject({ path: `/api/admin/team-workflow/briefs/${briefId}/review`, body: { action: "approved", contactVerified: true } });
});

test("staff scores all proposal criteria before an explicit approval", async ({ page, context }) => {
  const state = await setup(page, context, { staff: true }); await page.goto(`/staff/submissions/proposals/${submissionId}`);
  const approve = page.getByRole("button", { name: "Approve proposal and unlock building", exact: true }); await expect(approve).toBeDisabled();
  for (const id of ["problem", "solution", "feasibility", "responsible_ai", "impact", "capacity"]) await page.locator(`#score-${id}`).fill("4");
  await page.getByLabel("Feedback to the team").fill("The proposal is ready for building.");
  await page.getByRole("button", { name: "Save criterion scores" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Criterion scores saved" })).toBeVisible();
  await page.getByLabel("Feedback to the team").fill("The proposal is ready for building.");
  await approve.click(); await expect.poll(() => state.writes.length).toBe(2);
  expect(state.writes.map(write => write.path)).toEqual([`/api/admin/submissions/${submissionId}/evaluate`, `/api/admin/submissions/${submissionId}/approve`]);
});

test("read-only staff can inspect proposals but cannot score or approve", async ({ page, context }) => {
  await setup(page, context, { staff: true, viewer: true }); await page.goto(`/staff/submissions/proposals/${submissionId}`);
  await expect(page.getByRole("heading", { name: "Proposal review — Synthetic team" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save criterion scores" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve proposal and unlock building" })).toHaveCount(0);
});

for (const options of [{ noTeam: true }, { choosing: true, own: true }, {}, { passed: true }]) test(`dashboard shows the full roadmap with only unlocked actions: ${JSON.stringify(options)}`, async ({ page, context }) => {
  const state = await setup(page, context, options);
  await page.goto("/participant/dashboard");
  const roadmap = page.getByRole("region", { name: "Programme roadmap", exact: true });
  await expect(roadmap.getByRole("heading", { level: 3 })).toHaveCount(5);
  for (const step of state.progress.steps) {
    const card = roadmap.getByRole("listitem").filter({ has: page.getByRole("heading", { name: step.name, exact: true }) });
    await expect(card).toBeVisible();
    if (step.status === "locked") {
      await expect(card).toHaveAttribute("data-state", "locked");
      await expect(card).toContainText("Upcoming · Locked");
      await expect(card.getByRole("link")).toHaveCount(0);
    } else await expect(card.getByRole("link")).toBeVisible();
  }
  await expect(page.getByText(`Stage ${options.noTeam ? 1 : options.passed ? 5 : options.choosing ? 2 : 3} of 5`, { exact: true })).toBeVisible();
  await expect(page.getByText("No upcoming deadlines", { exact: true })).toHaveCount(0);
  expect(state.writes).toEqual([]);
  if (!options.noTeam && !options.choosing) {
    await roadmap.getByRole("link", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("heading", { name: options.passed ? "Final MVP submission" : "Team proposal", exact: true })).toBeVisible();
  }
});

test("future opening dates keep a visible stage disabled and direct URLs cannot bypass the locked form", async ({ page, context }) => {
  const state = await setup(page, context);
  state.progress.steps[2].startDate = "2040-01-01T12:00:00Z";
  Object.assign(state.stages[2], { startDate: state.progress.steps[2].startDate });
  await page.goto("/participant/dashboard");
  const roadmap = page.getByRole("region", { name: "Programme roadmap", exact: true });
  const proposal = roadmap.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Submit a proposal", exact: true }) });
  await expect(proposal).toHaveAttribute("data-state", "locked");
  await expect(proposal).toContainText("Opens 2040-01-01 12:00 UTC");
  await expect(proposal.getByRole("link")).toHaveCount(0);
  await page.goto("/participant/submissions");
  const detail = page.locator("section").filter({ has: page.getByRole("heading", { name: "3. Submit a proposal", exact: true }) });
  await expect(detail).toHaveAttribute("data-state", "locked");
  await expect(detail.getByRole("link")).toHaveCount(0);
  await page.goto("/participant/submissions/workflow-stage-proposal");
  await expect(page.getByText("This submission window has not opened yet.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit proposal", exact: true })).toHaveCount(0);
  await page.goto("/participant/submissions/workflow-stage-build");
  await expect(page.getByText("Complete the previous steps and eligibility checks before opening this form.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit MVP", exact: true })).toHaveCount(0);
  expect(state.writes).toEqual([]);
});

for (const viewport of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) test(`roadmap fits ${viewport.width}px in dark mode before a brief is assigned`, async ({ page, context }) => {
  await page.setViewportSize(viewport);
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await setup(page, context, { choosing: true, own: true });
  await page.goto("/participant/dashboard");
  const roadmap = page.getByRole("region", { name: "Programme roadmap", exact: true });
  await expect(roadmap.getByRole("listitem")).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await roadmap.screenshot({ path: `/tmp/acmp-programme-roadmap-${viewport.width}.png` });
});
