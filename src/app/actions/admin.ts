"use server";
import { refresh } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { endAllSessions, requireCoordinator } from "@/lib/auth";
import { hashSecret, randomToken, tempPassword } from "@/lib/crypto";

export type AdminState = { error?: string; ok?: string; secret?: { label: string; value: string } } | null;
const uuid = z.uuid();
const name = z.string().trim().min(1).max(120);

export async function createEvent(_: AdminState, form: FormData): Promise<AdminState> {
  const me = await requireCoordinator();
  const parsed = z.object({ name, company: z.string().trim().min(1).max(80) }).safeParse({ name: form.get("name"), company: form.get("company") || "J.B. Hunt" });
  if (!parsed.success) return { error: "Give the event a name." };
  const [e] = await db.insert(schema.events).values(parsed.data).returning();
  // A new event starts with the previous event's tag list so the booth is ready to go.
  if (me.eventId) {
    const old = await db.select().from(schema.tags).where(eq(schema.tags.eventId, me.eventId));
    if (old.length) await db.insert(schema.tags).values(old.map((t) => ({ eventId: e.id, label: t.label, position: t.position })));
  }
  refresh();
  return { ok: `Created “${e.name}”. Move recruiters to it below when you are ready.` };
}

export async function createRecruiter(_: AdminState, form: FormData): Promise<AdminState> {
  const me = await requireCoordinator();
  const parsed = z.object({ name, title: z.string().trim().max(120), email: z.string().trim().toLowerCase().pipe(z.email()), role: z.enum(["recruiter", "coordinator"]) })
    .safeParse({ name: form.get("name"), title: form.get("title") ?? "", email: form.get("email"), role: form.get("role") });
  if (!parsed.success) return { error: "Enter a name, a valid email address and a role." };
  const [taken] = await db.select({ id: schema.recruiters.id }).from(schema.recruiters).where(eq(schema.recruiters.email, parsed.data.email));
  if (taken) return { error: "An account already uses that email address." };
  const password = tempPassword();
  await db.insert(schema.recruiters).values({ ...parsed.data, title: parsed.data.title || null, eventId: me.eventId, passwordHash: await hashSecret(password), connectToken: randomToken(12) });
  refresh();
  return { ok: `Account created for ${parsed.data.name}.`, secret: { label: `Temporary password for ${parsed.data.email}`, value: password } };
}

/** One form per recruiter row; the button pressed says what to do. */
export async function manageRecruiter(_: AdminState, form: FormData): Promise<AdminState> {
  const me = await requireCoordinator();
  const id = uuid.safeParse(form.get("id"));
  if (!id.success) return { error: "Unknown account." };
  const [r] = await db.select().from(schema.recruiters).where(eq(schema.recruiters.id, id.data));
  if (!r) return { error: "Unknown account." };
  // Coordinators manage their own event's people (and anyone not yet assigned to an event).
  if (r.eventId && r.eventId !== me.eventId) return { error: "That account belongs to a different event." };
  const intent = String(form.get("intent"));

  if (intent === "password") {
    const password = tempPassword();
    await db.update(schema.recruiters).set({ passwordHash: await hashSecret(password) }).where(eq(schema.recruiters.id, r.id));
    if (r.id !== me.id) await endAllSessions(r.id);
    refresh();
    return { ok: `Password reset for ${r.name}. Their other sessions were signed out.`, secret: { label: `Temporary password for ${r.email}`, value: password } };
  }
  if (intent === "badge") {
    await db.update(schema.recruiters).set({ connectToken: randomToken(12) }).where(eq(schema.recruiters.id, r.id));
    refresh();
    return { ok: `${r.name} has a new badge link. The old QR code and NFC tag no longer work.` };
  }
  if (intent === "toggle") {
    if (r.id === me.id) return { error: "You cannot disable your own account." };
    await db.update(schema.recruiters).set({ disabledAt: r.disabledAt ? null : new Date() }).where(eq(schema.recruiters.id, r.id));
    if (!r.disabledAt) await endAllSessions(r.id);
    refresh();
    return { ok: r.disabledAt ? `${r.name} can sign in again.` : `${r.name} is disabled and has been signed out.` };
  }
  if (intent === "role") {
    if (r.id === me.id) return { error: "You cannot change your own role." };
    await db.update(schema.recruiters).set({ role: r.role === "coordinator" ? "recruiter" : "coordinator" }).where(eq(schema.recruiters.id, r.id));
    refresh();
    return { ok: `${r.name} is now a ${r.role === "coordinator" ? "recruiter" : "coordinator"}.` };
  }
  if (intent === "move") {
    const eventId = uuid.safeParse(form.get("eventId"));
    if (!eventId.success) return { error: "Choose an event." };
    await db.update(schema.recruiters).set({ eventId: eventId.data }).where(eq(schema.recruiters.id, r.id));
    refresh();
    return { ok: `${r.name} moved to the selected event.` };
  }
  return { error: "Unknown action." };
}

