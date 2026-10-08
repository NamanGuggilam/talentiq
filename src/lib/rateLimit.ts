import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db, dbReady, schema } from "@/db";

/**
 * Fixed-window counter in Postgres, so limits hold across serverless instances.
 * Returns true if the call is allowed.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  await dbReady;
  const t = schema.rateLimits;
  const [row] = await db
    .insert(t)
    .values({ key, count: 1 })
    .onConflictDoUpdate({
      target: t.key,
      set: {
        count: sql`case when ${t.windowStart} < now() - make_interval(secs => ${windowSeconds}::double precision) then 1 else ${t.count} + 1 end`,
        windowStart: sql`case when ${t.windowStart} < now() - make_interval(secs => ${windowSeconds}::double precision) then now() else ${t.windowStart} end`,
      },
    })
    .returning({ count: t.count });
  return row.count <= max;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

/** Throttle by caller IP. */
export async function limitByIp(action: string, max: number, windowSeconds: number): Promise<boolean> {
  return rateLimit(`${action}:${await clientIp()}`, max, windowSeconds);
}
