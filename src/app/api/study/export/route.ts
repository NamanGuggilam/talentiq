import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getRecruiter } from "@/lib/auth";
import { toCsv } from "@/lib/http";
import { eventMeasures } from "@/lib/measures";

export async function GET() {
  const me = await getRecruiter();
  if (!me || me.role !== "coordinator" || !me.eventId) return new NextResponse("Not found", { status: 404 });
  const [sessions, m] = await Promise.all([
    db.select().from(schema.studySessions).where(eq(schema.studySessions.eventId, me.eventId)).orderBy(asc(schema.studySessions.participantCode), asc(schema.studySessions.orderIndex)),
    eventMeasures(me.eventId),
  ]);
  const rows: unknown[][] = [
    ["Participant", "Task order", "Method", "Candidate set", "Started", "Ended", "Task seconds", "Records completed", "Seconds per record", "Decision confidence (1-7)", "Observer notes", "Paper completeness (hand coded)", "Paper consistency (hand coded)"],
    ...sessions.map((s) => {
      const secs = s.startedAt && s.endedAt ? Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 1000) : "";
      return [s.participantCode, s.orderIndex, s.condition, s.candidateSet, s.startedAt?.toISOString() ?? "", s.endedAt?.toISOString() ?? "", secs, s.recordsCompleted ?? "", secs !== "" && s.recordsCompleted ? Math.round(secs / s.recordsCompleted) : "", s.confidence ?? "", s.notes ?? "", "", ""];
    }),
    [],
    ["App-recorded measure", "Value"],
    ...Object.entries(m).map(([k, v]) => [k, v == null ? "" : typeof v === "number" ? Math.round(v * 1000) / 1000 : v]),
  ];
  return new NextResponse("﻿" + toCsv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="talentiq-study-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "private, no-store" } });
}
