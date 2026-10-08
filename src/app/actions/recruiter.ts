"use server";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { RECORD_STATUSES, SOURCE_LABELS, type SummaryDraft } from "@/db/schema";
import { interviewQuestions, searchQuery, summarize } from "@/lib/ai";
import { requireRecruiter } from "@/lib/auth";
import { runEvidencePipeline } from "@/lib/evidence";
import { track } from "@/lib/metrics";
import { rateLimit } from "@/lib/rateLimit";
import { eventTags, loadConnection, summaryInput } from "@/lib/records";

const text = (max: number) => z.string().max(max).transform((s) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ""));
const rating = z.number().int().min(1).max(5).nullable();
const ObservationPatch = z.object({
  notes: text(4000), areasOfInterest: text(600), candidateQuestions: text(600), followUpQuestions: text(600), recommendedNextSteps: text(600),
  tags: z.array(z.string().max(60)).max(30),
  ratingCommunication: rating, ratingTechnical: rating, ratingInterest: rating,
}).partial();
export type ObservationPatch = z.input<typeof ObservationPatch>;

/** Autosave from the capture screen. Only the recruiter who had the conversation can write its notes and ratings. */
export async function saveObservation(connectionId: string, patch: ObservationPatch): Promise<{ ok: boolean; error?: string }> {
  const me = await requireRecruiter();
  const { conn, isOwner } = await loadConnection(me, connectionId);
  if (!isOwner) return { ok: false, error: "Only the recruiter who had this conversation can edit its notes." };
  const parsed = ObservationPatch.safeParse(patch);
  if (!parsed.success) return { ok: false, error: "That text is too long to save." };
  const data = parsed.data;
  if (data.tags) {
    const allowed = new Set(await eventTags(conn.eventId));
    data.tags = data.tags.filter((t) => allowed.has(t));
  }
  const [existing] = await db.select({ started: schema.observations.captureStartedAt }).from(schema.observations).where(eq(schema.observations.connectionId, connectionId));
  const now = new Date();
  const startNow = !existing?.started;
  await db.insert(schema.observations).values({ connectionId, ...data, captureStartedAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: schema.observations.connectionId, set: { ...data, updatedAt: now, ...(startNow ? { captureStartedAt: now } : {}) } });
  if (startNow) await track("capture_started", { connectionId, recruiterId: me.id });
  return { ok: true };
}

async function writeSummary(connectionId: string, candidate: typeof schema.candidates.$inferSelect, recruiterId: string) {
  const { input, hash } = await summaryInput(connectionId, candidate);
  const result = await summarize(input);
  const values = { draft: result.draft, edited: null, rejectedStatements: result.rejected, provider: result.provider, sourcesHash: hash, editCount: 0, approvalStatus: "draft" as const, approvedByRecruiterId: null, approvedAt: null, createdAt: new Date() };
  await db.insert(schema.summaries).values({ connectionId, ...values }).onConflictDoUpdate({ target: schema.summaries.connectionId, set: values });
  const count = result.draft.snapshot.length + result.draft.keySkills.length + result.draft.relevantExperience.length;
  await track("summary_generated", { connectionId, recruiterId, payload: { provider: result.provider, statements: count, removed: result.rejected.length, missing: result.draft.missingInfo.length } });
}

/** Marks capture finished, records the time, and drafts the summary for review. */
export async function completeCapture(connectionId: string) {
  const me = await requireRecruiter();
  const { conn, candidate, isOwner } = await loadConnection(me, connectionId);
  if (!isOwner) redirect(`/recruiter/c/${connectionId}`);
  const now = new Date();
  const [obs] = await db.select().from(schema.observations).where(eq(schema.observations.connectionId, connectionId));
  const first = !obs?.captureCompletedAt;
  await db.insert(schema.observations).values({ connectionId, captureStartedAt: conn.consentedAt, captureCompletedAt: now })
    .onConflictDoUpdate({ target: schema.observations.connectionId, set: { captureCompletedAt: now, ...(obs?.captureStartedAt ? {} : { captureStartedAt: conn.consentedAt }) } });
  if (first) await track("capture_completed", { connectionId, recruiterId: me.id, payload: { seconds: Math.round((now.getTime() - (obs?.captureStartedAt ?? conn.consentedAt).getTime()) / 1000) } });
  if (await rateLimit(`summ:${me.id}`, 120, 3600)) await writeSummary(connectionId, candidate, me.id);
  redirect(`/recruiter/c/${connectionId}?tab=summary`);
}

