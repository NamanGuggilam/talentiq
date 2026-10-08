import type { Metadata } from "next";
import Link from "next/link";
import { TurnAlert } from "./TurnAlert";
import { findMyRecruiter, joinLineOf, leaveLine } from "@/app/actions/candidate";
import { Eq } from "@/components/Logo";
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
      <PageHead title="Your line" />
      <TurnAlert called={called.map((c) => c.recruiterName)} />
      {sp.placed && sp.placed !== "none" && <div className="mb-3"><Notice tone="ok">{sp.placed}</Notice></div>}
      {sp.placed === "none" && <div className="mb-3"><Notice tone="warn">No open line could be matched right now. Pick a recruiter below, or try again in a minute.</Notice></div>}
      {sp.error && <div className="mb-3"><Notice tone="bad" role="alert">{sp.error}</Notice></div>}
      {places.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="font-display text-2xl font-bold uppercase italic">You are not in a line</p>
          <form action={findMyRecruiter} className="mt-4"><SubmitButton className="btn btn-primary w-full !min-h-12">Find my recruiter</SubmitButton></form>
        </div>
      ) : (
        <ul className="grid gap-4">
          {places.map((p) => (
            <li key={p.entryId} className={`card band p-5 ${p.status === "called" ? "!bg-pink-deep text-white" : "!bg-accent text-accent-ink"}`}>
              {/* One sentence for screen readers and tests; the poster below says the same thing visually. */}
              <p className="sr-only" role="status">{p.status === "called" ? "It is your turn. Head to the booth." : p.ahead === 0 ? "You are next." : `Number ${p.position} in line · about ${p.waitMinutes} min`}</p>
              <div className="flex items-end justify-between gap-3" aria-hidden="true">
                {p.status === "called" ? (
                  <p className="numeral text-[4.5rem] uppercase">Go!</p>
                ) : (
                  <p className="flex items-end gap-2"><span className="numeral text-[7rem]">{p.position}</span><span className="pb-2 font-display text-lg font-bold uppercase italic leading-none">in<br />line</span></p>
                )}
                <p className="pb-2 text-right font-display font-bold uppercase italic leading-tight"><Eq className="mb-1 text-2xl" /><br />{p.status === "called" ? "Your turn" : p.ahead === 0 ? "You're next" : `~${p.waitMinutes} min`}</p>
              </div>
              <p className="mt-4 font-display text-2xl font-bold uppercase italic leading-none">{p.recruiterName}</p>
              <p className="text-sm font-bold opacity-80">{[p.title, p.company].filter(Boolean).join(" · ")}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {p.status === "called" && <Link href="/tap" className="btn !min-h-12 flex-1">Tap phones</Link>}
                <form action={leaveLine}><input type="hidden" name="id" value={p.entryId} /><SubmitButton className="btn btn-sm">Leave</SubmitButton></form>
              </div>
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && places.length < MAX_LINES_PER_STUDENT && (
        <section className="mt-8" aria-labelledby="others">
          <h2 id="others" className="text-xl">Other recruiters</h2>
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
