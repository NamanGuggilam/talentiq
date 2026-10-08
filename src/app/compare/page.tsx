import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusSelect } from "@/components/StatusSelect";
import { PageHead, SummaryPill } from "@/components/ui";
import { requireRecruiter } from "@/lib/auth";
import { loadDashboard, type DashRow } from "@/lib/dashboard";
import { track } from "@/lib/metrics";

export const metadata: Metadata = { title: "Compare" };

export default async function Compare({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const me = await requireRecruiter();
  const ids = ((await searchParams).ids ?? "").split(",").filter((s) => /^[0-9a-f-]{36}$/i.test(s)).slice(0, 4);
  const { rows } = await loadDashboard(me, {});
  // Columns keep the order the reviewer picked them in.
  const people = ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is DashRow => !!r);
  if (people.length < 2) redirect("/dashboard");
  await track("compare_opened", { recruiterId: me.id, payload: { count: people.length } });

  const list = (items: string[]) => (items.length ? <ul className="grid gap-1.5">{items.map((s, i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1 w-1 flex-none rounded-full bg-muted" aria-hidden="true" />{s}</li>)}</ul> : <span className="text-muted">Nothing recorded</span>);
  const approvedOnly = (p: DashRow, pick: (p: DashRow) => string[]) => (p.summaryState === "approved" && p.summary ? list(pick(p)) : <span className="text-muted">No approved summary</span>);

  const lines: [string, (p: DashRow) => React.ReactNode][] = [
    ["Looking for", (p) => p.desiredFunction || <span className="text-muted">Not provided</span>],
    ["Graduation", (p) => p.graduationDate || <span className="text-muted">Not provided</span>],
    ["Locations", (p) => p.locations.join(", ") || <span className="text-muted">Not provided</span>],
    ["Work authorization", (p) => p.workAuthorization || <span className="text-muted">Not provided</span>],
    ["Key skills", (p) => approvedOnly(p, (x) => x.summary!.keySkills.map((s) => s.text))],
    ["Relevant experience", (p) => approvedOnly(p, (x) => x.summary!.relevantExperience.map((s) => s.text))],
    ["Tags", (p) => (p.tags.length ? <span className="flex flex-wrap gap-1">{p.tags.map((t) => <span key={t} className="tag">{t}</span>)}</span> : <span className="text-muted">None</span>)],
    ["Recruiter's notes", (p) => (p.notes ? <span className="whitespace-pre-wrap">{p.notes}</span> : <span className="text-muted">None</span>)],
    ["Recommended next step", (p) => p.nextStep || <span className="text-muted">None</span>],
    ["Ratings", (p) => <span className="grid gap-0.5 text-xs"><span>Communication {p.ratings.comm ?? "–"}/5</span><span>Technical depth {p.ratings.tech ?? "–"}/5</span><span>Interest in the role {p.ratings.interest ?? "–"}/5</span><span className="mt-1 font-sans text-muted">Rated by {p.recruiterName}</span></span>],
    ["Missing information", (p) => (p.summary?.missingInfo.length ? <span className="flex flex-wrap gap-1">{p.summary.missingInfo.map((m) => <span key={m} className="pill" data-tone="warn">{m}</span>)}</span> : <span className="text-muted">Nothing flagged</span>)],
    ["Summary", (p) => <span className="flex flex-wrap items-center gap-2"><SummaryPill state={p.summaryState} />{p.approvedBy && <span className="text-xs text-muted">by {p.approvedBy}</span>}</span>],
    ["Status", (p) => <StatusSelect connectionId={p.id} status={p.status} disabled={p.recruiterId !== me.id && me.role !== "coordinator"} label={`Status for ${p.name}`} />],
  ];

  return (
    <div className="shell pb-12">
      <PageHead eyebrow="In the order you picked them" title="Side by side" actions={<Link href="/dashboard" className="btn">Back to review</Link>}>
        <p>The same fields for each person. Skills and experience come from approved summaries only.</p>
      </PageHead>

      {/* One card per person, with the same fields in the same order, so they read straight down on a phone. */}
      <div className={`grid gap-4 desk:items-start ${["", "", "desk:grid-cols-2", "desk:grid-cols-3", "desk:grid-cols-4"][people.length]}`}>
        {people.map((p) => (
          <article key={p.id} className="card card-pad">
            <h2 className="text-xl font-semibold"><Link href={`/recruiter/c/${p.id}?tab=summary`} className="underline-offset-4 hover:underline">{p.name}</Link></h2>
            <p className="text-sm text-muted">{[p.major, p.university].filter(Boolean).join(" · ")}</p>
            <dl className="mt-3">
              {lines.map(([label, cell]) => <div key={label} className="border-t border-line py-3"><dt className="eyebrow">{label}</dt><dd className="mt-1 text-[0.9375rem]">{cell(p)}</dd></div>)}
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
