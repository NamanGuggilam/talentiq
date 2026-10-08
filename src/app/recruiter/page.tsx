import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { LinePanel } from "./LinePanel";
import { LivePulse } from "@/components/LivePulse";
import { StatusSelect } from "@/components/StatusSelect";
import { Empty, PageHead, SummaryPill, displayName, fmtDate } from "@/components/ui";
import { db, schema } from "@/db";
import { requireRecruiter } from "@/lib/auth";
import { lineSignature } from "@/lib/line";

export const metadata: Metadata = { title: "People I met" };

/** Connected in the last few seconds: the row gets a brief highlight so the recruiter sees it arrive. */
const isFresh = (at: Date) => new Date().getTime() - at.getTime() < 20_000;

export default async function PeopleIMet() {
  const me = await requireRecruiter();
  const all = await db
    .select({ conn: schema.connections, c: schema.candidates, obs: schema.observations, sum: { status: schema.summaries.approvalStatus } })
    .from(schema.connections)
    .innerJoin(schema.candidates, eq(schema.connections.candidateId, schema.candidates.id))
    .leftJoin(schema.observations, eq(schema.observations.connectionId, schema.connections.id))
    .leftJoin(schema.summaries, eq(schema.summaries.connectionId, schema.connections.id))
    .where(eq(schema.connections.recruiterId, me.id))
    .orderBy(desc(schema.connections.consentedAt));

  const rows = all;

  return (
    <div className="shell pb-10">
      <PageHead eyebrow={`${all.length} met`} title="People" actions={<><LivePulse initialCount={all.length} initialLine={await lineSignature(me.id)} /><Link href="/recruiter/badge" className="btn btn-primary">Show my badge</Link></>}>
      </PageHead>

      <LinePanel me={me} />

      {all.length === 0 ? (
        <Empty title="No one yet" />
      ) : (
        <ol className="rows">
          {rows.map(({ conn, c, obs, sum }) => {
            const ratings = [["Comm", obs?.ratingCommunication], ["Tech", obs?.ratingTechnical], ["Interest", obs?.ratingInterest]].filter(([, v]) => v != null) as [string, number][];
            return (
              <li key={conn.id} className={`grid gap-3 p-4 desk:grid-cols-[minmax(0,1fr)_auto] desk:items-center ${isFresh(conn.consentedAt) ? "row-new" : ""}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <Link href={`/recruiter/c/${conn.id}`} className="font-display text-xl font-semibold underline-offset-4 hover:underline">{displayName(c)}</Link>
                    <span className="eyebrow">{fmtDate(conn.consentedAt)} · {conn.method === "nfc" ? "NFC tag" : conn.method === "tap" ? "Phone tap" : conn.method === "line" ? "From the line" : "QR scan"}</span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-ink-2">{[c.major, c.university, c.graduationDate].filter(Boolean).join(" · ") || "Profile details not provided"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {!obs?.captureCompletedAt && <span className="pill" data-tone="warn">Notes open</span>}
                    <SummaryPill state={sum?.status ?? "none"} />
                    {(obs?.tags ?? []).map((t) => <span key={t} className="tag">{t}</span>)}
                    {ratings.length > 0 && <span className="ml-1 text-xs text-muted" title="Your ratings of this conversation">My ratings: {ratings.map(([k, v]) => `${k} ${v}/5`).join(" · ")}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusSelect connectionId={conn.id} status={conn.status} label={`Status for ${displayName(c)}`} />
                  <Link href={`/recruiter/c/${conn.id}`} className="btn btn-sm" aria-label={`Open ${displayName(c)}`}>Open</Link>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