export async function generateSummary(connectionId: string) {
  const me = await requireRecruiter();
  const { candidate, canEdit } = await loadConnection(me, connectionId);
  if (canEdit && (await rateLimit(`summ:${me.id}`, 120, 3600))) await writeSummary(connectionId, candidate, me.id);
  redirect(`/recruiter/c/${connectionId}?tab=summary`);
}

const Statement = z.object({ text: text(400).pipe(z.string().trim().min(1)), sources: z.array(z.enum(SOURCE_LABELS)).min(1).max(4), url: z.string().max(400).optional(), edited: z.boolean().optional() });
const Draft = z.object({ snapshot: z.array(Statement).max(12), keySkills: z.array(Statement).max(16), relevantExperience: z.array(Statement).max(12), missingInfo: z.array(z.string().max(80)).max(20) });

/** Saves the recruiter's edits. Edited sentences are the recruiter's own words and are marked as such. */
export async function saveSummary(connectionId: string, draft: SummaryDraft, intent: "save" | "approve" | "reject"): Promise<{ ok: boolean; error?: string }> {
  const me = await requireRecruiter();
  const { canEdit } = await loadConnection(me, connectionId);
  if (!canEdit) return { ok: false, error: "Only the recruiter who had this conversation, or a coordinator, can change this summary." };
  const parsed = Draft.safeParse(draft);
  if (!parsed.success) return { ok: false, error: "A sentence is empty or too long. Fix it and try again." };
  const [s] = await db.select().from(schema.summaries).where(eq(schema.summaries.connectionId, connectionId));
  if (!s) return { ok: false, error: "There is no draft yet. Generate one first." };

  const before = s.edited ?? s.draft;
  const flat = (d: SummaryDraft) => [...d.snapshot, ...d.keySkills, ...d.relevantExperience].map((x) => x.text);
  const was = new Set(flat(before)), now = new Set(flat(parsed.data));
  const changed = [...now].filter((t) => !was.has(t)).length, removed = [...was].filter((t) => !now.has(t)).length;
  const edits = changed + Math.max(0, removed - changed);

  await db.update(schema.summaries).set({
    edited: parsed.data, editCount: s.editCount + edits,
    ...(intent === "approve" ? { approvalStatus: "approved" as const, approvedByRecruiterId: me.id, approvedAt: new Date() } : {}),
    ...(intent === "reject" ? { approvalStatus: "rejected" as const, approvedByRecruiterId: me.id, approvedAt: new Date() } : {}),
    ...(intent === "save" && edits > 0 && s.approvalStatus !== "draft" ? { approvalStatus: "draft" as const, approvedByRecruiterId: null, approvedAt: null } : {}),
  }).where(eq(schema.summaries.id, s.id));

  if (edits > 0) await track("summary_edited", { connectionId, recruiterId: me.id, payload: { changed, removed } });
  if (intent === "approve") await track("summary_approved", { connectionId, recruiterId: me.id, payload: { editCount: s.editCount + edits, secondsSinceDraft: Math.round((Date.now() - s.createdAt.getTime()) / 1000) } });
  if (intent === "reject") await track("summary_rejected", { connectionId, recruiterId: me.id });
  if (intent !== "save") {
    // A reviewed summary moves a brand-new record on by one step; anything further is the recruiter's call.
    await db.update(schema.connections).set({ status: "Reviewed", statusSetBy: me.id, statusSetAt: new Date(), updatedAt: new Date() }).where(and(eq(schema.connections.id, connectionId), eq(schema.connections.status, "New")));
  }
  refresh();
  return { ok: true };
}

const Status = z.enum(RECORD_STATUSES);

export async function setStatus(form: FormData) {
  const me = await requireRecruiter();
  const connectionId = String(form.get("connectionId") ?? "");
  const status = Status.safeParse(form.get("status"));
  const { conn, canEdit } = await loadConnection(me, connectionId);
  if (status.success && canEdit && status.data !== conn.status) {
    await db.update(schema.connections).set({ status: status.data, statusSetBy: me.id, statusSetAt: new Date(), updatedAt: new Date(), ...(status.data === "Interview Requested" ? {} : { interviewAt: null }) }).where(eq(schema.connections.id, connectionId));
    await track("status_changed", { connectionId, recruiterId: me.id, payload: { from: conn.status, to: status.data } });
  }
  refresh();
}

