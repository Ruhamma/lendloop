import { defineConfig } from "@playwright/test";

// Smoke tests against a running dev stack (Next.js + Convex + Clerk dev keys).
// Uses the locally installed Chrome, so no browser download is needed.
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
