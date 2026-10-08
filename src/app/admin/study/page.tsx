import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { ParticipantForm } from "../AdminForms";
import { updateStudySession } from "@/app/actions/admin";
import { Refresher } from "@/components/Refresher";
import { Empty, PageHead, Stat } from "@/components/ui";
import { db, schema } from "@/db";
import { requireCoordinator } from "@/lib/auth";
import { eventMeasures } from "@/lib/measures";

export const metadata: Metadata = { title: "Study and measures" };

const dur = (s: number | null) => (s == null ? "–" : s < 90 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`);
const pct = (v: number | null) => (v == null ? "–" : `${Math.round(v * 100)}%`);
const num = (v: number | null) => (v == null ? "–" : v.toFixed(1));

export default async function Study() {
  const me = await requireCoordinator();
  const [sessions, m] = await Promise.all([
    db.select().from(schema.studySessions).where(eq(schema.studySessions.eventId, me.eventId!)).orderBy(asc(schema.studySessions.participantCode), asc(schema.studySessions.orderIndex)),
    eventMeasures(me.eventId!),
  ]);
  const running = sessions.some((s) => s.startedAt && !s.endedAt);
  const done = (cond: "paper" | "talentiq") => sessions.filter((s) => s.condition === cond && s.startedAt && s.endedAt);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const taskSeconds = (cond: "paper" | "talentiq") => mean(done(cond).map((s) => (s.endedAt!.getTime() - s.startedAt!.getTime()) / 1000));
  const confidence = (cond: "paper" | "talentiq") => mean(done(cond).flatMap((s) => (s.confidence ? [s.confidence] : [])));
  const perRecord = (cond: "paper" | "talentiq") => mean(done(cond).flatMap((s) => (s.recordsCompleted ? [(s.endedAt!.getTime() - s.startedAt!.getTime()) / 1000 / s.recordsCompleted] : [])));

  return (
    <div className="shell pb-12">
      <PageHead eyebrow="Traditional process versus TalentIQ" title="Study and measures" actions={<><Link href="/admin" className="btn">Back to admin</Link><a href="/api/study/export" className="btn" download>Export CSV</a></>}>
        <p>Run each participant through the same task twice, once on paper and once here, with different matched candidate sets. Half start with paper.</p>
      </PageHead>

      <section aria-labelledby="live" className="mb-8">
        <h2 id="live" className="eyebrow mb-3">Recorded by the app at this event</h2>
        <div className="grid gap-3 desk:grid-cols-4">
          <Stat label="Capture time" value={dur(m.captureMedianSeconds)} sub={`Median, first note to Done · ${m.captured} of ${m.conversations} conversations`} />
          <Stat label="Review time" value={dur(m.reviewMedianSeconds)} sub={`Median, draft to approval · ${m.approved} approved`} />
          <Stat label="Completeness" value={pct(m.completeness)} sub="Required profile fields filled, averaged" />
          <Stat label="Consistency" value={pct(m.consistency)} sub="Approved summaries with every section present" />
          <Stat label="Statements kept" value={pct(m.keptShare)} sub={`${m.statementsDrafted} kept, ${m.removedByChecker} removed by the checker`} />
          <Stat label="Correction effort" value={num(m.editsPerApproved)} sub="Edits per approved summary" />
          <Stat label="Approved unedited" value={pct(m.approvedUnedited)} sub="Approved with no edits at all" />
          <Stat label="Drafts awaiting review" value={m.drafts - m.approved} sub={`${m.drafts} drafted in total`} />
        </div>
        <p className="hint mt-3">“Statements kept” counts what passed the source check, which is not the same as accuracy. Report summary accuracy from a hand-checked sample against the sources.</p>
      </section>

      <section aria-labelledby="cmp" className="mb-8">
        <h2 id="cmp" className="eyebrow mb-3">Controlled comparison · finished tasks only</h2>
        <div className="card overflow-x-auto" tabIndex={0} role="region" aria-label="Comparison of the two methods">
          <table className="data-table">
            <thead><tr><th scope="col">Measure</th><th scope="col">Paper</th><th scope="col">TalentIQ</th></tr></thead>
            <tbody>
              <tr><th scope="row" className="!bg-transparent">Participants finished</th><td>{done("paper").length}</td><td>{done("talentiq").length}</td></tr>
              <tr><th scope="row" className="!bg-transparent">Mean task time</th><td>{dur(taskSeconds("paper"))}</td><td>{dur(taskSeconds("talentiq"))}</td></tr>
              <tr><th scope="row" className="!bg-transparent">Mean time per record</th><td>{dur(perRecord("paper"))}</td><td>{dur(perRecord("talentiq"))}</td></tr>
              <tr><th scope="row" className="!bg-transparent">Mean decision confidence (1 to 7)</th><td>{num(confidence("paper"))}</td><td>{num(confidence("talentiq"))}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="hint mt-2">Completeness and consistency for the paper arm are coded by hand from the notes sheets, by two people, and added to the exported file.</p>
      </section>

      <section aria-labelledby="runs">
        <h2 id="runs" className="eyebrow mb-3">Participants</h2>
        <div className="card card-pad mb-4"><ParticipantForm /></div>
        {sessions.length === 0 ? <Empty title="No participants yet">Add a participant code to start timing their two tasks.</Empty> : (
          <ul className="grid gap-3">
            {sessions.map((s) => {
              const state = !s.startedAt ? "Not started" : !s.endedAt ? "Running" : `Finished in ${dur((s.endedAt.getTime() - s.startedAt.getTime()) / 1000)}`;
              return (
                <li key={s.id} className={`card card-pad ${s.startedAt && !s.endedAt ? "border-accent-deep" : ""}`}>
                  <form action={updateStudySession} className="grid gap-4 desk:grid-cols-[13rem_1fr_auto] desk:items-end">
                    <input type="hidden" name="id" value={s.id} />
                    <div>
                      <p className="font-mono text-lg font-semibold">{s.participantCode} <span className="text-muted">· task {s.orderIndex}</span></p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5"><span className="pill" data-tone={s.condition === "talentiq" ? "accent" : undefined} data-plain="">{s.condition === "talentiq" ? "TalentIQ" : "Paper"}</span><span className="pill" data-plain="">Set {s.candidateSet}</span></p>
                      <p className="eyebrow mt-2" role="status">{state}</p>
                    </div>
                    <div className="grid gap-3 desk:grid-cols-[8rem_11rem_1fr]">
                      <div className="field"><label htmlFor={`rc-${s.id}`} className="label">Records done</label><input id={`rc-${s.id}`} name="recordsCompleted" type="number" min={0} max={500} inputMode="numeric" defaultValue={s.recordsCompleted ?? ""} className="input" /></div>
                      <div className="field"><label htmlFor={`cf-${s.id}`} className="label">Confidence (1 to 7)</label><select id={`cf-${s.id}`} name="confidence" defaultValue={s.confidence ?? ""} className="input"><option value="">Not asked yet</option>{[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}{n === 1 ? " · not at all" : n === 7 ? " · completely" : ""}</option>)}</select></div>
                      <div className="field"><label htmlFor={`nt-${s.id}`} className="label">Observer notes</label><input id={`nt-${s.id}`} name="notes" maxLength={1000} defaultValue={s.notes ?? ""} className="input" /></div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {!s.startedAt && <button name="intent" value="start" className="btn btn-primary btn-sm">Start timer</button>}
                      {s.startedAt && !s.endedAt && <button name="intent" value="stop" className="btn btn-ink btn-sm">Stop and save</button>}
                      {s.endedAt && <button name="intent" value="save" className="btn btn-sm">Save</button>}
                      {s.startedAt && <button name="intent" value="reset" className="btn btn-quiet btn-sm">Reset timer</button>}
                      {s.orderIndex === 1 && <button name="intent" value="delete" className="btn btn-quiet btn-sm text-bad">Remove participant</button>}
                    </div>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
        <p className="hint mt-3">Ask the confidence question as worded in the brief: “How confident are you that your follow-up choices are supported by adequate information?”</p>
      </section>
      {running && <Refresher every={5000} />}
    </div>
  );
}
