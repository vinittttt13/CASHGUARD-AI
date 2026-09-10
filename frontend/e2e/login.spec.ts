import { test, expect } from "@playwright/test";
import { CREDS } from "./helpers";

// Fresh context — these specs exercise the real login endpoint.
test.use({ storageState: { cookies: [], origins: [] } });

test("unauthenticated dashboard access redirects to /login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("rejects bad credentials — no token, stays on /login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(CREDS.email);
  await page.getByLabel(/password/i).fill("definitely-wrong-password");
  await page.getByRole("button", { name: /sign in/i }).click();

  // Not authenticated: no token stored, still on /login.
  await page.waitForTimeout(2000);
  await expect(page).toHaveURL(/\/login/);
  const token = await page.evaluate(() => localStorage.getItem("accessToken"));
  expect(token).toBeNull();
});
