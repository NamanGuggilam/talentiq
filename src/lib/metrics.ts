import { db, schema } from "@/db";

export type MetricKind =
  | "signup_completed" | "connection_created" | "capture_started" | "capture_completed"
  | "summary_generated" | "summary_edited" | "summary_approved" | "summary_rejected"
  | "status_changed" | "search_run" | "compare_opened" | "export_run" | "evidence_checked";

/** Study instrumentation. Never throws: a failed metric must not break the action that produced it. */
export async function track(kind: MetricKind, data: { connectionId?: string | null; recruiterId?: string | null; payload?: Record<string, unknown> } = {}) {
  try {
    await db.insert(schema.metricsEvents).values({ kind, connectionId: data.connectionId ?? null, recruiterId: data.recruiterId ?? null, payload: data.payload ?? null });
  } catch (e) {
    console.error("metrics", kind, e);
  }
}
