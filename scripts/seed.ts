// Loads a synthetic career fair: staff, tags, students with resumes and demo profile pages, conversations and summaries.
// Usage: npm run seed            (refuses if data exists)
//        npm run seed -- --reset (wipes everything first)
// Everything here is made up. No real person is described.
process.env.AI_PROVIDER = "mock"; // seeding never spends API credit

import { sql } from "drizzle-orm";
import { db, dbReady, schema } from "../src/db";
import type { ExtractedFacts, LinkKind, RecordStatus } from "../src/db/schema";
import { mockSummarize } from "../src/lib/ai/mock";
import { hashSecret, randomToken, tempPassword } from "../src/lib/crypto";
import { runEvidencePipeline } from "../src/lib/evidence";
import { summaryInput } from "../src/lib/records";

const FIRST = ["Maya", "Liam", "Noah", "Ava", "Ethan", "Zoe", "Lucas", "Isla", "Mason", "Ruby", "Omar", "Priya", "Diego", "Hana", "Caleb", "Nadia", "Theo", "Imani", "Felix", "Sofia", "Jonah", "Leila", "Marcus", "Elena", "Ravi", "Tessa", "Andre", "Mina", "Owen", "Farah", "Gabe", "Yuki", "Silas", "Amara", "Reid", "Lena"];
const LAST = ["Reyes", "Nguyen", "Patel", "Garcia", "Smith", "Kim", "Johnson", "Lopez", "Brown", "Khan", "Davis", "Miller", "Wilson", "Okafor", "Chen", "Haddad", "Novak", "Banerjee", "Schmidt", "Alvarez", "Park", "Rahman", "Costa", "Ivanova", "Mehta", "Bianchi", "Dubois", "Sato", "Walker", "Aziz", "Torres", "Tanaka", "Murphy", "Eze", "Larsen", "Fischer"];
const UNIS = ["University of Arkansas", "Texas A&M University", "Oklahoma State University", "Missouri State University", "University of Tulsa"];
const TRACKS = [
  { major: "Computer Science", fn: "Software Engineering Intern", skills: ["Python", "TypeScript", "React", "SQL", "Docker", "Git"], interests: ["Routing", "Backend services"], project: ["Built a route planning web app with React and Python", "Developed a REST API for shipment tracking with Node.js and PostgreSQL"] },
  { major: "Data Science", fn: "Data Analytics Intern", skills: ["Python", "SQL", "Pandas", "Tableau", "Machine Learning"], interests: ["Forecasting", "Data pipelines"], project: ["Built a demand forecasting model in Python with Pandas", "Created a Tableau dashboard tracking on-time delivery"] },
  { major: "Supply Chain Management", fn: "Logistics Technology Intern", skills: ["Excel", "SQL", "Power BI", "Tableau"], interests: ["Network design", "Carrier operations"], project: ["Designed a warehouse slotting analysis in Excel", "Developed a Power BI report on carrier dwell time"] },
  { major: "Industrial Engineering", fn: "Operations Research Intern", skills: ["Python", "MATLAB", "Excel", "Operations Research", "SQL"], interests: ["Optimization", "Simulation"], project: ["Built a vehicle routing solver in Python", "Implemented a queue simulation of a cross-dock in MATLAB"] },
  { major: "Information Systems", fn: "Software Engineering Intern", skills: ["Java", "SQL", "AWS", "JavaScript", "Git"], interests: ["Cloud platforms", "Integration"], project: ["Developed an inventory service in Java on AWS", "Created a load board prototype in JavaScript"] },
];
const CITIES = ["Lowell AR", "Dallas TX", "Chicago IL", "Kansas City MO", "Remote"];
const AUTH = ["Authorized to work in the U.S.", "Authorized to work in the U.S.", "Will require sponsorship", "", "Authorized to work in the U.S.", "Prefer not to say"];
const pick = <T,>(a: readonly T[], i: number) => a[((i % a.length) + a.length) % a.length];
const handle = (i: number) => `${FIRST[i].toLowerCase()}${LAST[i].toLowerCase().slice(0, 1)}`;

