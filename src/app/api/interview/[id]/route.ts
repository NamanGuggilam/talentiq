import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCandidate, getRecruiter } from "@/lib/auth";
import { interviewIcs } from "@/lib/interviews";

/** Calendar file for a booked interview, for the student or the recruiter it belongs to. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const missing = () => new NextResponse("Not found", { status: 404 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return missing();
  const [me, staff] = await Promise.all([getCandidate(), getRecruiter()]);
  const [row] = await db
    .select({ conn: schema.connections, first: schema.candidates.firstName, last: schema.candidates.lastName, recruiter: schema.recruiters.name, company: schema.events.company })
    .from(schema.connections).innerJoin(schema.candidates, eq(schema.connections.candidateId, schema.candidates.id)).innerJoin(schema.recruiters, eq(schema.connections.recruiterId, schema.recruiters.id)).leftJoin(schema.events, eq(schema.connections.eventId, schema.events.id))
    .where(eq(schema.connections.id, id));
  if (!row?.conn.interviewAt || (row.conn.candidateId !== me?.id && row.conn.recruiterId !== staff?.id)) return missing();
  return new NextResponse(interviewIcs({ id, at: row.conn.interviewAt, student: `${row.first} ${row.last}`, recruiter: row.recruiter, company: row.company }), {
    headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": 'attachment; filename="interview.ics"', "cache-control": "private, no-store" },
  });
}
