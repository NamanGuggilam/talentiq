"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { bulkStatus } from "@/app/actions/recruiter";
import { StatusPill, SummaryPill } from "@/components/ui";
import { RECORD_STATUSES, type RecordStatus } from "@/db/schema";

type Row = { id: string; name: string; university: string | null; major: string | null; graduationDate: string | null; desiredFunction: string | null; tags: string[]; recruiterName: string; mine: boolean; ratings: { comm: number | null; tech: number | null; interest: number | null }; summaryState: "none" | "draft" | "approved" | "rejected"; status: RecordStatus; alsoMet: string[] };

/** The review list as cards, so it reads straight down on a phone. Select people to compare them or set a status. */
export function DashboardTable({ rows, exportHref, shown, total }: { rows: Row[]; canSetAll: boolean; exportHref: string; shown: number; total: number }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [status, setStatusValue] = useState<RecordStatus>("Follow-Up");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const visible = picked.filter((id) => rows.some((r) => r.id === id));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const canCompare = visible.length >= 2 && visible.length <= 4;
  const rate = (v: number | null) => (v == null ? "–" : `${v}/5`);

  return (
    <section aria-label="Results" className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="eyebrow" role="status">Showing {shown} of {total}</p>
        <a href={exportHref} className="btn btn-sm" download>Export CSV</a>
      </div>

      <ul className="grid gap-2.5 desk:grid-cols-3 desk:gap-3">
        {rows.map((r) => {
          const on = picked.includes(r.id);
          const rated = r.ratings.comm != null || r.ratings.tech != null || r.ratings.interest != null;
          return (
            <li key={r.id} className={`card p-4 transition-shadow ${on ? "!shadow-[0_0_0_2px_var(--accent-deep),var(--glass-shadow)]" : ""}`}>
              <div className="flex items-start gap-3">
                <input type="checkbox" className="check mt-1" checked={on} onChange={() => toggle(r.id)} aria-label={`Select ${r.name}`} />
                <div className="min-w-0 flex-1">
                  <Link href={`/recruiter/c/${r.id}?tab=summary`} className="text-[1.0625rem] font-semibold underline-offset-4 hover:underline">{r.name}</Link>
                  <p className="text-sm text-muted">{[r.major, r.university, r.graduationDate].filter(Boolean).join(" · ") || "No details"}</p>
                  {r.desiredFunction && <p className="mt-1 text-sm text-ink-2">Looking for: {r.desiredFunction}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5"><StatusPill status={r.status} /><SummaryPill state={r.summaryState} />{r.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>
                  <p className="mt-2 text-[0.8125rem] text-muted">
                    Met {r.recruiterName}{r.mine ? " (you)" : ""}{r.alsoMet.length > 0 && <>, also {r.alsoMet.join(", ")}</>}
                    {rated && <><br />Rated by {r.recruiterName}: communication {rate(r.ratings.comm)}, technical {rate(r.ratings.tech)}, interest {rate(r.ratings.interest)}</>}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm font-semibold">{msg}</p>

      {visible.length > 0 && (
        <div className="glass sticky bottom-24 z-30 mt-2 grid gap-2 rounded-[var(--radius-lg)] p-3 desk:bottom-6 desk:mx-auto desk:max-w-xl" style={{ animation: "rise 400ms var(--ease-out-expo) both" }}>
          <p className="text-sm font-semibold">{visible.length} selected</p>
          {canCompare
            ? <Link href={`/compare?ids=${visible.join(",")}`} className="btn btn-primary">Compare {visible.length} side by side</Link>
            : <button type="button" className="btn" disabled>Compare (select 2 to 4)</button>}
          <div className="flex items-center gap-2">
            <label htmlFor="bulk" className="sr-only">Status to set for selected people</label>
            <select id="bulk" value={status} onChange={(e) => setStatusValue(e.target.value as RecordStatus)} className="input !min-h-10 flex-1 !py-1.5 text-sm">{RECORD_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
            <button type="button" className="btn btn-sm !min-h-10" disabled={pending} aria-busy={pending}
              onClick={() => start(async () => { const res = await bulkStatus(visible, status); setMsg(res.ok ? `${res.changed} set to ${status}.${res.error ? ` ${res.error}` : ""}` : res.error ?? "Could not update."); if (res.ok) setPicked([]); })}>
              Set status
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
