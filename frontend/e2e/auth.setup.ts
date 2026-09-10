import { test as setup, expect } from "@playwright/test";
import { CREDS } from "./helpers";
import fs from "node:fs";
import path from "node:path";

const authFile = path.join(__dirname, ".auth", "user.json");

// Logs in ONCE per run and saves the storage state so the data-screen specs
// don't each hit /auth/login (which is rate-limited to 5/min per IP).
setup("authenticate", async ({ page }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(CREDS.email);
  await page.getByLabel(/password/i).fill(CREDS.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  await page.context().storageState({ path: authFile });
});
