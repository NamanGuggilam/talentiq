import type { Metadata } from "next";
import Link from "next/link";
import { DashboardTable } from "./DashboardTable";
import { askSearch } from "@/app/actions/recruiter";
import { SubmitButton } from "@/components/SubmitButton";
import { Empty, Notice, PageHead } from "@/components/ui";
import { RECORD_STATUSES } from "@/db/schema";
import { requireRecruiter } from "@/lib/auth";
import { SORTS, loadDashboard, type DashParams } from "@/lib/dashboard";
import { track } from "@/lib/metrics";

export const metadata: Metadata = { title: "Review" };
export const maxDuration = 60;

export default async function Dashboard({ searchParams }: { searchParams: Promise<DashParams> }) {
  const me = await requireRecruiter();
  const sp = await searchParams;
  const { rows, total, options } = await loadDashboard(me, sp);
  if (sp.q && !sp.asked) await track("search_run", { recruiterId: me.id, payload: { natural: false, results: rows.length } });

  const active = (["q", "status", "summary", "recruiter", "university", "major", "grad", "tag", "auth"] as const).filter((k) => sp[k]);
  const query = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "notice" && k !== "asked") as [string, string][]).toString();
  const sel = "input !min-h-10 !py-1.5";

  return (
    <div className="shell pb-12">
      <PageHead eyebrow={`${total} conversations`} title="Review" />

      <div className="grid gap-4">
        {sp.notice === "norank" && <Notice tone="warn" role="alert"><span><span className="font-semibold">TalentIQ does not rank candidates.</span> Try searching by skill, major, location, tag or status instead{sp.asked ? <>. You asked: “{sp.asked}”</> : ""}.</span></Notice>}
        {sp.notice === "slow" && <Notice tone="warn" role="alert">Too many searches in a short time. Try again in a few minutes, or use the filters.</Notice>}
        {sp.asked && sp.notice !== "norank" && <Notice><span>You asked “{sp.asked}”. That was turned into the filters below; the question itself did not choose or order anyone.</span></Notice>}

        <section className="card card-pad" aria-label="Search and filters">
          <form action={askSearch} className="grid gap-2 desk:grid-cols-[1fr_auto] desk:items-end">
            <div className="field">
              <label htmlFor="ask" className="label">Ask in plain words</label>
              <input id="ask" name="ask" maxLength={240} defaultValue={sp.asked ?? ""} placeholder="Data science majors graduating 2027 who know SQL" className="input" aria-describedby="ask-hint" />
            </div>
            <SubmitButton className="btn btn-ink">Find</SubmitButton>
            <p id="ask-hint" className="hint">It will not answer “who is best”.</p>
          </form>

          <details className="mt-4 border-t border-line pt-3" open={active.length > 0 || !!sp.sort}>
            <summary className="flex items-center justify-between gap-2 py-1 font-semibold">Filters and order<span className="pill" data-tone={active.length ? "accent" : undefined}>{active.length ? `${active.length} on` : "None"}</span></summary>
            <div className="mt-3">

          <form className="grid gap-3 desk:grid-cols-[2fr_1fr_1fr_1fr_auto] desk:items-end" aria-label="Filters">
            <div className="field"><label htmlFor="q" className="eyebrow">Keywords</label><input id="q" name="q" defaultValue={sp.q ?? ""} placeholder="Python Dallas" className={sel} /></div>
            <div className="field"><label htmlFor="status" className="eyebrow">Status</label><select id="status" name="status" defaultValue={sp.status ?? ""} className={sel}><option value="">Any</option>{RECORD_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div className="field"><label htmlFor="tag" className="eyebrow">Tag</label><select id="tag" name="tag" defaultValue={sp.tag ?? ""} className={sel}><option value="">Any</option>{options.tags.map((u) => <option key={u}>{u}</option>)}</select></div>
            <div className="field"><label htmlFor="sort" className="eyebrow">Order by</label><select id="sort" name="sort" defaultValue={sp.sort ?? "met"} className={sel}>{Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div className="flex items-end gap-2"><button className="btn !min-h-10">Apply</button>{(active.length > 0 || sp.sort) && <Link href="/dashboard" className="btn btn-quiet !min-h-10">Clear</Link>}</div>
          </form>
            </div>
          </details>
        </section>

        {total === 0 ? (
          <Empty title="No conversations yet">Once students tap a badge at this event, they appear here for the whole team.</Empty>
        ) : rows.length === 0 ? (
          <Empty title="No one matches"><Link className="link" href="/dashboard">Clear the filters</Link> and try again.</Empty>
        ) : (
          <DashboardTable
            rows={rows.map((r) => ({ id: r.id, name: r.name, university: r.university, major: r.major, graduationDate: r.graduationDate, desiredFunction: r.desiredFunction, tags: r.tags, recruiterName: r.recruiterName, mine: r.recruiterId === me.id, ratings: r.ratings, summaryState: r.summaryState, status: r.status, alsoMet: r.alsoMet.map((a) => a.name) }))}
            canSetAll={me.role === "coordinator"}
            exportHref={`/api/export${query ? `?${query}` : ""}`}
            shown={rows.length}
            total={total}
          />
        )}
      </div>
    </div>
  );
}
