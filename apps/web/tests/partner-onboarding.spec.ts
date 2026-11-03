import { test, expect, type Page } from "@playwright/test";

async function fillOrganisation(page: Page) {
  await page.goto("/onboard-partner");
  await page.getByLabel("Organisation Name *", { exact: true }).fill("Test Organisation");
  await page.getByRole("combobox").nth(0).click();
  await page.getByRole("option", { name: "Healthcare", exact: true }).click();
  await page.getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: "Ghana", exact: true }).click();
  await page.getByLabel("City or Town *", { exact: true }).fill("Accra");
  await page.getByLabel("Your Name *", { exact: true }).fill("Test Contact");
  await page.getByLabel("Designation/Title *", { exact: true }).fill("Director");
  await page.getByLabel("Email *", { exact: true }).fill("contact@example.test");
  await page.getByLabel("Phone Number *", { exact: true }).fill("+233201234567");
}

async function fillOpportunity(page: Page, title = "Improving clinic appointments") {
  await page.getByLabel("Opportunity Title *", { exact: true }).fill(title);
  await page.locator("#description").fill("Help patients get appointments at their local clinics more quickly.");
  await page.locator("#whatChanges").fill("Shorter waiting times");
  await page.locator("#howMany").fill("5000");
  await page.locator("#dataDescription").fill("Anonymised appointment records");
  await page.locator("#dataAccess").fill("Yes, with anonymisation");
}

test("short organisation names and opportunity titles are caught before submission", async ({ page }) => {
  await fillOrganisation(page);
  await page.getByLabel("Organisation Name *", { exact: true }).fill("A");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Organisation name must be at least 2 characters", { exact: true })).toBeVisible();
  await page.getByLabel("Organisation Name *", { exact: true }).fill("Test Organisation");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await fillOpportunity(page, "Test");
  await page.getByRole("button", { name: "Continue to Fit Questions" }).click();
  await expect(page.getByText("Title must be at least 5 characters", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add Another Opportunity" }).click();
  await expect(page.getByRole("button", { name: "Opportunity 2", exact: true })).toHaveCount(0);
  await page.getByLabel("Opportunity Title *", { exact: true }).fill("A".repeat(256));
  await page.getByRole("button", { name: "Continue to Fit Questions" }).click();
  await expect(page.getByText("Title must be 255 characters or fewer", { exact: true })).toBeVisible();
});

test("submission errors use readable labels and opportunity numbers and allow correction and retry", async ({ page }) => {
  let attempts = 0;
  await page.route("**/public/organization-briefs", async route => {
    attempts++;
    if (attempts === 1) {
      await route.fulfill({ status: 400, json: { message: [
        "opportunities.0.title must be longer than or equal to 5 characters",
        "opportunities.1.description must be longer than or equal to 20 characters",
        "org.orgName must be shorter than or equal to 255 characters",
        "org.email must be an email",
        "opportunities.0.secondaryContact.Please enter a valid email address",
        "opportunities.1.scoringAnswers.q2 must be one of the following values: good_records, partial, very_little",
      ] } });
    } else if (attempts === 2) {
      await route.fulfill({ status: 400, json: { message: "No active cohort available for submissions" } });
    } else if (attempts === 3) {
      await route.fulfill({ status: 502, contentType: "text/html", body: "<html>Bad gateway</html>" });
    } else {
      await route.fulfill({ json: { success: true } });
    }
  });
  await fillOrganisation(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await fillOpportunity(page);
  await page.getByRole("button", { name: "Continue to Fit Questions" }).click();
  for (const group of await page.getByRole("radiogroup").all()) await group.getByRole("radio").first().click();
  await page.getByRole("button", { name: "Review & Submit", exact: true }).click();
  await page.getByLabel("I consent to the processing of this information").check();
  await page.getByRole("button", { name: "Submit Brief", exact: true }).click();
  const alert = page.getByRole("main").getByRole("alert");
  await expect(alert.getByRole("listitem")).toHaveText([
    "Opportunity 1: Title must be at least 5 characters.",
    "Opportunity 2: Description must be at least 20 characters.",
    "Organisation name must be 255 characters or fewer.",
    "Email address must be a valid email address.",
    "Opportunity 1: Secondary contact email must be a valid email address.",
    "Opportunity 2: Please select a valid answer for fit question 2.",
  ]);
  await expect(alert).not.toContainText("opportunities.");
  await page.getByRole("button", { name: "Submit Brief", exact: true }).click();
  await expect(alert).toContainText("No active cohort available for submissions");
  await page.getByRole("button", { name: "Submit Brief", exact: true }).click();
  await expect(alert).toContainText("We couldn't submit your form. Please try again.");
  await page.getByRole("button", { name: "Submit Brief", exact: true }).click();
  await expect(page.getByRole("heading", { name: /thank you/i })).toBeVisible();
  expect(attempts).toBe(4);
});
