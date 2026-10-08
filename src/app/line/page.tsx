import type { Metadata } from "next";
import Link from "next/link";
import { TurnAlert } from "./TurnAlert";
import { findMyRecruiter, joinLineOf, leaveLine } from "@/app/actions/candidate";
import { Refresher } from "@/components/Refresher";
import { SubmitButton } from "@/components/SubmitButton";
import { Notice, PageHead } from "@/components/ui";
import { requireCandidate } from "@/lib/auth";
import { MAX_LINES_PER_STUDENT, joinableLines, placesFor } from "@/lib/line";

export const metadata: Metadata = { title: "My place in line" };

export default async function Line({ searchParams }: { searchParams: Promise<{ placed?: string; error?: string }> }) {
  const me = await requireCandidate("/line");
  const [places, others, sp] = await Promise.all([placesFor(me.id), joinableLines(me.id), searchParams]);
  const called = places.filter((p) => p.status === "called");
  return (
    <div className="shell pb-10">
      <PageHead title="My place in line"><p>Walk around. This page updates on its own and tells you when a recruiter is ready for you.</p></PageHead>
      <TurnAlert called={called.map((c) => c.recruiterName)} />
      {sp.placed && sp.placed !== "none" && <div className="mb-3"><Notice tone="ok">{sp.placed}</Notice></div>}
      {sp.placed === "none" && <div className="mb-3"><Notice tone="warn">No open line could be matched right now. Pick a recruiter below, or try again in a minute.</Notice></div>}
      {sp.error && <div className="mb-3"><Notice tone="bad" role="alert">{sp.error}</Notice></div>}
      {places.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-xl font-semibold">You are not in a line</p>
          <p className="mx-auto mt-2 max-w-xs text-muted">We can match you to the recruiter who covers what you want to talk about.</p>
          <form action={findMyRecruiter} className="mt-4"><SubmitButton className="btn btn-primary w-full !min-h-12">Find my recruiter</SubmitButton></form>
        </div>
      ) : (
        <ul className="grid gap-3">
          {places.map((p) => (
            <li key={p.entryId} className={`card p-5 ${p.status === "called" ? "!border-accent-deep ring-1 ring-accent-deep" : ""}`}>
              <div className="flex items-center gap-4">
                {p.status === "called" ? (
                  <span className="relative grid h-20 w-20 flex-none place-items-center" aria-hidden="true">
                    <span className="burst" style={{ animationIterationCount: "infinite", animationDuration: "1.8s" }} />
                    <span className="grid h-16 w-16 place-items-center rounded-full bg-accent text-sm font-bold text-accent-ink">Now</span>
                  </span>
                ) : (
                  <span className="grid h-20 w-20 flex-none place-items-center rounded-full bg-raised shadow-[inset_0_0_0_3px_var(--accent)]"><span className="text-3xl font-bold tabular-nums" aria-hidden="true">{p.position}</span></span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">{p.recruiterName}</p>
                  <p className="truncate text-sm text-muted">{[p.title, p.company].filter(Boolean).join(" · ")}</p>
                  <p className="mt-1 font-semibold" role="status">
                    {p.status === "called" ? "It is your turn. Head to the booth."
                      : p.ahead === 0 ? "You are next."
                      : `Number ${p.position} in line · about ${p.waitMinutes} min`}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                {p.status === "called"
                  ? <Link href="/tap" className="btn btn-primary !min-h-12">Tap phones to share</Link>
                  : <span className="hint self-center">{p.ahead === 0 ? "Stay close to the booth." : `${p.ahead} ${p.ahead === 1 ? "person" : "people"} ahead of you.`}</span>}
                <form action={leaveLine}><input type="hidden" name="id" value={p.entryId} /><SubmitButton className="btn btn-quiet !min-h-12">Leave line</SubmitButton></form>
              </div>
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && places.length < MAX_LINES_PER_STUDENT && (
        <section className="mt-8" aria-labelledby="others">
          <h2 id="others" className="text-xl font-bold">Other recruiters</h2>
          <p className="hint mt-1">You can wait in up to {MAX_LINES_PER_STUDENT} lines at once.</p>
          <ul className="rows mt-3">
            {others.map((o) => (
              <li key={o.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{o.name}</p>
                  <p className="truncate text-sm text-muted">{o.focus || o.title || "Recruiter"}</p>
                  <p className="mt-0.5 text-sm text-ink-2">{o.waiting} waiting · about {o.minutes} min</p>
                </div>
                <form action={joinLineOf}><input type="hidden" name="recruiterId" value={o.id} /><SubmitButton className="btn btn-sm" aria-label={`Join ${o.name}'s line`}>Join</SubmitButton></form>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Refresher every={3500} />
    </div>
  );
}
