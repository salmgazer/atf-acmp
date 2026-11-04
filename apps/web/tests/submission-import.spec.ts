import { test, expect, type Page, type BrowserContext } from "@playwright/test";

const cohortId = "318cb096-48d3-4d3b-8db6-4ef6e6c21356";
const csv = 'Timestamp,Session ID,Organisation name,Opportunity title\n"11/4/2026 8:17:18",source-id,"Example, Partner","Quoted ""brief"" and\nmultiline description"';
const preview = { ready: true, previewHash: "a".repeat(64), cohortId, sourceName: "Ghana.csv", sourceTimezone: "Africa/Accra", totalBriefs: 2, newPartners: 1, newUsers: 3, newBriefs: 2, skippedBriefs: 0,
  organizations: [{ key: "ghana::example partner", name: "Example Partner", country: "Ghana", primaryEmail: "first@example.test", primaryCandidates: [{ name: "First Submitter", email: "first@example.test" }, { name: "Other Submitter", email: "other@example.test" }], rows: [2, 3], newBriefs: 2, skippedBriefs: 0 }], briefs: [{ row: 2, title: "Imported opportunity", partner: "Example Partner", submittedAt: "2026-11-04T08:17:18Z", status: "new", submitter: { name: "First Submitter", email: "first@example.test" }, host: { name: "Brief Host", email: "brief-host@example.test", source: "brief" }, fitScore: 95, impactScore: 4 }], errors: [], warnings: [{ row: 3, message: "Missing impact answers are preserved as missing" }] };

async function setup(page: Page, context: BrowserContext, role = "program_manager") {
  const user = { id: "import-staff", role, email: "staff@example.test", firstName: "Staff" };
  await context.addCookies([{ name: "auth_token", value: "present", url: "http://localhost:63781" }, { name: "auth_portal", value: "staff", url: "http://localhost:63781" }]);
  await page.addInitScript(user => {
    localStorage.setItem("auth_token", "test-access");
    localStorage.setItem("acmp-auth-store", JSON.stringify({ state: { user, token: "test-access", portal: "staff", isAuthenticated: true }, version: 0 }));
  }, user);
  const requests: { path: string; body: any }[] = [];
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    let data: unknown = [];
    if (path === "/auth/me") data = user;
    else if (path === "/cohorts") data = { data: [{ id: cohortId, name: "Import cohort", status: "active" }], total: 1 };
    else if (path.endsWith("/submission-import/preview")) { requests.push({ path, body: route.request().postDataJSON() }); data = preview; }
    else if (path.endsWith("/submission-import/apply")) { requests.push({ path, body: route.request().postDataJSON() }); data = { batchId: "import-receipt", createdPartners: 1, createdUsers: 3, createdBriefs: 2, skippedBriefs: 0, briefIds: ["brief-1", "brief-2"] }; }
    await route.fulfill({ json: data });
  });
  await page.goto("/staff/partners/import");
  return requests;
}
async function prepare(page: Page) {
  await page.getByRole("button", { name: "Partners and briefs", exact: true }).click();
  await page.getByLabel("Cohort", { exact: true }).selectOption(cohortId);
  await page.getByLabel("Partner brief submissions CSV", { exact: true }).setInputFiles({ name: "Ghana.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Preview import", exact: true }).click();
  await expect(page.getByText("2 source briefs", { exact: false })).toBeVisible();
}

test("staff previews original CSV, selects the partner main contact, confirms import and downloads its receipt", async ({ page, context }) => {
  const requests = await setup(page, context);
  await prepare(page);
  expect(requests).toHaveLength(1);
  await expect(page.getByRole("heading", { name: "Brief contacts and scores" })).toBeVisible();
  await expect(page.getByText("brief-host@example.test", { exact: true })).toBeVisible();
  expect(requests[0].body).toMatchObject({ csv, cohortId, sourceName: "Ghana.csv", sourceTimezone: "Africa/Accra" });
  await expect(page.getByText("Row 3: Missing impact answers are preserved as missing")).toBeVisible();
  await page.getByLabel("Main contact for Example Partner").selectOption("other@example.test");
  const load = page.getByRole("button", { name: "Import partners and briefs", exact: true });
  await expect(load).toBeDisabled();
  await page.getByRole("button", { name: "Refresh preview", exact: true }).click();
  await expect(load).toBeEnabled();
  await load.click();
  await expect(page.getByRole("dialog")).toContainText("Import cohort");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(requests.filter(request => request.path.endsWith("apply"))).toHaveLength(0);
  await load.click();
  await page.getByRole("button", { name: "Confirm import", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible();
  const apply = requests.find(request => request.path.endsWith("apply"))!;
  expect(apply.body).toMatchObject({ csv, cohortId, primaryContacts: { "ghana::example partner": "other@example.test" }, previewHash: preview.previewHash });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download receipt" }).click();
  expect((await download).suggestedFilename()).toBe("partner-import-import-receipt.json");
});

test("invalid previews display row errors and cannot apply", async ({ page, context }) => {
  const requests = await setup(page, context);
  await page.route("**/submission-import/preview", route => route.fulfill({ json: { ...preview, ready: false, errors: [{ row: 2, message: "Contact email belongs to another partner" }] } }));
  await prepare(page);
  await expect(page.getByRole("region", { name: "Import partner brief submissions" }).getByRole("alert")).toContainText("Row 2: Contact email belongs to another partner");
  await expect(page.getByRole("button", { name: "Import partners and briefs", exact: true })).toBeDisabled();
  expect(requests.filter(request => request.path.endsWith("apply"))).toHaveLength(0);
});

test("source changes invalidate preview and identical reruns explain that nothing needs loading", async ({ page, context }) => {
  await setup(page, context);
  await prepare(page);
  await page.getByLabel("Source timestamp timezone").fill("Africa/Nairobi");
  await expect(page.getByRole("button", { name: "Import partners and briefs", exact: true })).toBeDisabled();
  await page.route("**/submission-import/preview", route => route.fulfill({ json: { ...preview, newPartners: 0, newUsers: 0, newBriefs: 0, skippedBriefs: 2 } }));
  await page.getByRole("button", { name: "Refresh preview", exact: true }).click();
  await expect(page.getByText("All source briefs have already been imported. Nothing new to load.")).toBeVisible();
});

test("stale apply errors retain the CSV and require a fresh preview", async ({ page, context }) => {
  await setup(page, context);
  await prepare(page);
  await page.route("**/submission-import/apply", route => route.fulfill({ status: 409, json: { message: "Existing data changed. Refresh the preview before importing." } }));
  await page.getByRole("button", { name: "Import partners and briefs", exact: true }).click();
  await page.getByRole("button", { name: "Confirm import", exact: true }).click();
  await expect(page.getByText("Existing data changed. Refresh the preview before importing.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Submission CSV data")).toHaveValue(csv);
  await expect(page.getByRole("button", { name: "Import partners and briefs", exact: true })).toBeDisabled();
});

for (const role of ["viewer", "evaluator"]) test(`${role} cannot open the partner/brief importer`, async ({ page, context }) => {
  const requests = await setup(page, context, role);
  await expect(page.getByRole("heading", { name: "Access restricted" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Partners and briefs", exact: true })).toHaveCount(0);
  expect(requests).toHaveLength(0);
});
