// Extra checks that go beyond the main flows: real PDF and DOCX uploads, reading a real GitHub profile,
// profile recovery, admin account lifecycle, line settings, and a physical-bump simulation on both phones.
// Needs E2E_FILES pointing at a folder with resume.pdf and cert.docx.
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = process.env.E2E_PASSWORD ?? "local-demo-pass-123";
const FILES = process.env.E2E_FILES ?? "";
test.skip(!FILES, "set E2E_FILES to run the extended checks");
const stamp = Date.now().toString(36);

async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}
const bump = (page: Page) => page.evaluate(() => { const send = (x: number) => window.dispatchEvent(new DeviceMotionEvent("devicemotion", { acceleration: { x, y: 0, z: 0 } })); send(0); send(25); });

test("PDF resume, DOCX file and a real GitHub link are read; the profile can be recovered and downloaded", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const s = await ctx.newPage();
  const last = `Doe${stamp}`, email = `jane.${stamp}@campus.example.edu`;
  await s.goto("/signup");
  await s.getByLabel("Resume", { exact: true }).setInputFiles(path.join(FILES, "resume.pdf"));
  await expect(s.getByText("Resume read.")).toBeVisible({ timeout: 45_000 });
  await expect(s.getByLabel("Read from your resume").getByText("University of Arkansas")).toBeVisible();
  await expect(s.getByLabel(/^Links/)).toHaveValue(/github\.com\/octocat/); // found in the resume
  await s.getByLabel(/^Other files/).setInputFiles(path.join(FILES, "cert.docx"));
  await s.getByLabel(/^Last name/).fill(last);
  await s.getByLabel("Email", { exact: true }).fill(email);
  await s.getByLabel("What do you want to talk about?").fill("Supply chain and logistics");
  await s.getByLabel("Read these pages to back up my resume").check();
  await s.getByRole("button", { name: "Create my profile" }).click();
  await expect(s.getByText("You are in Priya Raman's line")).toBeVisible({ timeout: 45_000 });
  const code = (await s.locator("p.select-all").innerText()).trim();
  await s.getByRole("link", { name: "I saved it, continue" }).click();

  await s.goto("/me");
  await expect(s.getByText("cert.docx").first()).toBeVisible();
  // The link reader runs after signup. Wait for it, then report what GitHub said.
  await expect(s.getByText(/Checking your resume/)).toHaveCount(0, { timeout: 60_000 });
  const github = (await s.locator("li", { hasText: "GitHub" }).first().innerText()).replace(/\s+/g, " ");
  console.log("GitHub link status on this host:", github);
  await s.getByText("What recruiters see from your links").click();
  await expect(s.getByText(/AWS Certified Cloud Practitioner/).first()).toBeVisible();
  console.log("Claim labels:", (await s.locator("details li").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").slice(0, 90)).join(" || "));

  const href = await s.getByRole("link", { name: "resume.pdf" }).getAttribute("href");
  const file = await s.request.get(href!);
  expect(file.status()).toBe(200);
  expect(file.headers()["content-disposition"]).toContain("attachment");
  expect((await file.body()).subarray(0, 4).toString()).toBe("%PDF");

  // New device: recovery code gets back in; a wrong code does not.
  await s.getByRole("button", { name: "Sign out" }).click();
  await expect(s.getByRole("link", { name: "Get started" })).toBeVisible(); // signed out before going on
  await s.goto("/find");
  await s.getByLabel("Email address").fill(email); await s.getByLabel("Last name").fill(last); await s.getByLabel("Recovery code").fill("AAAA-BBBB-CCCC");
  await s.getByRole("button", { name: "Open my profile" }).click();
  await expect(s.getByText(/Those details do not match a profile/)).toBeVisible();
  await s.getByLabel("Email address").fill(email); await s.getByLabel("Last name").fill(last); await s.getByLabel("Recovery code").fill(code.toLowerCase().replace(/-/g, " "));
  await s.getByRole("button", { name: "Open my profile" }).click();
  await expect(s).toHaveURL(/\/me$/);
  expect((await (await browser.newContext()).request.get(new URL(href!, s.url()).toString())).status()).toBe(404);

  await s.getByLabel("Type DELETE to confirm").fill("DELETE");
  await s.getByRole("button", { name: "Delete everything" }).click();
  await expect(s.getByText("Profile deleted.")).toBeVisible();
  await ctx.close();
});

test("both phones register a physical bump; a closed line refuses new people", async ({ browser }) => {
  const rc = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const sc = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const r = await rc.newPage(), s = await sc.newPage();
  await signIn(r, "priya.raman@talentiq.demo");
  await expect(r).toHaveURL(/\/recruiter$/);

  // Close the line: a student who scans the badge cannot join.
  await r.getByText("Line settings").click();
  await r.getByLabel("Open to new people").uncheck();
  await r.getByRole("button", { name: "Save" }).click();
  await expect(r.locator("section[aria-labelledby='line-h']").getByText("Closed")).toBeVisible();
  await r.goto("/recruiter/badge");
  const badgePath = new URL((await r.locator("p.font-mono").filter({ hasText: "/c/" }).first().innerText()).trim()).pathname;

  await s.goto("/signup?next=" + encodeURIComponent(badgePath));
  await s.getByLabel(/^First name/).fill("Bo"); await s.getByLabel(/^Last name/).fill(`Bump${stamp}`); await s.getByLabel("Email", { exact: true }).fill(`bo.${stamp}@campus.example.edu`);
  await s.getByRole("button", { name: "Create my profile" }).click();
  await s.getByRole("link", { name: "I saved it, continue" }).click();
  await expect(s.getByText("Priya is not taking new people in line right now.")).toBeVisible();

  await r.goto("/recruiter");
  await r.getByText("Line settings").click();
  await r.getByLabel("Open to new people").check();
  await r.getByRole("button", { name: "Save" }).click();
  await expect(r.locator("section[aria-labelledby='line-h']").getByText("Open", { exact: true })).toBeVisible();

  // Both phones feel the knock: no buttons pressed after getting ready.
  await r.goto("/recruiter/badge");
  await r.getByRole("button", { name: "Get ready to receive" }).click();
  await s.goto("/tap");
  await s.getByRole("button", { name: "Get ready" }).click();
  // Wait until both phones are actually listening before knocking them together.
  await expect(r.getByText("Ready to receive.")).toBeVisible();
  await expect(s.getByText("Ready. Tap your phone against the recruiter's.")).toBeVisible();
  await bump(r); await bump(s);
  await expect(s.getByRole("heading", { name: "Sent to Priya Raman" })).toBeVisible();
  await expect(r.getByText(`Bo Bump${stamp}`).first()).toBeVisible({ timeout: 25_000 });
  await s.goto("/me");
  await s.getByLabel("Type DELETE to confirm").fill("DELETE");
  await s.getByRole("button", { name: "Delete everything" }).click();
  await rc.close(); await sc.close();
});

test("coordinator: account lifecycle, tags, study timer, plain-language search and export", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const a = await ctx.newPage();
  await signIn(a, "coordinator@talentiq.demo");
  await expect(a).toHaveURL(/\/recruiter$/);
  await a.goto("/admin");
  const email = `temp.${stamp}@talentiq.demo`;
  await a.getByLabel("Name", { exact: true }).fill("Temp Recruiter"); await a.getByLabel("Work email").fill(email);
  await a.getByRole("button", { name: "Create account" }).click();
  const temp = (await a.locator("code.select-all").first().innerText()).trim();
  expect(temp.length).toBeGreaterThan(10);

  const other = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await signIn(other, email, temp);
  await expect(other).toHaveURL(/\/recruiter$/);
  await other.goto("/admin");
  await expect(other).toHaveURL(/\/recruiter$/); // not a coordinator

  // Disabling the account signs it out and blocks sign-in.
  const row = a.locator("li", { hasText: email });
  await row.getByRole("button", { name: "Disable" }).click();
  await expect(row.locator(".pill").filter({ hasText: /^Disabled$/ })).toBeVisible();
  await other.goto("/recruiter");
  await expect(other).toHaveURL(/\/login$/);
  await signIn(other, email, temp);
  await expect(other.getByText(/do not match an active account/)).toBeVisible();

  await a.getByLabel("New tag").fill(`Demo ${stamp}`); await a.getByRole("button", { name: "Add tag" }).click();
  await expect(a.getByText(`Added “Demo ${stamp}”.`)).toBeVisible();
  await a.getByRole("button", { name: `Remove tag Demo ${stamp}` }).click();
  await expect(a.getByRole("button", { name: `Remove tag Demo ${stamp}` })).toHaveCount(0);

  await a.goto("/admin/study");
  await a.getByLabel("Participant code").fill(`P${stamp}`); await a.getByRole("button", { name: "Add participant" }).click();
  const run = a.locator("li", { hasText: `P${stamp}` }).first();
  await run.getByRole("button", { name: "Start timer" }).click();
  await expect(run.getByText("Running")).toBeVisible();
  await run.getByLabel("Records done").fill("4"); await run.getByLabel("Confidence (1 to 7)").selectOption("6");
  await run.getByRole("button", { name: "Stop and save" }).click();
  await expect(run.getByText(/Finished in/)).toBeVisible();
  expect(await (await a.request.get("/api/study/export")).text()).toContain(`P${stamp}`);
  await run.getByRole("button", { name: "Remove participant" }).click();

  await a.goto("/dashboard");
  await a.getByLabel("Ask in plain words").fill("Data Science students who know SQL");
  await a.getByRole("button", { name: "Find" }).click();
  await expect(a.getByText(/That was turned into the filters below/)).toBeVisible();
  const shown = await a.getByRole("status").filter({ hasText: "Showing" }).innerText();
  console.log("Plain-language search:", shown);
  expect(shown).not.toMatch(/Showing 0 of/);
  const csv = await (await a.request.get("/api/export?status=Interview%20Requested")).text();
  expect(csv.split("\r\n")[0]).toContain("Rating: communication (recruiter)");
  expect(csv).toContain("Maya Reyes");
  await ctx.close();
});
