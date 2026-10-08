import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { chooseRecruiter } from "@/lib/ai";
import { db, schema } from "@/db";
import { QUEUE_ACTIVE } from "@/db/schema";

export const MAX_LINES_PER_STUDENT = 3;

/** Everyone currently waiting for, or called by, one recruiter, in the order they joined. */
export async function lineFor(recruiterId: string) {
  return db
    .select({ id: schema.queueEntries.id, status: schema.queueEntries.status, joinedAt: schema.queueEntries.joinedAt, calledAt: schema.queueEntries.calledAt, candidateId: schema.candidates.id, firstName: schema.candidates.firstName, preferredName: schema.candidates.preferredName, lastName: schema.candidates.lastName, major: schema.candidates.major })
    .from(schema.queueEntries)
    .innerJoin(schema.candidates, eq(schema.queueEntries.candidateId, schema.candidates.id))
    .where(and(eq(schema.queueEntries.recruiterId, recruiterId), inArray(schema.queueEntries.status, [...QUEUE_ACTIVE])))
    .orderBy(asc(schema.queueEntries.joinedAt));
}

export type Place = { entryId: string; recruiterId: string; recruiterName: string; title: string | null; company: string | null; status: "waiting" | "called"; position: number; ahead: number; waitMinutes: number; open: boolean };

/** A student's place in each line they are in: how many people are ahead and roughly how long that is. */
export async function placesFor(candidateId: string): Promise<Place[]> {
  const mine = await db
    .select({ entry: schema.queueEntries, name: schema.recruiters.name, title: schema.recruiters.title, minutesPer: schema.recruiters.minutesPer, open: schema.recruiters.queueOpen, company: schema.events.company })
    .from(schema.queueEntries)
    .innerJoin(schema.recruiters, eq(schema.queueEntries.recruiterId, schema.recruiters.id))
    .leftJoin(schema.events, eq(schema.recruiters.eventId, schema.events.id))
    .where(and(eq(schema.queueEntries.candidateId, candidateId), inArray(schema.queueEntries.status, [...QUEUE_ACTIVE])))
    .orderBy(asc(schema.queueEntries.joinedAt));
  const out: Place[] = [];
  for (const m of mine) {
    const line = await lineFor(m.entry.recruiterId);
    const waitingAhead = line.filter((e) => e.status === "waiting" && e.joinedAt < m.entry.joinedAt).length;
    const withRecruiter = line.some((e) => e.status === "called" && e.id !== m.entry.id) ? 1 : 0;
    const ahead = m.entry.status === "called" ? 0 : waitingAhead + withRecruiter;
    out.push({ entryId: m.entry.id, recruiterId: m.entry.recruiterId, recruiterName: m.name, title: m.title, company: m.company, status: m.entry.status as "waiting" | "called", position: m.entry.status === "called" ? 0 : waitingAhead + 1, ahead, waitMinutes: ahead * m.minutesPer, open: m.open });
  }
  return out;
}

/** Ends a student's place in a recruiter's line, for example once they have shared their profile at the booth. */
export async function closeEntry(candidateId: string, recruiterId: string, status: "served" | "left") {
  await db.update(schema.queueEntries).set({ status, doneAt: new Date() })
    .where(and(eq(schema.queueEntries.candidateId, candidateId), eq(schema.queueEntries.recruiterId, recruiterId), inArray(schema.queueEntries.status, [...QUEUE_ACTIVE])));
}

export type OpenLine = { id: string; name: string; title: string | null; focus: string; token: string; waiting: number; minutes: number; full: boolean };

/** Recruiters at the current event whose lines are open, with how long each line is. */
export async function openLines(): Promise<OpenLine[]> {
  const [event] = await db.select({ id: schema.events.id }).from(schema.events).orderBy(desc(schema.events.createdAt)).limit(1);
  if (!event) return [];
  const rs = await db.select().from(schema.recruiters).where(and(eq(schema.recruiters.eventId, event.id), eq(schema.recruiters.queueOpen, true), isNull(schema.recruiters.disabledAt), eq(schema.recruiters.role, "recruiter")));
  const out: OpenLine[] = [];
  for (const r of rs) {
    const line = await lineFor(r.id);
    const waiting = line.filter((e) => e.status === "waiting").length;
    const busy = line.some((e) => e.status === "called") ? 1 : 0;
    out.push({ id: r.id, name: r.name, title: r.title, focus: r.focus, token: r.connectToken, waiting, minutes: (waiting + busy) * r.minutesPer, full: waiting >= r.queueMax });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Lines this student could still join: open, not full, not already in, and not someone they have already met. */
export async function joinableLines(candidateId: string): Promise<OpenLine[]> {
  const [active, met, all] = await Promise.all([
    db.select({ id: schema.queueEntries.recruiterId }).from(schema.queueEntries).where(and(eq(schema.queueEntries.candidateId, candidateId), inArray(schema.queueEntries.status, [...QUEUE_ACTIVE]))),
    db.select({ id: schema.connections.recruiterId }).from(schema.connections).where(eq(schema.connections.candidateId, candidateId)),
    openLines(),
  ]);
  const taken = new Set([...active, ...met].map((x) => x.id));
  return all.filter((l) => !taken.has(l.id) && !l.full);
}

/**
 * Puts a student in the line that best matches what they said they want to talk about.
 * Returns null if they are already in a line or nothing is open.
 */
export async function autoPlace(candidate: typeof schema.candidates.$inferSelect): Promise<{ recruiterName: string; reason: string } | null> {
  const [inLine] = await db.select({ id: schema.queueEntries.id }).from(schema.queueEntries).where(and(eq(schema.queueEntries.candidateId, candidate.id), inArray(schema.queueEntries.status, [...QUEUE_ACTIVE]))).limit(1);
  if (inLine) return null;
  const options = await joinableLines(candidate.id);
  const choice = await chooseRecruiter({ desiredFunction: candidate.desiredFunction, major: candidate.major, technicalInterests: candidate.technicalInterests, skills: candidate.skills }, options);
  const pick = options.find((o) => o.id === choice?.id);
  if (!pick || !choice) return null;
  await db.insert(schema.queueEntries).values({ recruiterId: pick.id, candidateId: candidate.id, joinedAt: new Date() });
  return { recruiterName: pick.name, reason: choice.reason };
}

/** A short fingerprint of a recruiter's line. When it changes, their screen refreshes. */
export async function lineSignature(recruiterId: string): Promise<string> {
  return (await lineFor(recruiterId)).map((l) => `${l.id.slice(0, 8)}${l.status[0]}`).sort().join(",");
}
