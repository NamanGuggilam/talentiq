import path from "node:path";
import fs from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = process.env.E2E_PASSWORD ?? "local-demo-pass-123";
const SHOTS = process.env.E2E_SHOTS;
const stamp = Date.now().toString(36);
const student = { first: "Quinn", last: `Testerson${stamp}`, email: `quinn.${stamp}@campus.example.edu` };

const RESUME = `Quinn Testerson
${student.email}
University of Arkansas
B.S. in Computer Science, Expected May 2027
Skills: Python, SQL, React
- Built a shipment tracking dashboard with React and Python
- 2nd place, Campus Hack Night 2024
`;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

async function axe(page: Page, label: string) {
  // Let entrance animations finish: contrast is judged on the settled page, not a half-faded one.
  await page.waitForTimeout(1100);
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const summary = violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`);
  expect(summary, `accessibility violations on ${label}`).toEqual([]);
}

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/recruiter$/);
}

test("check-in through recruiter-approved follow-up status", async ({ browser }) => {
  const staff = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const r = await staff.newPage();
  const s = await phone.newPage();

  // Recruiter opens their badge.
  await signIn(r, "dana.lee@talentiq.demo");
  await r.goto("/recruiter/badge");
  const nfc = (await r.locator("p.font-mono").filter({ hasText: "/c/" }).first().innerText()).trim();
  const badgePath = new URL(nfc).pathname;
  await axe(r, "badge");
  await shot(r, "badge");

  // Student scans it with no profile, is sent to sign up, and comes back.
  await s.goto(badgePath);
  await expect(s.getByRole("heading", { name: "Make a profile to share" })).toBeVisible();
  await axe(s, "connect, signed out");
  await s.getByRole("link", { name: "Create my profile" }).click();
  await expect(s).toHaveURL(/\/signup\?next=/);
  await s.getByLabel("Resume", { exact: true }).setInputFiles({ name: "quinn-resume.txt", mimeType: "text/plain", buffer: Buffer.from(RESUME) });
  await expect(s.getByText("Resume read.")).toBeVisible({ timeout: 30_000 });
  // The rest of the profile is read from the resume; the student only sees what was found.
  await expect(s.getByLabel("Read from your resume").getByText("University of Arkansas")).toBeVisible();
  await s.getByLabel(/^Other files/).setInputFiles({ name: "hack-night-certificate.txt", mimeType: "text/plain", buffer: Buffer.from("Certificate of achievement\nCampus Hack Night 2024: 2nd place, awarded to Quinn Testerson\n") });
  await s.getByLabel(/^First name/).fill(student.first);
  await s.getByLabel(/^Last name/).fill(student.last);
  await s.getByLabel("Email", { exact: true }).fill(student.email);
  await s.getByLabel("What do you want to talk about?").fill("Software Engineering Intern");
  await axe(s, "signup");
  await shot(s, "signup-mobile");
  await s.getByRole("button", { name: "Create my profile" }).click();
  await expect(s.getByRole("heading", { name: "Save your recovery code" })).toBeVisible();
  const code = (await s.locator("p.select-all").innerText()).trim();
  expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  await shot(s, "recovery-code");
  await s.getByRole("link", { name: "I saved it, continue" }).click();

  // Nothing is shared until the student presses Share.
  // The badge link now leads with the virtual line; sharing straight away is the secondary path.
  await expect(s.getByRole("button", { name: "Join Dana's line" })).toBeVisible();
  await s.getByText("Already at the booth? Share without waiting").click();
  await expect(s.getByRole("heading", { name: "Share with this recruiter?" })).toBeVisible();
  await r.goto("/recruiter");
  await expect(r.getByRole("link", { name: `${student.first} ${student.last}` })).toHaveCount(0);
  await shot(s, "share-mobile");
  await s.getByRole("button", { name: "Share my profile" }).click();
  await expect(s.getByRole("heading", { name: /has your profile/ })).toBeVisible();
  await shot(s, "shared-mobile");

  // The recruiter's list picks the student up without a reload.
  await expect(r.getByRole("link", { name: `${student.first} ${student.last}`, exact: true })).toBeVisible({ timeout: 15_000 });
  await axe(r, "people I met");
  await shot(r, "people-i-met");
  await r.getByRole("link", { name: `${student.first} ${student.last}`, exact: true }).click();

  // Capture: tags, notes, the recruiter's own ratings.
  await expect(r).toHaveURL(/\/recruiter\/c\//);
  await r.getByRole("checkbox", { name: "Software", exact: true }).check({ force: true });
  await r.getByRole("textbox", { name: "Notes", exact: true }).fill("Walked through the shipment tracking dashboard. Seemed really passionate, probably a strong leader. I think they know AWS.");
  await r.getByLabel("Communication: 4 out of 5").check({ force: true });
  await r.getByLabel("Technical depth: 3 out of 5").check({ force: true });
  await expect(r.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
  await axe(r, "capture");
  await shot(r, "capture");
  await r.getByRole("button", { name: /Done, draft the summary/ }).click();
  await expect(r).toHaveURL(/tab=summary/, { timeout: 60_000 });

  // The draft cites sources, and the recruiter's hunches are not stated as fact anywhere in it.
  const draft = r.locator("section[aria-labelledby^='s-']");
  await expect(draft.first()).toBeVisible();
  const text = (await draft.allInnerTexts()).join(" ");
  expect(text).toMatch(/\[(Resume|Candidate|Recruiter note)/);
  expect(text).not.toMatch(/passionate|strong leader|\bAWS\b/i);
  expect(text).not.toMatch(/\b\d\s*\/\s*5\b|rating/i);
  await r.locator("section[aria-labelledby='s-snapshot'] li button").first().click();
  await expect(r.locator("aside mark").first()).toBeVisible();
  await axe(r, "summary");
  await shot(r, "summary");
  await r.getByRole("button", { name: "Approve summary" }).click();
  await expect(r.getByText("Approved. This summary is now part of the record.")).toBeVisible();
  await expect(r.getByText(/Approved by Dana Lee/)).toBeVisible();

  await r.getByRole("link", { name: "Evidence" }).click();
  await expect(r.getByText("Differences are things to ask about, not reasons to reject.")).toBeVisible();
  // The certificate uploaded next to the resume backs up the award claim.
  await expect(r.getByText(/Uploaded file · hack-night-certificate.txt/).first()).toBeVisible({ timeout: 30_000 });
  await axe(r, "evidence from an uploaded file");
  await shot(r, "evidence-file");

  await r.getByLabel("Status", { exact: true }).selectOption("Interview Requested");
  await r.waitForTimeout(400);
  await expect(r.getByLabel("Status", { exact: true })).toBeEnabled(); // the change has been saved
  await r.reload();
  await expect(r.getByLabel("Status", { exact: true })).toHaveValue("Interview Requested");

  // Review: search, refuse to rank, compare, export.
  await r.goto("/dashboard");
  await axe(r, "review");
  await shot(r, "review");
  await r.getByLabel("Ask in plain words").fill("who is the best candidate");
  await r.getByRole("button", { name: "Find" }).click();
  await expect(r.getByText("TalentIQ does not rank candidates.")).toBeVisible();
  await r.getByText("Filters and order").click();
  await r.getByLabel("Keywords").fill(student.last);
  await r.getByRole("button", { name: "Apply" }).click();
  await expect(r.getByRole("link", { name: `${student.first} ${student.last}` })).toBeVisible();
  await r.goto("/dashboard");
  const boxes = r.getByRole("checkbox", { name: /^Select / });
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await boxes.nth(2).check();
  await r.getByRole("link", { name: /Compare 3 side by side/ }).click();
  await expect(r.getByRole("heading", { name: "Side by side" })).toBeVisible();
  await axe(r, "compare");
  await shot(r, "compare");
  const csv = await r.request.get("/api/export");
  expect(csv.status()).toBe(200);
  const body = await csv.text();
  expect(body).toContain(student.last);
  expect(body).toContain("Interview Requested");

  // Interview Requested gives the student a time to book, and the recruiter sees what they picked.
  await s.goto("/me");
  await expect(s.getByText("Interview requested")).toBeVisible();
  await shot(s, "interview-invite");
  await s.getByRole("button", { name: "Book" }).click();
  await expect(s.getByText("Interview booked.")).toBeVisible();
  const ics = await s.request.get((await s.getByRole("link", { name: "Add to calendar" }).getAttribute("href"))!);
  expect(await ics.text()).toContain("BEGIN:VEVENT");
  await r.goto("/recruiter");
  await expect(r.locator("li", { hasText: student.last }).getByText(/^Interview (Mon|Tue|Wed|Thu|Fri|Sat|Sun)/)).toBeVisible();
  // NFC tag link: tapping it shares without a button press (already shared here, so it just confirms).
  await s.goto(badgePath + "?m=nfc");
  await expect(s.getByRole("heading", { name: /has your profile/ })).toBeVisible();

  // The student sees who has their profile, and can delete everything.
  await s.goto("/me");
  await expect(s.getByText("Dana Lee").first()).toBeVisible();
  await axe(s, "my profile");
  await shot(s, "me-mobile");
  await s.getByLabel("Type DELETE to confirm").fill("delete");
  await s.getByRole("button", { name: "Delete everything" }).click();
  await expect(s.getByText("Profile deleted.")).toBeVisible();
  await r.goto("/recruiter");
  await expect(r.getByRole("link", { name: `${student.first} ${student.last}` })).toHaveCount(0);

  await staff.close();
  await phone.close();
});

test("the scripted demo candidate shows every evidence label", async ({ page }) => {
  await signIn(page, "dana.lee@talentiq.demo");
  await page.getByRole("link", { name: "Maya Reyes", exact: true }).click();
  await page.getByRole("link", { name: /Evidence/ }).click();
  for (const label of ["Verified", "Partial", "Discrepancy", "Not found"]) await expect(page.locator(".pill", { hasText: new RegExp(`^${label}$`) }).first()).toBeVisible();
  await expect(page.getByText("The resume says 1st place; the linked page says 2nd.")).toBeVisible();
  await expect(page.getByText("Rust", { exact: true })).toBeVisible();
  // No totals, no percentage, no score anywhere on the evidence tab.
  const body = await page.locator("#main").innerText();
  expect(body).not.toMatch(/score|\d+\s*%|\bout of\b/i);
  await axe(page, "evidence");
  await shot(page, "evidence");
});

test("access is refused where it should be", async ({ browser, request }) => {
  for (const p of ["/recruiter", "/dashboard", "/admin", "/admin/study", "/account", "/recruiter/badge"]) {
    const res = await request.get(p, { maxRedirects: 0 });
    expect(res.status(), p).toBe(307);
    expect(res.headers().location).toContain("/login");
  }
  expect((await request.get("/api/export")).status()).toBe(401);
  expect((await request.get("/api/pulse")).status()).toBe(401);
  expect((await request.get("/api/resume/00000000-0000-4000-8000-000000000000")).status()).toBe(404);
  expect((await request.post("/api/resume/parse", { headers: { origin: "https://evil.example" }, multipart: { resume: { name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("x".repeat(50)) } } })).status()).toBe(403);

  // A recruiter is not a coordinator.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page, "sam.ortiz@talentiq.demo");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/recruiter$/);
  expect((await page.request.get("/api/study/export")).status()).toBe(404);
  const res = await page.goto("/");
  const csp = res!.headers()["content-security-policy"];
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toMatch(/script-src 'self' 'nonce-/);
  expect(res!.headers()["x-content-type-options"]).toBe("nosniff");
  await ctx.close();
});

test("public pages pass automated accessibility checks", async ({ page }) => {
  for (const p of ["/", "/login", "/signup", "/find", "/mock/github/mayar"]) {
    await page.goto(p);
    await page.waitForTimeout(p === "/" ? 2600 : 900);
    await axe(page, p);
    if (p === "/" || p === "/login") await shot(page, p === "/" ? "home" : "login");
  }
});

test("coordinator pages work and pass accessibility checks", async ({ page }) => {
  await signIn(page, "coordinator@talentiq.demo");
  await page.goto("/admin");
  await page.getByLabel("New tag").fill("Best candidate");
  await page.getByRole("button", { name: "Add tag" }).click();
  await expect(page.getByText(/cannot be a verdict or a personal trait/)).toBeVisible();
  await axe(page, "admin");
  await shot(page, "admin");
  await page.goto("/admin/study");
  await expect(page.getByRole("heading", { name: "Study", exact: true })).toBeVisible();
  await axe(page, "study");
  await shot(page, "study");
  expect((await page.request.get("/api/study/export")).status()).toBe(200);
});

test("two phones tap to exchange a profile and a contact card", async ({ browser }) => {
  const staffCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const r = await staffCtx.newPage();
  const s = await phoneCtx.newPage();
  const last = `Tapper${Date.now().toString(36)}`;

  await s.goto("/signup");
  await s.getByLabel(/^First name/).fill("Rin");
  await s.getByLabel(/^Last name/).fill(last);
  await s.getByLabel("Email", { exact: true }).fill(`rin.${last.toLowerCase()}@campus.example.edu`);
  await s.getByRole("button", { name: "Create my profile" }).click();
  await s.getByRole("link", { name: "I saved it, continue" }).click();
  await s.goto("/tap");
  await s.getByRole("button", { name: "Get ready" }).click();

  // With no recruiter phone tapping, nothing is found and nothing is shared.
  await s.getByRole("button", { name: "Tap now" }).click();
  await expect(s.getByText(/No recruiter phone answered/)).toBeVisible({ timeout: 15_000 });

  await signIn(r, "priya.raman@talentiq.demo");
  await r.goto("/recruiter/badge");
  await r.getByRole("button", { name: "Get ready to receive" }).click();
  await axe(r, "badge with tap receiver");
  await axe(s, "tap");
  await shot(s, "tap-mobile");

  // Recruiter taps; the student's phone registers a physical bump (a sharp jump in acceleration).
  await r.getByRole("button", { name: "Tap now" }).click();
  await s.evaluate(() => {
    const send = (x: number) => window.dispatchEvent(new DeviceMotionEvent("devicemotion", { acceleration: { x, y: 0, z: 0 } }));
    send(0); send(25);
  });
  // One recruiter answered, so it sends on its own after a short pause.
  await expect(s.getByText("Sending to Priya…")).toBeVisible({ timeout: 15_000 });
  await expect(s.getByRole("heading", { name: "Sent to Priya Raman" })).toBeVisible();
  await shot(s, "tap-sent");
  await expect(r.getByText(`Rin ${last}`).first()).toBeVisible({ timeout: 20_000 });

  const href = await s.getByRole("link", { name: /Save Priya's contact/ }).getAttribute("href");
  const card = await s.request.get(href!);
  expect(card.status()).toBe(200);
  expect(await card.text()).toContain("FN:Priya Raman");
  // A student who has not shared with a recruiter cannot fetch that recruiter's card.
  const other = await browser.newContext();
  expect((await other.request.get(new URL(href!, "http://localhost:3210").toString())).status()).toBe(404);

  await s.goto("/me");
  await s.getByLabel("Type DELETE to confirm").fill("DELETE");
  await s.getByRole("button", { name: "Delete everything" }).click();
  await staffCtx.close(); await phoneCtx.close(); await other.close();
});

test("recruiters get a desktop layout; students stay in the phone layout", async ({ browser }) => {
  const wide = { viewport: { width: 1440, height: 900 } };
  const staff = await (await browser.newContext(wide)).newPage();
  await signIn(staff, "dana.lee@talentiq.demo");
  await expect(staff.locator("nav.topnav")).toBeVisible();
  await expect(staff.locator("nav.dock")).toBeHidden();
  expect((await staff.locator("main .shell").first().boundingBox())!.width).toBeGreaterThan(1000);
  await axe(staff, "people I met, desktop");
  await shot(staff, "desktop-people");
  await staff.getByRole("link", { name: "Maya Reyes", exact: true }).click();
  await staff.getByRole("link", { name: "Summary" }).click();
  await axe(staff, "summary, desktop");
  await shot(staff, "desktop-summary");
  await staff.goto("/dashboard");
  await shot(staff, "desktop-review");

  const student = await (await browser.newContext(wide)).newPage();
  await student.goto("/signup");
  expect((await student.locator("main .shell").first().boundingBox())!.width).toBeLessThanOrEqual(480);
  await expect(student.locator("nav.topnav")).toHaveCount(0);
});

test("a student is matched to a line by interest, called, and tapped in; nobody called is lost", async ({ browser }) => {
  const staffCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const r = await staffCtx.newPage();
  const s = await phoneCtx.newPage();
  const last = `Liner${Date.now().toString(36)}`;

  await signIn(r, "sam.ortiz@talentiq.demo");
  await r.goto("/recruiter/badge");
  const badgePath = new URL((await r.locator("p.font-mono").filter({ hasText: "/c/" }).first().innerText()).trim()).pathname;
  await r.goto("/recruiter");
  await expect(r.getByText("3 waiting")).toBeVisible();

  // The student never picks a recruiter: what they say they want decides the line.
  await s.goto("/signup");
  await s.getByLabel(/^First name/).fill("Len");
  await s.getByLabel(/^Last name/).fill(last);
  await s.getByLabel("Email", { exact: true }).fill(`len.${last.toLowerCase()}@campus.example.edu`);
  await s.getByLabel("What do you want to talk about?").fill("Software engineering, routing");
  await s.getByRole("button", { name: "Create my profile" }).click();
  await expect(s.getByText("You are in Sam Ortiz's line")).toBeVisible();
  await shot(s, "line-placed");
  await s.getByRole("link", { name: "I saved it, continue" }).click();
  await expect(s).toHaveURL(/\/line$/);
  await expect(s.getByText(/Number 4 in line · about 12 min/)).toBeVisible();
  await expect(s.getByRole("heading", { name: "Other recruiters" })).toBeVisible();
  await axe(s, "my place in line");
  await shot(s, "line-waiting");
  // Scanning that recruiter's badge shows the place they already have.
  await s.goto(badgePath);
  await expect(s.getByText("You are in Sam's line.")).toBeVisible();
  await s.getByRole("link", { name: "See my place in line" }).click();

  // The recruiter's panel picks the new person up without a reload.
  await expect(r.getByText("4 waiting")).toBeVisible({ timeout: 15_000 });
  await axe(r, "people I met with line");
  await shot(r, "line-recruiter");

  // First person: called, no tap, started by hand. They are saved, with notes and ratings, not dropped.
  await r.getByRole("button", { name: "Call next" }).click();
  await expect(r.getByRole("button", { name: "Call next" })).toHaveCount(0); // nobody else can be called over them
  await expect(s.getByText(/Number 3 in line/)).toBeVisible({ timeout: 15_000 });
  const firstName = ((await r.locator("section[aria-labelledby='line-h'] p.text-3xl").textContent()) ?? "").trim();
  await shot(r, "line-called-recruiter");
  await r.getByRole("button", { name: "Start without tap" }).click();
  await expect(r).toHaveURL(/\/recruiter\/c\//);
  await expect(r.getByRole("heading", { name: firstName, level: 1 })).toBeVisible();
  await r.getByRole("textbox", { name: "Notes", exact: true }).fill("Came from the line. Talked about the load board prototype.");
  await r.getByLabel("Interest in the role: 5 out of 5").check({ force: true });
  await expect(r.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
  await r.goto("/recruiter");
  await expect(r.getByRole("link", { name: firstName, exact: true }).first()).toBeVisible();
  await expect(r.getByText("From the line").first()).toBeVisible();

  // Second person does not show up: they move to Missed, and can be put back.
  await r.getByRole("button", { name: "Call next" }).click();
  const missedName = ((await r.locator("section[aria-labelledby='line-h'] p.text-3xl").textContent()) ?? "").trim();
  await r.getByRole("button", { name: "Did not show up" }).click();
  await expect(r.getByText("Missed")).toBeVisible();
  await expect(r.getByRole("button", { name: "Put back in line" })).toBeVisible();

  // Third person started by hand too, then it is our student's turn.
  await r.getByRole("button", { name: "Call next" }).click();
  await r.getByRole("button", { name: "Start without tap" }).click();
  await expect(r).toHaveURL(/\/recruiter\/c\//);
  await r.goto("/recruiter");
  await r.getByRole("button", { name: "Call next" }).click();
  await expect(r.locator("section[aria-labelledby='line-h'] p.text-3xl")).toHaveText(`Len ${last}`);

  // Calling turns tap on for the recruiter. The student sees "Go!" and stays there until they choose to tap.
  await expect(r.getByText("Ready. Tap phones with Len.")).toBeVisible();
  await expect(s.getByRole("alert").filter({ hasText: "Sam Ortiz is ready for you now." })).toBeVisible({ timeout: 15_000 });
  await s.waitForTimeout(4000);
  await expect(s).toHaveURL(/\/line$/);
  await shot(s, "line-go");
  await s.getByRole("link", { name: "Tap phones" }).click();
  await expect(s).toHaveURL(/\/tap$/);
  await expect(s.getByText("Sam Ortiz is ready for you. Tap your phone against theirs.")).toBeVisible();
  await shot(s, "line-called");
  await r.getByRole("button", { name: "Tap now" }).click();
  await s.getByRole("button", { name: "Tap now" }).click();
  await expect(s.getByRole("heading", { name: "Sent to Sam Ortiz" })).toBeVisible();

  // The recruiter is taken straight to the student's notes; the student is out of the line and in the list.
  await expect(r).toHaveURL(/\/recruiter\/c\//, { timeout: 25_000 });
  await expect(r.getByRole("heading", { name: `Len ${last}`, level: 1 })).toBeVisible();
  await s.goto("/line");
  await expect(s.getByText("You are not in a line")).toBeVisible();
  await r.goto("/recruiter");
  await expect(r.getByRole("link", { name: `Len ${last}`, exact: true }).first()).toBeVisible();
  await expect(r.getByText("Phone tap").first()).toBeVisible();

  // Everyone who was called is accounted for: two started by hand, one tapped, one on Missed. Review has them too.
  await r.getByRole("button", { name: "Put back in line" }).click();
  await expect(r.getByText("1 waiting")).toBeVisible();
  await expect(r.getByText(missedName).first()).toBeVisible();
  await r.goto("/dashboard");
  await expect(r.getByRole("link", { name: firstName, exact: true }).first()).toBeVisible();

  await s.goto("/me");
  await s.getByLabel("Type DELETE to confirm").fill("DELETE");
  await s.getByRole("button", { name: "Delete everything" }).click();
  await staffCtx.close(); await phoneCtx.close();
});

test("each demo address shows its own version, and tap stays off the desktop layout", async ({ browser }) => {
  const wide = { viewport: { width: 1440, height: 900 } };
  // Student address: no recruiter entry point, phone layout even on a wide window.
  const student = await (await browser.newContext(wide)).newPage();
  await student.goto("http://localhost:3212/");
  await expect(student.getByRole("link", { name: "Get started" })).toBeVisible();
  await expect(student.getByRole("link", { name: "Recruiter sign in" })).toHaveCount(0);
  expect((await student.locator("main .shell").first().boundingBox())!.width).toBeLessThanOrEqual(480);

  // Recruiter phone address: phone layout and the tap receiver, even on a wide window.
  const phone = await (await browser.newContext(wide)).newPage();
  await phone.goto("http://localhost:3211/");
  await expect(phone).toHaveURL(/3211\/login/);
  await phone.getByLabel("Work email").fill("dana.lee@talentiq.demo");
  await phone.getByLabel("Password").fill(PASSWORD);
  await phone.getByRole("button", { name: "Sign in" }).click();
  await expect(phone).toHaveURL(/3211\/recruiter$/);
  await expect(phone.locator("nav.dock")).toBeVisible();
  expect((await phone.locator("main .shell").first().boundingBox())!.width).toBeLessThanOrEqual(480);
  await phone.goto("http://localhost:3211/recruiter/badge");
  await expect(phone.getByRole("heading", { name: "Receive by tap" })).toBeVisible();
  expect(await phone.locator("p.font-mono").filter({ hasText: "/c/" }).first().innerText()).toContain("localhost:3212/c/");

  // Recruiter desktop address: wide layout, and no tap receiver.
  const desk = await (await browser.newContext(wide)).newPage();
  await signIn(desk, "dana.lee@talentiq.demo");
  await desk.goto("/recruiter/badge");
  await expect(desk.getByRole("heading", { name: "Receive by tap" })).toBeHidden();
  await expect(desk.getByRole("heading", { name: "My badge" })).toBeVisible();
});

test("a browser signed in as both a recruiter and a student shows each side its own screens", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const last = `Both${Date.now().toString(36)}`;
  await signIn(page, "priya.raman@talentiq.demo");
  await page.goto("/signup");
  await page.getByLabel(/^First name/).fill("Kai"); await page.getByLabel(/^Last name/).fill(last); await page.getByLabel("Email", { exact: true }).fill(`kai.${last.toLowerCase()}@campus.example.edu`);
  await page.getByRole("button", { name: "Create my profile" }).click();
  await page.getByRole("link", { name: "I saved it, continue" }).click();
  await expect(page).toHaveURL(/\/line$/);

  // Student screens: student tabs, phone width, no recruiter navigation. This must hold across the page's own refreshes.
  for (const path of ["/line", "/tap", "/me"]) {
    await page.goto(path);
    await page.waitForTimeout(path === "/line" ? 8000 : 500);
    await expect(page.locator("nav.dock").getByRole("link", { name: "Line" })).toBeVisible();
    await expect(page.locator("nav.dock").getByRole("link", { name: "People" })).toHaveCount(0);
    await expect(page.locator("nav.topnav")).toHaveCount(0);
    expect((await page.locator("main .shell").first().boundingBox())!.width, path).toBeLessThanOrEqual(480);
  }
  // Recruiter screens in the same browser: recruiter navigation and the desktop layout.
  await page.goto("/recruiter");
  await expect(page.locator("nav.topnav").getByRole("link", { name: "People" })).toBeVisible();
  expect((await page.locator("main .shell").first().boundingBox())!.width).toBeGreaterThan(1000);
  // Signing the student out leaves the recruiter signed in, and the reverse.
  await page.goto("/me");
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByRole("button", { name: "Delete everything" }).click();
  await page.goto("/recruiter");
  await expect(page.getByRole("heading", { name: "People", level: 1 })).toBeVisible();
  await ctx.close();
});

test("tapping a recruiter's NFC tag shares the profile with no button press", async ({ browser }) => {
  const r = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const s = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  const last = `Nfc${Date.now().toString(36)}`;
  await signIn(r, "dana.lee@talentiq.demo");
  await r.goto("/recruiter/badge");
  const nfcPath = new URL((await r.locator("p.font-mono").filter({ hasText: "/c/" }).first().innerText()).trim());
  await s.goto("/signup");
  await s.getByLabel(/^First name/).fill("Mei"); await s.getByLabel(/^Last name/).fill(last); await s.getByLabel("Email", { exact: true }).fill(`mei.${last.toLowerCase()}@campus.example.edu`);
  await s.getByRole("button", { name: "Create my profile" }).click();
  await s.getByRole("link", { name: "I saved it, continue" }).click();
  // The phone opens the tag's link. Nothing else is pressed.
  await s.goto(nfcPath.pathname + nfcPath.search);
  await expect(s.getByText("Sending to Dana…")).toBeVisible();
  await expect(s.getByRole("heading", { name: /Dana Lee has your profile/ })).toBeVisible();
  await r.goto("/recruiter");
  await expect(r.locator("li", { hasText: last }).getByText(/NFC tag/)).toBeVisible();
  await s.goto("/me");
  await s.getByLabel("Type DELETE to confirm").fill("DELETE");
  await s.getByRole("button", { name: "Delete everything" }).click();
});
