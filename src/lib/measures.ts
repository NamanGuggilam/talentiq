import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { REQUIRED_FIELDS } from "@/lib/records";

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

/** The sponsor's study measures, computed from what the app recorded for one event. */
export async function eventMeasures(eventId: string) {
  const rows = await db
    .select({ conn: schema.connections, c: schema.candidates, obs: schema.observations, sum: schema.summaries })
    .from(schema.connections)
    .innerJoin(schema.candidates, eq(schema.connections.candidateId, schema.candidates.id))
    .leftJoin(schema.observations, eq(schema.observations.connectionId, schema.connections.id))
    .leftJoin(schema.summaries, eq(schema.summaries.connectionId, schema.connections.id))
    .where(eq(schema.connections.eventId, eventId));
  const ids = rows.map((r) => r.conn.id);
  const events = ids.length ? await db.select().from(schema.metricsEvents).where(inArray(schema.metricsEvents.connectionId, ids)) : [];

  const capture = rows.flatMap((r) => (r.obs?.captureStartedAt && r.obs.captureCompletedAt ? [Math.max(0, (r.obs.captureCompletedAt.getTime() - r.obs.captureStartedAt.getTime()) / 1000)] : []));
  const review = rows.flatMap((r) => (r.sum?.approvedAt && r.sum.approvalStatus === "approved" ? [Math.max(0, (r.sum.approvedAt.getTime() - r.sum.createdAt.getTime()) / 1000)] : []));
  const filled = rows.map((r) => REQUIRED_FIELDS.filter((k) => { const v = r.c[k]; return Array.isArray(v) ? v.length > 0 : !!v; }).length / REQUIRED_FIELDS.length);
  const approved = rows.filter((r) => r.sum?.approvalStatus === "approved");
  const complete = approved.filter((r) => { const d = r.sum!.edited ?? r.sum!.draft; return d.snapshot.length && d.keySkills.length && d.relevantExperience.length; });
  const generated = events.filter((e) => e.kind === "summary_generated").map((e) => e.payload as { statements?: number; removed?: number });
  const statements = generated.reduce((n, g) => n + (g.statements ?? 0), 0), removed = generated.reduce((n, g) => n + (g.removed ?? 0), 0);

  return {
    conversations: rows.length,
    captured: capture.length,
    captureMedianSeconds: median(capture),
    reviewMedianSeconds: median(review),
    completeness: avg(filled),
    consistency: approved.length ? complete.length / approved.length : null,
    approved: approved.length,
    drafts: rows.filter((r) => r.sum).length,
    editsPerApproved: avg(approved.map((r) => r.sum!.editCount)),
    approvedUnedited: approved.length ? approved.filter((r) => r.sum!.editCount === 0).length / approved.length : null,
    statementsDrafted: statements,
    removedByChecker: removed,
    keptShare: statements + removed ? statements / (statements + removed) : null,
  };
}
