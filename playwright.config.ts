import { defineConfig } from "@playwright/test";

// Runs against a server you have already started and seeded:
//   SEED_PASSWORD=local-demo-pass-123 npm run seed -- --reset && npm run dev -- -p 3210
export default defineConfig({
  testDir: "e2e",
  timeout: 180_000,
  workers: 1,
  // Generous, because on the hosted site some steps wait on a model call.
  expect: { timeout: 25_000 },
  reporter: "list",
  use: { actionTimeout: 15_000, baseURL: process.env.E2E_URL ?? "http://localhost:3210", viewport: { width: 390, height: 844 }, screenshot: "only-on-failure" },
});
