import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { ConnectForm } from "./ConnectForm";
import { LineJoin } from "./LineJoin";
import { lineFor } from "@/lib/line";
import { Mark } from "@/components/Logo";
import { displayName } from "@/components/ui";
import { db, dbReady, schema } from "@/db";
import { getCandidate } from "@/lib/auth";

export const metadata: Metadata = { title: "Share your profile" };

export default async function Connect({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ m?: string }> }) {
  const [{ token }, sp, me] = await Promise.all([params, searchParams, getCandidate()]);
  await dbReady;
  const [r] = /^[\w-]{8,64}$/.test(token)
    ? await db.select({ id: schema.recruiters.id, name: schema.recruiters.name, title: schema.recruiters.title, disabledAt: schema.recruiters.disabledAt, focus: schema.recruiters.focus, queueOpen: schema.recruiters.queueOpen, minutesPer: schema.recruiters.minutesPer, event: schema.events.name, company: schema.events.company })
        .from(schema.recruiters).leftJoin(schema.events, eq(schema.recruiters.eventId, schema.events.id)).where(eq(schema.recruiters.connectToken, token))
    : [];

  const frame = (children: React.ReactNode) => (
    <div className="flex min-h-[72vh] items-center py-10"><div className="shell"><div className="card card-pad rise">{children}</div></div></div>
  );

  if (!r || r.disabledAt) {
    return frame(<>
      <p className="eyebrow">Badge link</p>
      <h1 className="mt-2 text-2xl font-bold">This badge link is not valid</h1>
      <p className="mt-2 text-ink-2">It may have been replaced. Ask the recruiter to show their badge again.</p>
      <Link href="/" className="btn mt-5">Go to TalentIQ</Link>
    </>);
  }

  const who = (
    <div className="flex items-center gap-4 rounded-md border border-line bg-raised p-4">
      <span className="grid h-12 w-12 flex-none place-items-center rounded-full bg-accent font-display text-lg font-bold text-accent-ink" aria-hidden="true">{r.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
      <div className="min-w-0"><p className="truncate font-display text-lg font-semibold">{r.name}</p><p className="truncate text-sm text-muted">{[r.title, r.company].filter(Boolean).join(" · ")}</p>{r.focus ? <p className="mt-1 truncate text-sm text-ink-2">Covers: {r.focus}</p> : r.event && <p className="eyebrow mt-1 truncate">{r.event}</p>}</div>
    </div>
  );

  if (!me) {
    const next = encodeURIComponent(`/c/${token}${sp.m === "nfc" ? "?m=nfc" : ""}`);
    return frame(<>
      <Mark size={40} />
      <p className="eyebrow mt-4">Step 1 of 2</p>
      <h1 className="mt-2 text-2xl font-bold">Make a profile to share</h1>
      <p className="mb-4 mt-2 text-ink-2">It takes about two minutes. You will come straight back here to share it.</p>
      {who}
      <div className="mt-5 grid gap-2"><Link href={`/signup?next=${next}`} className="btn btn-primary">Create my profile</Link><Link href={`/find?next=${next}`} className="btn">I already have one</Link></div>
    </>);
  }

  const [[existing], line] = await Promise.all([
    db.select({ id: schema.connections.id }).from(schema.connections).where(and(eq(schema.connections.candidateId, me.id), eq(schema.connections.recruiterId, r.id))),
    lineFor(r.id),
  ]);
  const nfc = sp.m === "nfc";
  const share = <ConnectForm token={token} method={nfc ? "nfc" : "qr"} already={!!existing} recruiterName={r.name} myName={displayName(me)} autoSend={nfc}>{who}</ConnectForm>;
  // Already shared, or the phone was tapped on the recruiter's NFC tag: go straight to sharing.
  if (existing || nfc) return frame(share);

  const mine = line.find((e) => e.candidateId === me.id);
  const waiting = line.filter((e) => e.status === "waiting").length;
  const busy = line.some((e) => e.status === "called") ? 1 : 0;
  return frame(<>
    <p className="eyebrow">Virtual line</p>
    <h1 className="mb-4 mt-1 text-2xl font-bold">Talk to {r.name.split(" ")[0]}</h1>
    {who}
    <div className="mt-4"><LineJoin token={token} recruiterName={r.name} waiting={waiting} minutes={(waiting + busy) * r.minutesPer} open={r.queueOpen} inLine={!!mine} /></div>
    <details className="mt-5 border-t border-line pt-3">
      <summary className="py-1 text-center text-sm font-semibold text-accent-text">Already at the booth? Share without waiting</summary>
      <div className="mt-3">{share}</div>
    </details>
  </>);
}
