import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lt } from "drizzle-orm";
import { db, dbReady, schema } from "@/db";
import { randomToken, sha256 } from "./crypto";

const COOKIE = { recruiter: "tiq_staff", candidate: "tiq_me" } as const;
const TTL_SECONDS = { recruiter: 60 * 60 * 12, candidate: 60 * 60 * 24 * 30 } as const;
type Kind = keyof typeof COOKIE;

export type Recruiter = typeof schema.recruiters.$inferSelect;
export type Candidate = typeof schema.candidates.$inferSelect;

export async function startSession(kind: Kind, subjectId: string) {
  await dbReady;
  const token = randomToken();
  const expiresAt = new Date(Date.now() + TTL_SECONDS[kind] * 1000);
  await db.insert(schema.sessions).values({ tokenHash: sha256(token), kind, subjectId, expiresAt });
  // Opportunistic cleanup keeps the table small without a cron job.
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
  (await cookies()).set(COOKIE[kind], token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS[kind],
  });
}

export async function endSession(kind: Kind) {
  const jar = await cookies();
  const token = jar.get(COOKIE[kind])?.value;
  if (token) {
    await dbReady;
    await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, sha256(token)));
  }
  jar.delete(COOKIE[kind]);
}

export async function endAllSessions(subjectId: string) {
  await dbReady;
  await db.delete(schema.sessions).where(eq(schema.sessions.subjectId, subjectId));
}

async function subjectFor(kind: Kind): Promise<string | null> {
  const token = (await cookies()).get(COOKIE[kind])?.value;
  if (!token) return null;
  await dbReady;
  const [s] = await db
    .select({ subjectId: schema.sessions.subjectId })
    .from(schema.sessions)
    .where(and(eq(schema.sessions.tokenHash, sha256(token)), eq(schema.sessions.kind, kind), gt(schema.sessions.expiresAt, new Date())));
  return s?.subjectId ?? null;
}

export const getRecruiter = cache(async (): Promise<Recruiter | null> => {
  const id = await subjectFor("recruiter");
  if (!id) return null;
  const [r] = await db.select().from(schema.recruiters).where(eq(schema.recruiters.id, id));
  return r && !r.disabledAt ? r : null;
});

export const getCandidate = cache(async (): Promise<Candidate | null> => {
  const id = await subjectFor("candidate");
  if (!id) return null;
  const [c] = await db.select().from(schema.candidates).where(eq(schema.candidates.id, id));
  return c ?? null;
});

export async function requireRecruiter(): Promise<Recruiter> {
  const r = await getRecruiter();
  if (!r) redirect("/login");
  return r;
}

export async function requireCoordinator(): Promise<Recruiter> {
  const r = await requireRecruiter();
  if (r.role !== "coordinator") redirect("/recruiter");
  return r;
}

export async function requireCandidate(next = "/me"): Promise<Candidate> {
  const c = await getCandidate();
  if (!c) redirect(`/signup?next=${encodeURIComponent(next)}`);
  return c;
}

export { safeNext } from "./auth-paths";