export async function addTag(_: AdminState, form: FormData): Promise<AdminState> {
  const me = await requireCoordinator();
  const label = z.string().trim().min(1).max(40).safeParse(form.get("label"));
  if (!label.success || !me.eventId) return { error: "Enter a tag of up to 40 characters." };
  // Tags describe topics and logistics. Anything that reads as a verdict or a personal trait is refused.
  if (/\b(hire\w*|reject\w*|best|top|weak|strong|fit|personality|attitude|age|gender|race|religio\w*|disab\w*|nationality|accent)\b/i.test(label.data)) return { error: "Tags are for topics and logistics, such as “Data” or “Relocation OK”. They cannot be a verdict or a personal trait." };
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.tags).where(eq(schema.tags.eventId, me.eventId));
  if (n >= 30) return { error: "This event already has 30 tags. Remove one first." };
  const added = await db.insert(schema.tags).values({ eventId: me.eventId, label: label.data, position: n }).onConflictDoNothing().returning();
  refresh();
  return added.length ? { ok: `Added “${label.data}”.` } : { error: "That tag already exists." };
}

export async function removeTag(form: FormData) {
  const me = await requireCoordinator();
  const id = uuid.safeParse(form.get("id"));
  if (id.success && me.eventId) await db.delete(schema.tags).where(and(eq(schema.tags.id, id.data), eq(schema.tags.eventId, me.eventId)));
  refresh();
}

export async function addParticipant(_: AdminState, form: FormData): Promise<AdminState> {
  const me = await requireCoordinator();
  const parsed = z.object({ code: z.string().trim().min(1).max(20).regex(/^[\w-]+$/, "x"), first: z.enum(["paper", "talentiq"]) }).safeParse({ code: form.get("code"), first: form.get("first") });
  if (!parsed.success) return { error: "Use a short participant code such as P01. Do not use a name." };
  const [dup] = await db.select({ id: schema.studySessions.id }).from(schema.studySessions).where(and(eq(schema.studySessions.participantCode, parsed.data.code), eq(schema.studySessions.eventId, me.eventId!)));
  if (dup) return { error: "That participant code is already in use." };
  const second = parsed.data.first === "paper" ? "talentiq" : "paper";
  // Each condition gets a different, matched candidate set so nobody reviews the same people twice.
  await db.insert(schema.studySessions).values([
    { eventId: me.eventId, participantCode: parsed.data.code, condition: parsed.data.first, orderIndex: 1, candidateSet: "A" },
    { eventId: me.eventId, participantCode: parsed.data.code, condition: second, orderIndex: 2, candidateSet: "B" },
  ]);
  refresh();
  return { ok: `Added ${parsed.data.code}: ${parsed.data.first} first, then ${second}.` };
}

export async function updateStudySession(form: FormData) {
  const me = await requireCoordinator();
  const id = uuid.safeParse(form.get("id"));
  if (!id.success) return;
  const [s] = await db.select().from(schema.studySessions).where(and(eq(schema.studySessions.id, id.data), eq(schema.studySessions.eventId, me.eventId!)));
  if (!s) return;
  const intent = String(form.get("intent"));
  const int = (k: string, min: number, max: number) => { const n = Number(form.get(k)); return form.get(k) !== "" && Number.isInteger(n) && n >= min && n <= max ? n : null; };
  const set: Partial<typeof schema.studySessions.$inferInsert> = {};
  if (intent === "start") { set.startedAt = new Date(); set.endedAt = null; }
  else if (intent === "stop" && s.startedAt && !s.endedAt) set.endedAt = new Date();
  else if (intent === "reset") { set.startedAt = null; set.endedAt = null; }
  else if (intent === "delete") { await db.delete(schema.studySessions).where(and(eq(schema.studySessions.participantCode, s.participantCode), eq(schema.studySessions.eventId, me.eventId!))); return refresh(); }
  if (intent === "save" || intent === "stop") {
    set.recordsCompleted = int("recordsCompleted", 0, 500);
    set.confidence = int("confidence", 1, 7);
    set.notes = String(form.get("notes") ?? "").slice(0, 1000) || null;
  }
  if (Object.keys(set).length) await db.update(schema.studySessions).set(set).where(eq(schema.studySessions.id, s.id));
  refresh();
}
