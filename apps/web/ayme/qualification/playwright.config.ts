import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";
import path from "node:path";

// The Formbricks database URL for seeding.
config({ path: path.resolve(__dirname, "../../../../.env"), quiet: true });

/** The Ayme lab's page object qualification, against the running lab app. Run by lab:qualify. */
export default defineConfig({
  testDir: __dirname,
  testMatch: "*.qualify.ts",
  outputDir: path.resolve(__dirname, "../../.ayme-lab/qualification-results"),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Turbopack compiles each page on its first request, which can take a minute.
  timeout: 300_000,
  expect: { timeout: 60_000 },
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
});
