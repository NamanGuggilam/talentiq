import { NextResponse } from "next/server";
import { and, eq, gt, inArray, isNull, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCandidate, getRecruiter } from "@/lib/auth";
import { sameOrigin } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";

// Two phones count as tapped together when their taps reach the server within this many milliseconds.
const WINDOW_MS = 3500;

type Match = { id: string; token: string; name: string; title: string | null; company: string | null };

/** Recruiters whose phones were tapped at about the same moment as this student's tap. */
async function recruitersNear(at: Date): Promise<Match[]> {
  const rows = await db
    .selectDistinct({ id: schema.recruiters.id, token: schema.recruiters.connectToken, name: schema.recruiters.name, title: schema.recruiters.title, company: schema.events.company })
    .from(schema.taps)
    .innerJoin(schema.recruiters, eq(schema.taps.subjectId, schema.recruiters.id))
    .leftJoin(schema.events, eq(schema.recruiters.eventId, schema.events.id))
    .where(and(eq(schema.taps.kind, "recruiter"), gt(schema.taps.at, new Date(at.getTime() - WINDOW_MS)), lt(schema.taps.at, new Date(at.getTime() + WINDOW_MS)), isNull(schema.recruiters.disabledAt)))
    .limit(4);
  return rows;
}

async function studentsNear(at: Date): Promise<number> {
  const rows = await db.selectDistinct({ id: schema.taps.subjectId }).from(schema.taps)
    .where(and(eq(schema.taps.kind, "candidate"), gt(schema.taps.at, new Date(at.getTime() - WINDOW_MS)), lt(schema.taps.at, new Date(at.getTime() + WINDOW_MS))));
  return rows.length;
}

/**
 * Registers a tap. A student gets back the recruiter (or the few recruiters) who tapped at the same moment and still
 * has to press Share, so a mistaken match shares nothing. A recruiter's tap only makes them discoverable for a few seconds.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Request not allowed." }, { status: 403 });
  const [staff, me] = await Promise.all([getRecruiter(), getCandidate()]);
  const as = (await req.json().catch(() => ({})))?.as;
  const kind = as === "recruiter" && staff ? "recruiter" : me ? "candidate" : staff ? "recruiter" : null;
  if (!kind) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const subjectId = kind === "recruiter" ? staff!.id : me!.id;
  if (!(await rateLimit(`tap:${subjectId}`, 40, 60))) return NextResponse.json({ error: "Too many taps. Wait a moment." }, { status: 429 });

  await db.delete(schema.taps).where(lt(schema.taps.at, new Date(Date.now() - 60_000)));
  const [tap] = await db.insert(schema.taps).values({ kind, subjectId, at: new Date() }).returning(); // app clock on both sides of the comparison
  if (kind === "recruiter") return NextResponse.json({ id: tap.id, kind, nearby: await studentsNear(tap.at) });
  return NextResponse.json({ id: tap.id, kind, matches: await recruitersNear(tap.at) });
}

/** Re-checks an earlier tap, for when the other phone's tap reached the server a moment later. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Unknown tap." }, { status: 400 });
  const [staff, me] = await Promise.all([getRecruiter(), getCandidate()]);
  const owners = [staff?.id, me?.id].filter((x): x is string => !!x);
  if (!owners.length) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const [tap] = await db.select().from(schema.taps).where(and(eq(schema.taps.id, id), inArray(schema.taps.subjectId, owners)));
  if (!tap) return NextResponse.json({ matches: [], nearby: 0, expired: true });
  if (tap.kind === "recruiter") return NextResponse.json({ kind: tap.kind, nearby: await studentsNear(tap.at) }, { headers: { "cache-control": "no-store" } });
  return NextResponse.json({ kind: tap.kind, matches: await recruitersNear(tap.at) }, { headers: { "cache-control": "no-store" } });
}
