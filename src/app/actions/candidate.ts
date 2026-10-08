"use server";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { QUEUE_ACTIVE } from "@/db/schema";
import { MAX_LINES_PER_STUDENT, autoPlace, closeEntry } from "@/lib/line";
import { db, dbReady, schema } from "@/db";
import { endAllSessions, getCandidate, safeNext, startSession } from "@/lib/auth";
import { hashSecret, recoveryCode } from "@/lib/crypto";
import { runEvidencePipeline } from "@/lib/evidence";
import { track } from "@/lib/metrics";
import { readProfileForm, readResume, type ProfileErrors } from "@/lib/profile";
import { limitByIp, rateLimit } from "@/lib/rateLimit";

export type ProfileState = { error?: string; ok?: string; errors?: ProfileErrors; values?: Record<string, string>; recoveryCode?: string; next?: string; placed?: { recruiterName: string; reason: string } | null } | null;

export async function createCandidate(_: ProfileState, form: FormData): Promise<ProfileState> {
  const { data, links, consent, errors, values } = readProfileForm(form);
  if (!(await limitByIp("signup", 12, 3600))) return { error: "Too many sign-ups from this network. Try again in an hour.", values };

  let resume = null;
  try { resume = await readResume(form.get("resume")); } catch (e) { errors.resume = e instanceof Error ? e.message : "We could not read that file."; }
  if (!data || Object.keys(errors).length) return { error: "Some details need fixing before we can save your profile.", errors, values };

  await dbReady;
  const [taken] = await db.select({ id: schema.candidates.id }).from(schema.candidates).where(eq(schema.candidates.email, data.email));
  if (taken) return { error: "Some details need fixing before we can save your profile.", errors: { email: "A profile already uses this email. Use “Find my profile” to open it." }, values };

  const code = recoveryCode();
  const [c] = await db.insert(schema.candidates).values({ ...data, links, scrapeConsentAt: consent && Object.keys(links).length ? new Date() : null, recoveryHash: await hashSecret(code), evidenceState: resume ? "running" : "idle" }).returning();
  if (resume) await db.insert(schema.resumes).values({ candidateId: c.id, fileName: resume.fileName, mime: resume.mime, size: resume.size, fileB64: resume.fileB64, extractedText: resume.text });

  await startSession("candidate", c.id);
  await track("signup_completed", { payload: { hasResume: !!resume, links: Object.keys(links).length } });
  if (resume) after(() => runEvidencePipeline(c.id));
  // Arrived by scanning a badge: they already chose a recruiter. Otherwise, match them to a line by what they want to talk about.
  const next = safeNext(form.get("next"), "/line");
  const placed = next.startsWith("/c/") ? null : await autoPlace(c).catch((e) => { console.error("auto place", e); return null; });
  return { recoveryCode: code, next, placed };
}

export async function updateProfile(_: ProfileState, form: FormData): Promise<ProfileState> {
  const me = await getCandidate();
  if (!me) redirect("/signup");
  if (!(await rateLimit(`profile:${me.id}`, 30, 3600))) return { error: "Too many changes in a short time. Try again later." };
  const { data, links, consent, errors, values } = readProfileForm(form);

  let resume = null;
  try { resume = await readResume(form.get("resume")); } catch (e) { errors.resume = e instanceof Error ? e.message : "We could not read that file."; }
  if (!data || Object.keys(errors).length) return { error: "Some details need fixing before we can save.", errors, values };

  const [taken] = await db.select({ id: schema.candidates.id }).from(schema.candidates).where(and(eq(schema.candidates.email, data.email), ne(schema.candidates.id, me.id)));
  if (taken) return { error: "Some details need fixing before we can save.", errors: { email: "Another profile already uses this email." }, values };

  const hasLinks = Object.keys(links).length > 0;
  const linksChanged = JSON.stringify(links) !== JSON.stringify(me.links ?? {}) || (consent && hasLinks) !== !!me.scrapeConsentAt;
  await db.update(schema.candidates).set({ ...data, links, scrapeConsentAt: consent && hasLinks ? (me.scrapeConsentAt ?? new Date()) : null, updatedAt: new Date() }).where(eq(schema.candidates.id, me.id));
  if (resume) {
    await db.delete(schema.resumes).where(eq(schema.resumes.candidateId, me.id));
    await db.insert(schema.resumes).values({ candidateId: me.id, fileName: resume.fileName, mime: resume.mime, size: resume.size, fileB64: resume.fileB64, extractedText: resume.text });
  }
  if (resume || linksChanged) {
    await db.update(schema.candidates).set({ evidenceState: "running" }).where(eq(schema.candidates.id, me.id));
    after(() => runEvidencePipeline(me.id));
  }
  redirect("/me?saved=1");
}

/** Removes the profile and everything attached to it: resume, connections, notes, summaries, claims and evidence. */
export async function deleteMyData(form: FormData) {
  const me = await getCandidate();
  if (!me) redirect("/");
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") redirect("/me?delete=confirm");
  await db.delete(schema.candidates).where(eq(schema.candidates.id, me.id));
  await endAllSessions(me.id);
  redirect("/?deleted=1");
}

