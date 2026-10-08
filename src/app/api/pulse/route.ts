import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { lineSignature } from "@/lib/line";
import { db, schema } from "@/db";
import { getRecruiter } from "@/lib/auth";

/** Cheap heartbeat for the recruiter's list: how many people have connected, and who was last. */
export async function GET() {
  const me = await getRecruiter();
  if (!me) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const [[{ count }], [latest]] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(schema.connections).where(eq(schema.connections.recruiterId, me.id)),
    db.select({ id: schema.connections.id, first: schema.candidates.firstName, preferred: schema.candidates.preferredName, last: schema.candidates.lastName })
      .from(schema.connections).innerJoin(schema.candidates, eq(schema.connections.candidateId, schema.candidates.id))
      .where(eq(schema.connections.recruiterId, me.id)).orderBy(desc(schema.connections.consentedAt)).limit(1),
  ]);
  return NextResponse.json({ line: await lineSignature(me.id), count, latestId: latest?.id ?? null, latestName: latest ? `${latest.preferred?.trim() || latest.first} ${latest.last}` : null }, { headers: { "cache-control": "no-store" } });
}
