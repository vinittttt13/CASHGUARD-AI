import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

/**
 * Runs against an already-running stack (`docker compose up`), seeded via
 * `docker compose exec backend python seed_db.py`.
 *   FRONTEND_URL  default http://localhost:3000
 *
 * `auth.setup.ts` logs in once and saves storage state; the data-screen specs
 * reuse it so the run stays under the 5/min login rate limit.
 */
const baseURL = process.env.FRONTEND_URL || "http://localhost:3000";
const authFile = path.join(__dirname, "e2e", ".auth", "user.json");

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "auth-flows",
      testMatch: /login\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "screens",
      testMatch: /dashboard\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: authFile },
    },
  ],
});