export type ConnectState = { error?: string; ok?: boolean } | null;

/** The student shares their profile with one recruiter. Nothing is shared until they press the button. */
export async function connect(_: ConnectState, form: FormData): Promise<ConnectState> {
  const me = await getCandidate();
  const token = String(form.get("token") ?? "");
  if (!me) redirect(`/signup?next=${encodeURIComponent(`/c/${token}`)}`);
  if (!(await rateLimit(`connect:${me.id}`, 30, 3600))) return { error: "Too many connections in a short time. Try again later." };

  const [r] = await db.select().from(schema.recruiters).where(eq(schema.recruiters.connectToken, token));
  if (!r || r.disabledAt) return { error: "This badge link is no longer valid. Ask the recruiter to show their badge again." };

  const m = form.get("method");
  const method = m === "nfc" || m === "tap" ? m : "qr";
  const [conn] = await db
    .insert(schema.connections)
    .values({ candidateId: me.id, recruiterId: r.id, eventId: r.eventId, method })
    .onConflictDoNothing()
    .returning({ id: schema.connections.id });
  if (conn) {
    await db.insert(schema.observations).values({ connectionId: conn.id }).onConflictDoNothing();
    await track("connection_created", { connectionId: conn.id, recruiterId: r.id, payload: { method } });
  }
  // Sharing at the booth is the end of the wait: take them out of this recruiter's line.
  await closeEntry(me.id, r.id, "served");
  return { ok: true };
}

export type LineState = { error?: string; ok?: boolean } | null;

/** Scanning a recruiter's QR code and pressing Join puts the student in that recruiter's virtual line. */
export async function joinLine(_: LineState, form: FormData): Promise<LineState> {
  const me = await getCandidate();
  const token = String(form.get("token") ?? "");
  if (!me) redirect(`/signup?next=${encodeURIComponent(`/c/${token}`)}`);
  if (!(await rateLimit(`line:${me.id}`, 30, 3600))) return { error: "Too many changes in a short time. Try again later." };
  const [r] = await db.select().from(schema.recruiters).where(eq(schema.recruiters.connectToken, token));
  if (!r || r.disabledAt) return { error: "This badge link is no longer valid. Ask the recruiter to show their badge again." };
  if (!r.queueOpen) return { error: `${r.name} is not taking new people in line right now.` };

  const active = await db.select({ recruiterId: schema.queueEntries.recruiterId }).from(schema.queueEntries).where(and(eq(schema.queueEntries.candidateId, me.id), inArray(schema.queueEntries.status, [...QUEUE_ACTIVE])));
  if (active.some((a) => a.recruiterId === r.id)) return { ok: true };
  if (active.length >= MAX_LINES_PER_STUDENT) return { error: `You can wait in ${MAX_LINES_PER_STUDENT} lines at once. Leave one first.` };
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.queueEntries).where(and(eq(schema.queueEntries.recruiterId, r.id), eq(schema.queueEntries.status, "waiting")));
  if (n >= r.queueMax) return { error: `${r.name}'s line is full right now. Try again in a few minutes.` };
  await db.insert(schema.queueEntries).values({ recruiterId: r.id, candidateId: me.id, joinedAt: new Date() });
  return { ok: true };
}

/** Runs the interest match again for a student who is not in any line. */
export async function findMyRecruiter() {
  const me = await getCandidate();
  if (!me) redirect("/signup?next=/line");
  let note = "none";
  if (await rateLimit(`place:${me.id}`, 12, 3600)) {
    const placed = await autoPlace(me).catch(() => null);
    if (placed) note = encodeURIComponent(placed.reason);
  }
  redirect(`/line?placed=${note}`);
}

/** Joins a recruiter's line chosen from the list on the Line screen. */
export async function joinLineOf(form: FormData) {
  const id = String(form.get("recruiterId") ?? "");
  if (/^[0-9a-f-]{36}$/i.test(id)) {
    const [r] = await db.select({ token: schema.recruiters.connectToken }).from(schema.recruiters).where(eq(schema.recruiters.id, id));
    if (r) {
      const fd = new FormData();
      fd.set("token", r.token);
      const res = await joinLine(null, fd);
      if (res?.error) redirect(`/line?error=${encodeURIComponent(res.error)}`);
    }
  }
  redirect("/line");
}

export async function leaveLine(form: FormData) {
  const me = await getCandidate();
  const id = String(form.get("id") ?? "");
  if (me && /^[0-9a-f-]{36}$/i.test(id)) {
    await db.update(schema.queueEntries).set({ status: "left", doneAt: new Date() }).where(and(eq(schema.queueEntries.id, id), eq(schema.queueEntries.candidateId, me.id), inArray(schema.queueEntries.status, [...QUEUE_ACTIVE])));
  }
  refresh();
}