type Seed = { i: number; first: string; last: string; email: string; uni: string; track: (typeof TRACKS)[number]; grad: string; gpa: string; resume: string; links: Partial<Record<LinkKind, string>>; consent: boolean; mock: { kind: LinkKind; facts: ExtractedFacts }[] };

/** Student 0 is the scripted demo case: one verified claim, one discrepancy, one partial, one not found, one extra skill. */
function demoStudent(): Seed {
  const resume = `Maya Reyes
maya.reyes@uark.example.edu | (479) 555-0142
University of Arkansas
B.S. in Computer Science, Expected May 2027
GPA: 3.7
Coursework: Data Structures, Databases, Operating Systems, Operations Research

Skills: Python, TypeScript, React, SQL, AWS, Docker, Git

Experience
- Software Engineering Intern, Ozark Freight Labs, Summer 2025
- Built a dwell-time prediction service in Python used by two dock teams

Projects
- Built LoadLens, a hackathon project that predicts dwell time at docks
- Led a team of 4 at NWA Freight Hackathon 2023, Best Use of Data prize
- Developed a vehicle routing solver with time windows in Python

Awards and certifications
- 1st place, Arkansas State Science and Engineering Fair 2019
- AWS Certified Solutions Architect Associate
- CompTIA Security+ certification
`;
  return {
    i: 0, first: "Maya", last: "Reyes", email: "maya.reyes@uark.example.edu", uni: "University of Arkansas", track: TRACKS[0], grad: "May 2027", gpa: "3.7", resume, consent: true,
    links: { github: "/mock/github/mayar", devpost: "/mock/devpost/mayar", credly: "/mock/credly/mayar", site: "/mock/site/mayar" },
    mock: [
      { kind: "github", facts: { title: "mayar on GitHub", languages: ["Python", "TypeScript", "Rust"],
        repos: [{ name: "route-solver", description: "Vehicle routing with time windows", language: "Python", created: "2023", pushed: "2026", stars: 140 }, { name: "loadlens", description: "Hackathon project: predicts dwell time at docks", language: "TypeScript", created: "2023", pushed: "2024", stars: 32 }, { name: "geo-h3-index", description: "Fast geospatial lookup service", language: "Rust", created: "2025", pushed: "2026", stars: 57 }],
        lines: ["14 public repositories, active from 2020 to 2026.", "Languages across public repositories: Python, TypeScript, Rust.", "Repository route-solver: Vehicle routing solver with time windows in Python. Main language Python. Created 2023, last updated 2026. 140 stars.", "Repository loadlens: Hackathon project that predicts dwell time at docks. Main language TypeScript. Created 2023, last updated 2024. 32 stars.", "Repository geo-h3-index: Fast geospatial lookup service. Main language Rust. Created 2025, last updated 2026. 57 stars."] } },
      { kind: "devpost", facts: { title: "Maya Reyes on Devpost", projects: [{ title: "LoadLens", event: "NWA Freight Hackathon 2023", prize: "Best Use of Data", teamSize: 4 }],
        lines: ["LoadLens, NWA Freight Hackathon 2023, team of 4, Best Use of Data prize.", "LoadLens predicts dwell time at docks from gate and appointment data.", "Team: Maya Reyes, J. Ortega, K. Lindqvist, A. Bose."] } },
      { kind: "credly", facts: { title: "Maya Reyes on Credly", badges: [{ name: "AWS Certified Solutions Architect Associate", issuer: "Amazon Web Services", issued: "March 2025", expires: "March 2028" }, { name: "Terraform Associate", issuer: "HashiCorp", issued: "January 2026" }],
        lines: ["AWS Certified Solutions Architect Associate, issued by Amazon Web Services, March 2025, expires March 2028.", "Terraform Associate, issued by HashiCorp, January 2026."] } },
      { kind: "site", facts: { title: "Maya Reyes", lines: ["Arkansas State Science and Engineering Fair 2019: 2nd place, Computer Science category.", "Software Engineering Intern at Ozark Freight Labs, Summer 2025.", "Talk: Routing with time windows, Northwest Arkansas Python meetup, 2025."] } },
    ],
  };
}

