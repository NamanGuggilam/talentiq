import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import type { Recruiter } from "@/lib/auth";
import type { SummaryInput } from "@/lib/ai";
import { sha256 } from "@/lib/crypto";

/**
 * Loads one connection for a signed-in recruiter, or 404s.
 * Staff see only candidates who connected with someone at their own event; only the recruiter who had the
 * conversation (or a coordinator) may change its notes, ratings, summary and status.
 */
export async function loadConnection(me: Recruiter, connectionId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(connectionId)) notFound();
  const [row] = await db
    .select({ conn: schema.connections, candidate: schema.candidates, owner: { id: schema.recruiters.id, name: schema.recruiters.name, title: schema.recruiters.title } })
    .from(schema.connections)
    .innerJoin(schema.candidates, eq(schema.connections.candidateId, schema.candidates.id))
    .innerJoin(schema.recruiters, eq(schema.connections.recruiterId, schema.recruiters.id))
    .where(eq(schema.connections.id, connectionId));
  if (!row) notFound();
  const sameEvent = !!me.eventId && row.conn.eventId === me.eventId;
  if (!sameEvent && row.conn.recruiterId !== me.id) notFound();
  return { ...row, isOwner: row.conn.recruiterId === me.id, canEdit: row.conn.recruiterId === me.id || me.role === "coordinator" };
}

export async function latestResume(candidateId: string) {
  const [r] = await db
    .select({ id: schema.resumes.id, fileName: schema.resumes.fileName, extractedText: schema.resumes.extractedText, uploadedAt: schema.resumes.uploadedAt })
    .from(schema.resumes).where(eq(schema.resumes.candidateId, candidateId)).orderBy(desc(schema.resumes.uploadedAt)).limit(1);
  return r ?? null;
}

export async function claimsFor(candidateId: string) {
  const [claims, sources] = await Promise.all([
    db.select().from(schema.claims).where(eq(schema.claims.candidateId, candidateId)).orderBy(asc(schema.claims.position)),
    db.select().from(schema.evidenceSources).where(eq(schema.evidenceSources.candidateId, candidateId)),
  ]);
  return { claims, sources };
}

/** Everything the summary may draw on, and a fingerprint of it so later changes can be detected. Ratings are not included. */
export async function summaryInput(connectionId: string, candidate: typeof schema.candidates.$inferSelect): Promise<{ input: SummaryInput; hash: string }> {
  const [[obs], resume, { claims, sources }] = await Promise.all([
    db.select().from(schema.observations).where(eq(schema.observations.connectionId, connectionId)),
    latestResume(candidate.id),
    claimsFor(candidate.id),
  ]);
  const urlOf = new Map(sources.map((s) => [s.id, s.kind === "file" ? "" : s.url]));
  const evidence = claims
    .filter((c) => !c.hiddenByRecruiterId && c.evidenceSourceId && c.evidenceQuote && (c.status === "verified" || c.status === "partial"))
    .map((c) => ({ text: c.text, quote: c.evidenceQuote!, url: urlOf.get(c.evidenceSourceId!) ?? "" }));
  const input: SummaryInput = {
    candidate: {
      firstName: candidate.firstName, preferredName: candidate.preferredName, university: candidate.university, degreeProgram: candidate.degreeProgram, major: candidate.major,
      graduationDate: candidate.graduationDate, gpa: candidate.gpa, workAuthorization: candidate.workAuthorization, desiredFunction: candidate.desiredFunction,
      technicalInterests: candidate.technicalInterests, preferredLocations: candidate.preferredLocations, skills: candidate.skills, projects: candidate.projects, coursework: candidate.coursework,
    },
    resumeText: resume?.extractedText ?? "",
    notes: obs?.notes, areasOfInterest: obs?.areasOfInterest, candidateQuestions: obs?.candidateQuestions, followUpQuestions: obs?.followUpQuestions, recommendedNextSteps: obs?.recommendedNextSteps,
    tags: obs?.tags, evidence,
  };
  return { input, hash: sha256(JSON.stringify(input)) };
}

export const REQUIRED_FIELDS = ["university", "major", "graduationDate", "desiredFunction", "preferredLocations", "skills", "projects", "workAuthorization"] as const;
const FIELD_LABEL: Record<(typeof REQUIRED_FIELDS)[number], string> = { university: "University", major: "Major", graduationDate: "Graduation date", desiredFunction: "Desired role", preferredLocations: "Preferred location", skills: "Skills", projects: "Projects", workAuthorization: "Work authorization" };

/** Profile fields the recruiter can still ask about while the student is standing there. */
export function missingFields(c: typeof schema.candidates.$inferSelect): string[] {
  return REQUIRED_FIELDS.filter((k) => { const v = c[k]; return Array.isArray(v) ? v.length === 0 : !v; }).map((k) => FIELD_LABEL[k]);
}

export async function eventTags(eventId: string | null) {
  if (!eventId) return [];
  return (await db.select({ label: schema.tags.label }).from(schema.tags).where(eq(schema.tags.eventId, eventId)).orderBy(asc(schema.tags.position), asc(schema.tags.label))).map((t) => t.label);
}

export async function otherMeetings(candidateIds: string[], eventId: string | null) {
  if (!candidateIds.length || !eventId) return new Map<string, { connectionId: string; recruiterId: string; name: string }[]>();
  const rows = await db
    .select({ candidateId: schema.connections.candidateId, connectionId: schema.connections.id, recruiterId: schema.connections.recruiterId, name: schema.recruiters.name })
    .from(schema.connections).innerJoin(schema.recruiters, eq(schema.connections.recruiterId, schema.recruiters.id))
    .where(and(inArray(schema.connections.candidateId, candidateIds), eq(schema.connections.eventId, eventId)));
  const map = new Map<string, { connectionId: string; recruiterId: string; name: string }[]>();
  for (const r of rows) map.set(r.candidateId, [...(map.get(r.candidateId) ?? []), r]);
  return map;
}