export async function bulkStatus(ids: string[], status: string): Promise<{ ok: boolean; changed: number; error?: string }> {
  const me = await requireRecruiter();
  const parsed = Status.safeParse(status);
  const clean = z.array(z.uuid()).max(200).safeParse(ids);
  if (!parsed.success || !clean.success || !clean.data.length) return { ok: false, changed: 0, error: "Choose at least one person and a status." };
  if (!me.eventId) return { ok: false, changed: 0, error: "Your account is not attached to an event." };
  // Scope the update to this event, and to the recruiter's own conversations unless they coordinate the event.
  const scope = [inArray(schema.connections.id, clean.data), eq(schema.connections.eventId, me.eventId)];
  if (me.role !== "coordinator") scope.push(eq(schema.connections.recruiterId, me.id));
  const rows = await db.update(schema.connections).set({ status: parsed.data, statusSetBy: me.id, statusSetAt: new Date(), updatedAt: new Date() }).where(and(...scope)).returning({ id: schema.connections.id });
  for (const r of rows) await track("status_changed", { connectionId: r.id, recruiterId: me.id, payload: { to: parsed.data, bulk: true } });
  refresh();
  return { ok: true, changed: rows.length, ...(rows.length < clean.data.length ? { error: `${clean.data.length - rows.length} not changed: you can only set a status for people you met.` } : {}) };
}

/** Hide or restore one evidence row. A hidden row is left out of the summary. */
export async function toggleClaim(form: FormData) {
  const me = await requireRecruiter();
  const connectionId = String(form.get("connectionId") ?? "");
  const claimId = String(form.get("claimId") ?? "");
  const { candidate, canEdit } = await loadConnection(me, connectionId);
  if (canEdit && /^[0-9a-f-]{36}$/i.test(claimId)) {
    const [c] = await db.select().from(schema.claims).where(and(eq(schema.claims.id, claimId), eq(schema.claims.candidateId, candidate.id)));
    if (c) await db.update(schema.claims).set({ hiddenByRecruiterId: c.hiddenByRecruiterId ? null : me.id }).where(eq(schema.claims.id, c.id));
  }
  refresh();
}

export async function recheckEvidence(form: FormData) {
  const me = await requireRecruiter();
  const connectionId = String(form.get("connectionId") ?? "");
  const { candidate, canEdit } = await loadConnection(me, connectionId);
  if (canEdit && candidate.evidenceState !== "running" && (await rateLimit(`recheck:${me.id}`, 20, 3600))) {
    await db.update(schema.candidates).set({ evidenceState: "running" }).where(eq(schema.candidates.id, candidate.id));
    after(() => runEvidencePipeline(candidate.id));
  }
  refresh();
}

export async function suggestQuestions(connectionId: string): Promise<string[]> {
  const me = await requireRecruiter();
  const { candidate } = await loadConnection(me, connectionId);
  if (!(await rateLimit(`questions:${me.id}`, 60, 3600))) return [];
  const { input } = await summaryInput(connectionId, candidate);
  const fromClaims = (await db.select({ q: schema.claims.suggestedQuestion }).from(schema.claims).where(and(eq(schema.claims.candidateId, candidate.id), inArray(schema.claims.status, ["discrepancy", "partial"])))).map((r) => r.q).filter((q): q is string => !!q).slice(0, 2);
  const context = [input.resumeText, input.candidate.desiredFunction, (input.candidate.skills ?? []).join(", "), (input.candidate.projects ?? []).join("\n")].filter(Boolean).join("\n");
  return interviewQuestions(context, fromClaims);
}

/** Natural-language search. The model only turns the question into filters; the database does the finding. */
export async function askSearch(form: FormData) {
  const me = await requireRecruiter();
  const q = String(form.get("ask") ?? "").trim().slice(0, 240);
  if (!q) redirect("/dashboard");
  if (!(await rateLimit(`ask:${me.id}`, 40, 3600))) redirect("/dashboard?notice=slow");
  const tags = await eventTags(me.eventId);
  const people = me.eventId
    ? await db.selectDistinct({ major: schema.candidates.major, university: schema.candidates.university }).from(schema.connections).innerJoin(schema.candidates, eq(schema.connections.candidateId, schema.candidates.id)).where(eq(schema.connections.eventId, me.eventId))
    : [];
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))];
  const f = await searchQuery(q, { majors: uniq(people.map((p) => p.major)), universities: uniq(people.map((p) => p.university)), tags });
  await track("search_run", { recruiterId: me.id, payload: { natural: true, refused: f.refused } });
  if (f.refused) redirect(`/dashboard?notice=norank&asked=${encodeURIComponent(q)}`);
  const p = new URLSearchParams({ asked: q });
  const terms = [...f.keywords, ...f.skills, ...f.locations];
  if (terms.length) p.set("q", terms.join(" "));
  if (f.majors[0]) p.set("major", f.majors[0]);
  if (f.universities[0]) p.set("university", f.universities[0]);
  if (f.tags[0] && tags.includes(f.tags[0])) p.set("tag", f.tags[0]);
  if (f.graduationYear) p.set("grad", f.graduationYear);
  if ((RECORD_STATUSES as readonly string[]).includes(f.status)) p.set("status", f.status);
  redirect(`/dashboard?${p}`);
}

