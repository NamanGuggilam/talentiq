import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { RECORD_STATUSES, type RecordStatus, type SummaryDraft } from "@/db/schema";
import type { Recruiter } from "@/lib/auth";

export type DashParams = { q?: string; status?: string; summary?: string; recruiter?: string; university?: string; major?: string; grad?: string; tag?: string; auth?: string; sort?: string; asked?: string; notice?: string };
export const SORTS = { met: "Time met", name: "Name", updated: "Last updated", comm: "Recruiter's communication rating", tech: "Recruiter's technical rating", interest: "Recruiter's interest rating" } as const;

export type DashRow = {
  id: string; candidateId: string; name: string; email: string; phone: string | null; university: string | null; degree: string | null; major: string | null; graduationDate: string | null; gpa: string | null;
  desiredFunction: string | null; interests: string[]; locations: string[]; skills: string[]; workAuthorization: string | null;
  recruiterId: string; recruiterName: string; status: RecordStatus; metAt: Date; updatedAt: Date; method: string;
  tags: string[]; ratings: { comm: number | null; tech: number | null; interest: number | null };
  summaryState: "none" | "draft" | "approved" | "rejected"; summary: SummaryDraft | null; approvedBy: string | null; approvedAt: Date | null;
  notes: string; nextStep: string | null; alsoMet: { connectionId: string; name: string }[];
};

export const summaryText = (d: SummaryDraft | null) => (d ? [...d.snapshot, ...d.keySkills, ...d.relevantExperience].map((s) => s.text).join(" ") : "");

/**
 * Everyone the team met at the signed-in recruiter's event, filtered.
 * Search reads profile fields, tags and approved summaries only. Order is always something a person chose:
 * time, name, or a rating a recruiter typed in. Nothing here is ordered by AI output.
 */
export async function loadDashboard(me: Recruiter, p: DashParams): Promise<{ rows: DashRow[]; total: number; options: { recruiters: { id: string; name: string }[]; universities: string[]; majors: string[]; tags: string[]; grads: string[] } }> {
  if (!me.eventId) return { rows: [], total: 0, options: { recruiters: [], universities: [], majors: [], tags: [], grads: [] } };
  const raw = await db
    .select({ conn: schema.connections, c: schema.candidates, r: { id: schema.recruiters.id, name: schema.recruiters.name }, obs: schema.observations, sum: schema.summaries })
    .from(schema.connections)
    .innerJoin(schema.candidates, eq(schema.connections.candidateId, schema.candidates.id))
    .innerJoin(schema.recruiters, eq(schema.connections.recruiterId, schema.recruiters.id))
    .leftJoin(schema.observations, eq(schema.observations.connectionId, schema.connections.id))
    .leftJoin(schema.summaries, eq(schema.summaries.connectionId, schema.connections.id))
    .where(eq(schema.connections.eventId, me.eventId));

  const names = new Map((await db.select({ id: schema.recruiters.id, name: schema.recruiters.name }).from(schema.recruiters).where(eq(schema.recruiters.eventId, me.eventId))).map((r) => [r.id, r.name]));
  const byCandidate = new Map<string, { connectionId: string; name: string }[]>();
  for (const x of raw) byCandidate.set(x.c.id, [...(byCandidate.get(x.c.id) ?? []), { connectionId: x.conn.id, name: x.r.name }]);

  const all: DashRow[] = raw.map(({ conn, c, r, obs, sum }) => ({
    id: conn.id, candidateId: c.id, name: `${c.preferredName?.trim() || c.firstName} ${c.lastName}`, email: c.email, phone: c.phone, university: c.university, degree: c.degreeProgram, major: c.major,
    graduationDate: c.graduationDate, gpa: c.gpa, desiredFunction: c.desiredFunction, interests: c.technicalInterests ?? [], locations: c.preferredLocations ?? [], skills: c.skills ?? [], workAuthorization: c.workAuthorization,
    recruiterId: r.id, recruiterName: r.name, status: conn.status, metAt: conn.consentedAt, updatedAt: [conn.updatedAt, obs?.updatedAt, sum?.approvedAt].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0], method: conn.method,
    tags: obs?.tags ?? [], ratings: { comm: obs?.ratingCommunication ?? null, tech: obs?.ratingTechnical ?? null, interest: obs?.ratingInterest ?? null },
    summaryState: sum?.approvalStatus ?? "none", summary: sum ? (sum.edited ?? sum.draft) : null, approvedBy: sum?.approvedByRecruiterId ? names.get(sum.approvedByRecruiterId) ?? null : null, approvedAt: sum?.approvedAt ?? null,
    notes: obs?.notes ?? "", nextStep: obs?.recommendedNextSteps ?? null,
    alsoMet: (byCandidate.get(c.id) ?? []).filter((o) => o.connectionId !== conn.id),
  }));

  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));
  const options = {
    recruiters: [...new Map(all.map((r) => [r.recruiterId, { id: r.recruiterId, name: r.recruiterName }])).values()].sort((a, b) => a.name.localeCompare(b.name)),
    universities: uniq(all.map((r) => r.university)), majors: uniq(all.map((r) => r.major)), tags: uniq(all.flatMap((r) => r.tags)), grads: uniq(all.map((r) => r.graduationDate?.match(/20\d\d/)?.[0] ?? null)),
  };

  const terms = (p.q ?? "").toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  const rows = all.filter((r) => {
    if (p.status && (RECORD_STATUSES as readonly string[]).includes(p.status) && r.status !== p.status) return false;
    if (p.summary && r.summaryState !== p.summary) return false;
    if (p.recruiter && r.recruiterId !== p.recruiter) return false;
    if (p.university && r.university !== p.university) return false;
    if (p.major && r.major !== p.major) return false;
    if (p.grad && !r.graduationDate?.includes(p.grad)) return false;
    if (p.tag && !r.tags.includes(p.tag)) return false;
    if (p.auth === "yes" && !r.workAuthorization) return false;
    if (p.auth === "no" && r.workAuthorization) return false;
    if (terms.length) {
      // Only approved summaries are searchable: an unreviewed draft is not part of the record.
      const hay = [r.name, r.university, r.major, r.degree, r.graduationDate, r.desiredFunction, ...r.interests, ...r.locations, ...r.skills, ...r.tags, r.summaryState === "approved" ? summaryText(r.summary) : ""].join(" ").toLowerCase();
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    return true;
  });

  const rating = (k: "comm" | "tech" | "interest") => (a: DashRow, b: DashRow) => (b.ratings[k] ?? -1) - (a.ratings[k] ?? -1) || a.name.localeCompare(b.name);
  const sorters: Record<string, (a: DashRow, b: DashRow) => number> = {
    met: (a, b) => b.metAt.getTime() - a.metAt.getTime(),
    name: (a, b) => a.name.localeCompare(b.name),
    updated: (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    comm: rating("comm"), tech: rating("tech"), interest: rating("interest"),
  };
  rows.sort(sorters[p.sort ?? "met"] ?? sorters.met);
  return { rows, total: all.length, options };
}
