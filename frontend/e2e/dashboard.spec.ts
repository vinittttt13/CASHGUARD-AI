import { test, expect } from "@playwright/test";

// Auth comes from e2e/auth.setup.ts via storageState (see playwright.config.ts).

test("dashboard shows real backend data (not mocks)", async ({ page }) => {
  await page.goto("/dashboard");

  // A seeded complaint number renders in the live feed — proves it is wired to
  // GET /api/v1/complaints, not the old hard-coded array.
  await expect(page.getByText(/CYB\/\d{4}\/\d+/).first()).toBeVisible({
    timeout: 15_000,
  });

  // Stats overview no longer shows the old mock value.
  await expect(page.getByText("Total Complaints")).toBeVisible();
  await expect(page.getByText("1,248")).toHaveCount(0);
});

test("alerts page lists alerts from the backend", async ({ page }) => {
  await page.goto("/alerts");
  await expect(page.getByRole("heading", { name: "Alert Center" })).toBeVisible();
  await expect(page.getByText(/Showing \d+ of \d+ alerts/)).toBeVisible({
    timeout: 15_000,
  });
});

test("analytics page renders API-backed content", async ({ page }) => {
  await page.goto("/analytics");
  await expect(
    page.getByRole("heading", { name: "Advanced Analytics" }),
  ).toBeVisible();
  await expect(page.getByText("Crime Volume Time Series")).toBeVisible();
  await expect(
    page.getByText(/ATM|No high-risk hotspots/).first(),
  ).toBeVisible({ timeout: 15_000 });
});

test("intelligence report is generated from DB records", async ({ page }) => {
  await page.goto("/intelligence");
  await expect(
    page.getByRole("heading", { name: "Intelligence Report" }),
  ).toBeVisible();
  await expect(
    page.getByText(/incidents reported totaling INR/i),
  ).toBeVisible({ timeout: 15_000 });
});

test("AML transaction analysis: submit a real transaction and get a real backend prediction", async ({
  page,
}) => {
  await page.goto("/analytics");
  await expect(
    page.getByRole("heading", { name: "AML Transaction Risk Analysis" }),
  ).toBeVisible();

  await page.getByLabel("Amount Paid").fill("98000");
  await page.getByLabel("Payment Format").selectOption("Cash");
  await page.getByRole("button", { name: "Analyze Transaction" }).click();

  // A real prediction came back from POST /api/v1/predict/aml-transaction —
  // not a client-side mock — proven by a risk level actually rendering and
  // the response explicitly naming which model produced it (xgboost_aml if
  // a trained artifact is loaded, or the heuristic fallback if not — either
  // way, never silently unlabeled).
  await expect(page.getByText(/CRITICAL|HIGH|MEDIUM|LOW/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/xgboost_aml|Heuristic fallback/i)).toBeVisible();
});