function student(i: number): Seed {
  if (i === 0) return demoStudent();
  const first = FIRST[i], last = LAST[i], track = pick(TRACKS, i), uni = pick(UNIS, i * 3 + 1);
  const grad = pick(["May 2027", "December 2026", "May 2026", "May 2028", ""], i);
  const gpa = i % 4 === 0 ? "" : (3 + ((i * 7) % 10) / 10).toFixed(1);
  const skills = track.skills.slice(0, 3 + (i % 3));
  const email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@campus.example.edu`;
  const cert = i % 5 === 1 ? "- AWS Certified Cloud Practitioner\n" : i % 5 === 3 ? "- Tableau Desktop Specialist certification\n" : "";
  const placed = pick(["1st", "2nd", "3rd"], i);
  const award = i % 3 === 0 ? `- ${placed} place, ${pick(["Razorback Data Challenge", "Heartland Logistics Case Competition", "Campus Hack Night"], i)} ${2023 + (i % 3)}\n` : "";
  const resume = `${first} ${last}
${email}${i % 6 === 2 ? "" : ` | (479) 555-${String(1000 + i * 37).slice(0, 4)}`}
${uni}
B.S. in ${track.major}${grad ? `, Expected ${grad}` : ""}
${gpa ? `GPA: ${gpa}\n` : ""}Coursework: ${pick(["Data Structures, Databases", "Statistics, Linear Programming", "Logistics Systems, Databases", "Algorithms, Networks"], i)}

Skills: ${skills.join(", ")}

Experience
- ${pick(["Operations Intern", "Teaching Assistant", "IT Help Desk Assistant", "Research Assistant"], i)}, ${pick(["Ozark Freight Labs", "Campus Computing", "Heartland Carriers", "Transportation Research Lab"], i)}, ${pick(["Summer 2025", "2024 to 2025", "Fall 2025"], i)}

Projects
- ${pick(track.project, i)}
- ${pick(track.project, i + 1)}
${award || cert ? `\nAwards and certifications\n${award}${cert}` : ""}`;

  const mock: Seed["mock"] = [];
  const links: Seed["links"] = {};
  if (i % 3 === 1) {
    const h = handle(i);
    const extra = pick(["Go", "Rust", "Kotlin", "Swift"], i);
    links.github = `/mock/github/${h}`;
    mock.push({ kind: "github", facts: { title: `${h} on GitHub`, languages: [...skills.filter((s) => ["Python", "TypeScript", "Java", "JavaScript", "MATLAB"].includes(s)), extra],
      lines: [`${4 + (i % 6)} public repositories, active from ${2021 + (i % 3)} to 2026.`, `Languages across public repositories: ${[...skills.filter((s) => ["Python", "TypeScript", "Java", "JavaScript", "MATLAB"].includes(s)), extra].join(", ")}.`, `Repository capstone: ${pick(track.project, i).replace(/^(Built|Developed|Created|Designed|Implemented) /, "")}. Created 2025, last updated 2026.`, `Repository ${extra.toLowerCase()}-playground: Small experiments in ${extra}. Main language ${extra}. Created 2025, last updated 2025.`] } });
  }
  if (award && i % 2 === 0) {
    const h = handle(i);
    // Every other award page disagrees with the resume by one place, so the demo has discrepancies beyond the scripted one.
    const shown = i % 4 === 0 ? pick(["2nd", "3rd", "1st"], i) : placed;
    links.devpost = `/mock/devpost/${h}`;
    mock.push({ kind: "devpost", facts: { title: `${first} ${last} on Devpost`, lines: [`${award.match(/place, (.*) \d{4}/)?.[1]} ${2023 + (i % 3)}: ${shown} place.`, `Team of ${2 + (i % 3)}.`] } });
  }
  if (cert && i % 5 === 1) {
    links.credly = `/mock/credly/${handle(i)}`;
    mock.push({ kind: "credly", facts: { title: `${first} ${last} on Credly`, badges: [{ name: "AWS Certified Cloud Practitioner", issuer: "Amazon Web Services", issued: "2025" }], lines: ["AWS Certified Cloud Practitioner, issued by Amazon Web Services, 2025."] } });
  }
  return { i, first, last, email, uni, track, grad, gpa, resume, links, consent: Object.keys(links).length > 0 && i % 9 !== 4, mock };
}

const NOTES = [
  ["Routing engine team, summer internship", "Walked through the routing project. Used OR-Tools, hit scaling limits around 400 stops and switched to a heuristic. Wants to work on dispatch tooling.", "Asked how interns are matched to teams.", "Ask about test coverage on the solver.", "Send the engineering internship posting"],
  ["Data platform, forecasting", "Described the forecasting model and how it was checked against held-out weeks. Comfortable with SQL window functions. Has not used Spark.", "Asked about mentorship and the rotation programme.", "", "Intro to the analytics manager"],
  ["Carrier operations, network planning", "Talked through the slotting analysis. Interested in network design. Open to relocating to Lowell.", "Asked what a first project looks like.", "Confirm graduation term.", "Invite to the supply chain info session"],
  ["Cloud integration", "Explained the inventory service design and why they chose a queue between services. Said they owned the API layer.", "", "Ask which parts of the AWS setup they did themselves.", ""],
  ["Operations research", "Simulation project for a cross-dock. Clear on assumptions and where the model breaks. Interested in a spring co-op as well.", "Asked about sponsorship timelines.", "Check work authorization.", "Follow up after the fair with co-op details"],
];
const STATUSES: RecordStatus[] = ["Interview Requested", "Follow-Up", "Reviewed", "New", "Follow-Up", "Reviewed", "Closed", "New"];

async function main() {
  await dbReady;
  const reset = process.argv.includes("--reset");
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.events);
  if (n > 0 && !reset) { console.log("Database already has data. Run `npm run seed -- --reset` to wipe and reseed."); return; }
  if (reset) await db.execute(sql`truncate table queue_entries, taps, metrics_events, study_sessions, summaries, observations, claims, evidence_sources, connections, resumes, sessions, tags, mock_profiles, rate_limits, candidates, recruiters, events cascade`);

  const [event] = await db.insert(schema.events).values({ name: "Fall Engineering Career Fair (synthetic)", company: "J.B. Hunt", startsAt: new Date() }).returning();
  const staffSpec = [
    { name: "Morgan Ellis", title: "Recruiting Coordinator", email: "coordinator@talentiq.demo", role: "coordinator" as const },
    { name: "Dana Lee", title: "University Recruiter", email: "dana.lee@talentiq.demo", role: "recruiter" as const, focus: "Data science, analytics, forecasting, data pipelines" },
    { name: "Sam Ortiz", title: "Engineering Manager", email: "sam.ortiz@talentiq.demo", role: "recruiter" as const, focus: "Software engineering, routing, backend services, cloud platforms" },
    { name: "Priya Raman", title: "University Recruiter", email: "priya.raman@talentiq.demo", role: "recruiter" as const, focus: "Supply chain, logistics, operations research, network design" },
  ];
  const creds: { email: string; role: string; password: string }[] = [];
  const staff = [];
  for (const s of staffSpec) {
    const password = process.env.SEED_PASSWORD ?? tempPassword();
    creds.push({ email: s.email, role: s.role, password });
    const [r] = await db.insert(schema.recruiters).values({ ...s, eventId: event.id, passwordHash: await hashSecret(password), connectToken: randomToken(12) }).returning();
    staff.push(r);
  }
  const recruiters = staff.slice(1);
  const TAGS = ["Software", "Data", "Supply Chain", "Operations", "Internship", "Full-time", "Co-op", "Relocation OK", "Has portfolio", "Follow up on project", "Sponsorship question"];
  await db.insert(schema.tags).values(TAGS.map((label, position) => ({ eventId: event.id, label, position })));

  const seeds = Array.from({ length: 36 }, (_, i) => student(i));
  const ids: string[] = [];
  for (const s of seeds) {
    const noProfile = s.i % 7 === 5; // a few sparse profiles, so "missing information" has something to flag
    const [c] = await db.insert(schema.candidates).values({
      firstName: s.first, lastName: s.last, email: s.email, phone: s.i % 6 === 2 ? null : `(479) 555-${String(1000 + s.i * 37).slice(0, 4)}`,
      university: s.uni, degreeProgram: "B.S.", major: s.track.major, graduationDate: s.grad || null, gpa: s.gpa || null,
      workAuthorization: pick(AUTH, s.i) || null, desiredFunction: noProfile ? null : s.track.fn,
      technicalInterests: noProfile ? [] : s.track.interests, preferredLocations: s.i % 5 === 3 ? [] : [pick(CITIES, s.i), pick(CITIES, s.i + 2)].filter((v, k, a) => a.indexOf(v) === k),
      skills: s.i === 0 ? ["Python", "TypeScript", "React", "SQL", "AWS", "Docker", "Git"] : s.track.skills.slice(0, 3 + (s.i % 3)),
      coursework: ["Data Structures", "Databases"], projects: s.resume.split("\n").filter((l) => /^- (Built|Developed|Created|Designed|Implemented|Led)/.test(l)).map((l) => l.slice(2)),
      links: s.links, scrapeConsentAt: s.consent ? new Date() : null, recoveryHash: await hashSecret(tempPassword()),
    }).returning();
    ids.push(c.id);
    await db.insert(schema.resumes).values({ candidateId: c.id, fileName: `${s.first}-${s.last}-resume.txt`, mime: "text/plain", size: s.resume.length, fileB64: Buffer.from(s.resume).toString("base64"), extractedText: s.resume });
    for (const m of s.mock) await db.insert(schema.mockProfiles).values({ kind: m.kind, handle: m.kind === "github" || s.i === 0 ? (s.links[m.kind] ?? "").split("/").pop()! : handle(s.i), displayName: `${s.first} ${s.last}`, facts: m.facts }).onConflictDoNothing();
  }
  for (const id of ids) await runEvidencePipeline(id);

  // Conversations: the first 26 students met someone; a handful met two recruiters.
  let made = 0;
  const base = Date.now() - 1000 * 60 * 60 * 5;
  for (let i = 0; i < 26; i++) {
    const meets = i % 8 === 0 ? [pick(recruiters, i), pick(recruiters, i + 1)] : [pick(recruiters, i)];
    for (const [k, r] of meets.entries()) {
      const at = new Date(base + (i * 9 + k * 4) * 60_000);
      const stage = i % 5; // 0-2: captured and summarised, 3: notes in progress, 4: nothing yet
      const [conn] = await db.insert(schema.connections).values({ candidateId: ids[i], recruiterId: r.id, eventId: event.id, method: i % 4 === 0 ? "nfc" : "qr", consentedAt: at, status: stage <= 2 ? pick(STATUSES, i + k) : "New", statusSetBy: stage <= 2 ? r.id : null, statusSetAt: stage <= 2 ? new Date(at.getTime() + 20 * 60_000) : null, updatedAt: at }).returning();
      made++;
      const note = pick(NOTES, i + k);
      const captureSecs = 45 + ((i * 13) % 70);
      await db.insert(schema.observations).values({
        connectionId: conn.id,
        notes: stage === 4 ? "" : note[1], areasOfInterest: stage === 4 ? null : note[0], candidateQuestions: stage <= 2 ? note[2] || null : null, followUpQuestions: stage <= 2 ? note[3] || null : null, recommendedNextSteps: stage <= 2 ? note[4] || null : null,
        tags: stage === 4 ? [] : [pick(["Software", "Data", "Supply Chain", "Operations"], i), pick(["Internship", "Full-time", "Co-op"], i + k), ...(i % 3 === 0 ? ["Relocation OK"] : []), ...(i % 4 === 1 ? ["Follow up on project"] : [])],
        ratingCommunication: stage <= 2 ? 3 + ((i + k) % 3) : null, ratingTechnical: stage <= 2 ? 2 + ((i * 2 + k) % 4) : null, ratingInterest: stage <= 2 ? 3 + ((i + 2 * k) % 3) : null,
        captureStartedAt: stage === 4 ? null : new Date(at.getTime() + 30_000), captureCompletedAt: stage <= 2 ? new Date(at.getTime() + 30_000 + captureSecs * 1000) : null, updatedAt: at,
      });
      if (stage !== 4) await db.insert(schema.metricsEvents).values({ kind: "capture_started", connectionId: conn.id, recruiterId: r.id, at: new Date(at.getTime() + 30_000) });
      if (stage > 2) continue;

      const [cand] = await db.select().from(schema.candidates).where(sql`${schema.candidates.id} = ${ids[i]}`);
      const { input, hash } = await summaryInput(conn.id, cand);
      const res = mockSummarize(input);
      const drafted = new Date(at.getTime() + 2 * 60_000);
      const approve = stage <= 1;
      const reviewSecs = 25 + ((i * 17) % 80);
      await db.insert(schema.summaries).values({ connectionId: conn.id, draft: res.draft, rejectedStatements: res.rejected, provider: "mock", sourcesHash: hash, editCount: approve ? i % 3 : 0, approvalStatus: approve ? "approved" : "draft", approvedByRecruiterId: approve ? r.id : null, approvedAt: approve ? new Date(drafted.getTime() + reviewSecs * 1000) : null, createdAt: drafted });
      const count = res.draft.snapshot.length + res.draft.keySkills.length + res.draft.relevantExperience.length;
      await db.insert(schema.metricsEvents).values([
        { kind: "capture_completed", connectionId: conn.id, recruiterId: r.id, payload: { seconds: captureSecs }, at: new Date(at.getTime() + 30_000 + captureSecs * 1000) },
        { kind: "summary_generated", connectionId: conn.id, recruiterId: r.id, payload: { provider: "mock", statements: count, removed: res.rejected.length }, at: drafted },
        ...(approve ? [{ kind: "summary_approved", connectionId: conn.id, recruiterId: r.id, payload: { editCount: i % 3, secondsSinceDraft: reviewSecs }, at: new Date(drafted.getTime() + reviewSecs * 1000) }] : []),
      ]);
    }
  }

  // A line in progress: students who have not met anyone yet are waiting for a recruiter.
  const lineStart = Date.now() - 12 * 60_000;
  const waitFor = [[recruiters[0], [26, 27, 28, 29, 30]], [recruiters[1], [31, 32, 33]], [recruiters[2], [34, 35]]] as const;
  for (const [r, who] of waitFor) for (const [k, i] of who.entries()) await db.insert(schema.queueEntries).values({ recruiterId: r.id, candidateId: ids[i], joinedAt: new Date(lineStart + (k * 2 + 1) * 60_000) });

  // Two finished study participants so the comparison table has something to show.
  const t = (m: number) => new Date(base - m * 60_000);
  await db.insert(schema.studySessions).values([
    { eventId: event.id, participantCode: "P01", condition: "paper", orderIndex: 1, candidateSet: "A", startedAt: t(200), endedAt: t(176), recordsCompleted: 8, confidence: 4, notes: "Re-read two notes sheets to find graduation dates." },
    { eventId: event.id, participantCode: "P01", condition: "talentiq", orderIndex: 2, candidateSet: "B", startedAt: t(170), endedAt: t(157), recordsCompleted: 8, confidence: 6 },
    { eventId: event.id, participantCode: "P02", condition: "talentiq", orderIndex: 1, candidateSet: "A", startedAt: t(150), endedAt: t(135), recordsCompleted: 8, confidence: 6 },
    { eventId: event.id, participantCode: "P02", condition: "paper", orderIndex: 2, candidateSet: "B", startedAt: t(130), endedAt: t(109), recordsCompleted: 8, confidence: 5, notes: "Could not read own handwriting for one candidate." },
  ]);

  console.log(`\nSeeded "${event.name}": ${staff.length} staff, ${seeds.length} students, ${made} conversations, ${TAGS.length} tags.`);
  console.log(`Demo student for the walkthrough: Maya Reyes (met ${pick(recruiters, 0).name}).\n`);
  console.log("Sign-in details (shown once, stored only as salted hashes):");
  for (const c of creds) console.log(`  ${c.role.padEnd(12)} ${c.email.padEnd(30)} ${c.password}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
