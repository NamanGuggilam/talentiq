import Link from "next/link";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { TapReceiver } from "./badge/TapReceiver";
import { callNext, resolveEntry, saveLineSettings, startWithoutTap } from "@/app/actions/recruiter";
import { SubmitButton } from "@/components/SubmitButton";
import { db, schema } from "@/db";
import type { Recruiter } from "@/lib/auth";
import { lineFor } from "@/lib/line";

const hoursAgo = (h: number) => new Date(new Date().getTime() - h * 3600_000);
const nameOf = (e: { firstName: string; preferredName: string | null; lastName: string }) => `${e.preferredName?.trim() || e.firstName} ${e.lastName}`;

/**
 * The recruiter's virtual line. Calling someone turns tap on (phone layouts) and offers "Start without tap".
 * Nobody leaves this panel silently: they are tapped in, started by hand, or moved to Missed.
 */
export async function LinePanel({ me }: { me: Recruiter }) {
  const since = hoursAgo(6);
  const [line, missed, [{ n: connections }], [latest]] = await Promise.all([
    lineFor(me.id),
    db.select({ id: schema.queueEntries.id, firstName: schema.candidates.firstName, preferredName: schema.candidates.preferredName, lastName: schema.candidates.lastName })
      .from(schema.queueEntries).innerJoin(schema.candidates, eq(schema.queueEntries.candidateId, schema.candidates.id))
      .where(and(eq(schema.queueEntries.recruiterId, me.id), eq(schema.queueEntries.status, "skipped"), gt(schema.queueEntries.doneAt, since))).orderBy(desc(schema.queueEntries.doneAt)).limit(6),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.connections).where(eq(schema.connections.recruiterId, me.id)),
    // The person most recently brought in from the line, so their notes are one tap away.
    db.select({ connectionId: schema.connections.id, firstName: schema.candidates.firstName, preferredName: schema.candidates.preferredName, lastName: schema.candidates.lastName, done: schema.observations.captureCompletedAt })
      .from(schema.queueEntries)
      .innerJoin(schema.connections, and(eq(schema.connections.candidateId, schema.queueEntries.candidateId), eq(schema.connections.recruiterId, schema.queueEntries.recruiterId)))
      .innerJoin(schema.candidates, eq(schema.queueEntries.candidateId, schema.candidates.id))
      .leftJoin(schema.observations, eq(schema.observations.connectionId, schema.connections.id))
      .where(and(eq(schema.queueEntries.recruiterId, me.id), eq(schema.queueEntries.status, "served"), gt(schema.queueEntries.doneAt, hoursAgo(1 / 3))))
      .orderBy(desc(schema.queueEntries.doneAt)).limit(1),
  ]);
  const called = line.find((e) => e.status === "called");
  const waiting = line.filter((e) => e.status === "waiting");

  return (
    <section className="card card-pad mb-5" aria-labelledby="line-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="line-h" className="text-xl font-semibold">My line</h2>
        <span className="flex items-center gap-2"><span className="pill" data-tone={me.queueOpen ? "ok" : "outline"}>{me.queueOpen ? "Open" : "Closed"}</span><span className="pill">{waiting.length} waiting · about {waiting.length * me.minutesPer} min</span></span>
      </div>

      <div className="mt-4 grid gap-3 desk:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-[var(--radius-md)] bg-raised p-4">
          <p className="eyebrow">With you now</p>
          {called ? (
            <>
              <p className="mt-1 text-xl font-bold">{nameOf(called)}</p>
              <p className="text-sm text-muted">{called.major ?? "On their way to you"}</p>

              {/* Calling someone turns tap on. Tap lives in the phone layouts only. */}
              <div className="desk:hidden"><TapReceiver key={called.id} initialCount={connections} auto bare expecting={nameOf(called).split(" ")[0]} /></div>
              <p className="mt-3 hidden text-[0.9375rem] text-ink-2 desk:block">Tap phones with {nameOf(called).split(" ")[0]} using the phone version, or start without it. Their record opens here either way.</p>

              <div className="mt-3 grid gap-2">
                <form action={startWithoutTap}><input type="hidden" name="id" value={called.id} /><SubmitButton className="btn w-full !min-h-12">Start without tap</SubmitButton></form>
                <form action={resolveEntry}><input type="hidden" name="id" value={called.id} /><input type="hidden" name="to" value="skipped" /><SubmitButton className="btn btn-quiet w-full">Did not show up</SubmitButton></form>
              </div>
              <p className="hint mt-2">Start without tap opens their profile so you can add notes and ratings. They are saved to your list and to Review.</p>
            </>
          ) : (
            <>
              {latest ? (
                <p className="mt-1 text-ink-2">Last in: <Link className="link" href={`/recruiter/c/${latest.connectionId}`}>{nameOf(latest)}</Link>{latest.done ? "" : " · notes still open"}</p>
              ) : <p className="mt-1 text-ink-2">No one called yet.</p>}
              <form action={callNext} className="mt-3"><SubmitButton className="btn btn-primary w-full !min-h-12" disabled={waiting.length === 0}>Call next</SubmitButton></form>
            </>
          )}
        </div>

        <div className="rounded-[var(--radius-md)] bg-raised p-4">
          <p className="eyebrow">Up next</p>
          {waiting.length === 0 ? <p className="mt-1 text-ink-2">The line is empty. Students join by scanning your badge.</p> : (
            <ol className="mt-1 grid gap-1.5">
              {waiting.slice(0, 6).map((e, i) => (
                <li key={e.id} className="flex items-center gap-3">
                  <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-neutral-bg text-sm font-bold tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate"><span className="font-semibold">{nameOf(e)}</span>{e.major && <span className="text-muted"> · {e.major}</span>}</span>
                </li>
              ))}
              {waiting.length > 6 && <li className="hint">and {waiting.length - 6} more</li>}
            </ol>
          )}
          {missed.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="eyebrow">Missed</p>
              <ul className="mt-1 grid gap-1.5">
                {missed.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">{nameOf(m)}</span>
                    <form action={resolveEntry}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="to" value="waiting" /><SubmitButton className="btn btn-sm">Put back in line</SubmitButton></form>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <details className="mt-4 border-t border-line pt-3">
        <summary className="py-1 text-sm font-semibold text-accent-text">Line settings</summary>
        <form action={saveLineSettings} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex min-h-11 items-center gap-2 font-semibold"><input type="checkbox" name="queueOpen" defaultChecked={me.queueOpen} className="check" />Open to new people</label>
          <div className="field"><label htmlFor="minutesPer" className="eyebrow">Minutes per conversation</label><input id="minutesPer" name="minutesPer" type="number" min={1} max={30} defaultValue={me.minutesPer} className="input !min-h-10 w-28 !py-1.5" /></div>
          <div className="field"><label htmlFor="queueMax" className="eyebrow">Most people in line</label><input id="queueMax" name="queueMax" type="number" min={1} max={200} defaultValue={me.queueMax} className="input !min-h-10 w-28 !py-1.5" /></div>
          <div className="field w-full"><label htmlFor="focus" className="eyebrow">What you cover (students are matched to your line on this)</label><input id="focus" name="focus" maxLength={160} defaultValue={me.focus} placeholder="Software engineering, routing, cloud" className="input !min-h-10 !py-1.5" /></div>
          <SubmitButton className="btn btn-sm !min-h-10">Save</SubmitButton>
        </form>
      </details>
    </section>
  );
}