/**
 * Calls the person at the front of this recruiter's line. If someone is already called and has not been dealt with
 * (tapped, started without a tap, or marked as a no-show), nothing happens: nobody is dropped by calling the next person.
 */
export async function callNext() {
  const me = await requireRecruiter();
  const [current] = await db.select({ id: schema.queueEntries.id }).from(schema.queueEntries).where(and(eq(schema.queueEntries.recruiterId, me.id), eq(schema.queueEntries.status, "called"))).limit(1);
  if (!current) {
    const [next] = await db.select({ id: schema.queueEntries.id }).from(schema.queueEntries).where(and(eq(schema.queueEntries.recruiterId, me.id), eq(schema.queueEntries.status, "waiting"))).orderBy(schema.queueEntries.joinedAt).limit(1);
    if (next) await db.update(schema.queueEntries).set({ status: "called", calledAt: new Date() }).where(eq(schema.queueEntries.id, next.id));
  }
  refresh();
}

/**
 * The called student is at the booth but the phones were not tapped. Their place in line already gave this recruiter
 * permission to open their profile when called, so the record is created here and the recruiter goes straight to notes.
 */
export async function startWithoutTap(form: FormData) {
  const me = await requireRecruiter();
  const id = String(form.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/recruiter");
  const [entry] = await db.select().from(schema.queueEntries).where(and(eq(schema.queueEntries.id, id), eq(schema.queueEntries.recruiterId, me.id), eq(schema.queueEntries.status, "called")));
  if (!entry) redirect("/recruiter");
  const [made] = await db.insert(schema.connections).values({ candidateId: entry.candidateId, recruiterId: me.id, eventId: me.eventId, method: "line" }).onConflictDoNothing().returning({ id: schema.connections.id });
  const connectionId = made?.id ?? (await db.select({ id: schema.connections.id }).from(schema.connections).where(and(eq(schema.connections.candidateId, entry.candidateId), eq(schema.connections.recruiterId, me.id))))[0].id;
  if (made) {
    await db.insert(schema.observations).values({ connectionId }).onConflictDoNothing();
    await track("connection_created", { connectionId, recruiterId: me.id, payload: { method: "line" } });
  }
  await db.update(schema.queueEntries).set({ status: "served", doneAt: new Date() }).where(eq(schema.queueEntries.id, entry.id));
  redirect(`/recruiter/c/${connectionId}`);
}

/** Marks a called person as a no-show. They stay on the Missed list and can be put back at the front of the line. */
export async function resolveEntry(form: FormData) {
  const me = await requireRecruiter();
  const id = String(form.get("id") ?? "");
  const to = form.get("to") === "waiting" ? "waiting" : "skipped";
  if (/^[0-9a-f-]{36}$/i.test(id)) {
    await db.update(schema.queueEntries).set(to === "waiting" ? { status: "waiting", calledAt: null, doneAt: null } : { status: "skipped", doneAt: new Date() })
      .where(and(eq(schema.queueEntries.id, id), eq(schema.queueEntries.recruiterId, me.id), inArray(schema.queueEntries.status, to === "waiting" ? ["skipped"] : ["called", "waiting"])));
  }
  refresh();
}

export async function saveLineSettings(form: FormData) {
  const me = await requireRecruiter();
  const parsed = z.object({ minutesPer: z.coerce.number().int().min(1).max(30), queueMax: z.coerce.number().int().min(1).max(200) }).safeParse({ minutesPer: form.get("minutesPer"), queueMax: form.get("queueMax") });
  await db.update(schema.recruiters).set({ queueOpen: form.get("queueOpen") === "on", focus: String(form.get("focus") ?? "").trim().slice(0, 160), bookingUrl: /^https:\/\/[^\s]{4,300}$/.test(String(form.get("bookingUrl") ?? "").trim()) ? String(form.get("bookingUrl")).trim() : null, ...(parsed.success ? parsed.data : {}) }).where(eq(schema.recruiters.id, me.id));
  refresh();
}
