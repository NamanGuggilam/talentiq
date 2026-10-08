import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { CaptureForm } from "./CaptureForm";
import { EvidenceTab } from "./EvidenceTab";
import { SummaryEditor } from "./SummaryEditor";
import { generateSummary } from "@/app/actions/recruiter";
import { Refresher } from "@/components/Refresher";
import { StatusSelect } from "@/components/StatusSelect";
import { SubmitButton } from "@/components/SubmitButton";
import { Empty, Notice, Pill, SummaryPill, displayName, fmtDate } from "@/components/ui";
import { db, schema } from "@/db";
import { aiProvider } from "@/lib/ai";
import { sourceBundle } from "@/lib/ai/mock";
import { requireRecruiter } from "@/lib/auth";
import { claimsFor, eventTags, latestResume, loadConnection, missingFields, otherMeetings, summaryInput } from "@/lib/records";
import { LINK_LABEL } from "@/lib/scrape/sources";

export const metadata: Metadata = { title: "Candidate" };
export const maxDuration = 60;
const TABS = [["capture", "Capture"], ["evidence", "Evidence"], ["summary", "Summary"]] as const;

export default async function CandidatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const me = await requireRecruiter();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { conn, candidate: c, owner, isOwner, canEdit } = await loadConnection(me, id);
  const tab = TABS.some(([k]) => k === sp.tab) ? (sp.tab as (typeof TABS)[number][0]) : "capture";

  const [[obs], [summary], resume, { claims, sources }, tags, others] = await Promise.all([
    db.select().from(schema.observations).where(eq(schema.observations.connectionId, id)),
    db.select().from(schema.summaries).where(eq(schema.summaries.connectionId, id)),
    latestResume(c.id),
    claimsFor(c.id),
    eventTags(conn.eventId),
    otherMeetings([c.id], conn.eventId),
  ]);
  const also = (others.get(c.id) ?? []).filter((o) => o.connectionId !== id);
  const missing = missingFields(c);
  const resumeClaims = claims.filter((k) => k.kind === "resume_claim");
  const toAsk = resumeClaims.filter((k) => !k.hiddenByRecruiterId && (k.status === "discrepancy" || k.status === "partial")).length;
  const links = Object.entries(c.links ?? {}) as [keyof typeof LINK_LABEL, string][];

  let approver: string | null = null;
  if (summary?.approvedByRecruiterId) [{ name: approver }] = await db.select({ name: schema.recruiters.name }).from(schema.recruiters).where(eq(schema.recruiters.id, summary.approvedByRecruiterId));
  const current = tab === "summary" ? await summaryInput(id, c) : null;

  return (
    <div className="shell pb-12">
      <div className="pb-4 pt-6">
        <Link href={isOwner ? "/recruiter" : "/dashboard"} className="link text-sm">← {isOwner ? "People I met" : "Review"}</Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold leading-tight">{displayName(c)}</h1>
            <p className="mt-1 text-ink-2">{[c.degreeProgram, c.major].filter(Boolean).join(" ")}{c.university ? ` · ${c.university}` : ""}{c.graduationDate ? ` · ${c.graduationDate}` : ""}</p>
            <p className="eyebrow mt-2">Met {owner.name} · {fmtDate(conn.consentedAt)}{also.length > 0 && <> · also met {also.map((o, i) => <span key={o.connectionId}>{i > 0 && ", "}<Link className="underline" href={`/recruiter/c/${o.connectionId}`}>{o.name}</Link></span>)}</>}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SummaryPill state={summary?.approvalStatus ?? "none"} />
            <StatusSelect connectionId={id} status={conn.status} disabled={!canEdit} />
          </div>
        </div>
      </div>

      <nav className="tabs desk:max-w-md" aria-label="Candidate sections">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/recruiter/c/${id}?tab=${k}`} className="tab" aria-current={tab === k ? "page" : undefined} scroll={false}>
            {label}
            {k === "evidence" && toAsk > 0 && <span className="ml-2 rounded-full bg-warn-bg px-1.5 py-0.5 text-xs text-warn">{toAsk} to ask</span>}
          </Link>
        ))}
      </nav>

      <div className="pt-6">
        {tab === "capture" && (
          <div className="grid gap-6 desk:grid-cols-[22rem_minmax(0,1fr)] desk:items-start">
            <aside className="grid content-start gap-4" aria-label="Candidate profile">
              <section className={`card card-pad ${missing.length ? "border-warn/60" : ""}`}>
                <h2 className="eyebrow">Still missing · ask now</h2>
                {missing.length ? <ul className="mt-2 flex flex-wrap gap-1.5">{missing.map((m) => <li key={m} className="pill" data-tone="warn">{m}</li>)}</ul> : <p className="mt-2 font-medium text-ok">Profile is complete.</p>}
              </section>

              <section className="card card-pad">
                <h2 className="eyebrow">From the student</h2>
                <dl className="mt-3 grid gap-3 text-[0.9375rem]">
                  <div><dt className="text-sm text-muted">Looking for</dt><dd className="font-medium">{c.desiredFunction || "Not provided"}</dd></div>
                  {!!c.technicalInterests?.length && <div><dt className="text-sm text-muted">Interests</dt><dd>{c.technicalInterests.join(", ")}</dd></div>}
                  {!!c.preferredLocations?.length && <div><dt className="text-sm text-muted">Locations</dt><dd>{c.preferredLocations.join(", ")}</dd></div>}
                  {c.workAuthorization && <div><dt className="text-sm text-muted">Work authorization</dt><dd>{c.workAuthorization}</dd></div>}
                  {c.gpa && <div><dt className="text-sm text-muted">GPA</dt><dd>{c.gpa}</dd></div>}
                  {!!c.skills?.length && <div><dt className="text-sm text-muted">Skills</dt><dd className="mt-1 flex flex-wrap gap-1.5">{c.skills.map((s) => <span key={s} className="tag">{s}</span>)}</dd></div>}
                  {!!c.projects?.length && <div><dt className="text-sm text-muted">Projects</dt><dd><ul className="mt-1 list-disc space-y-1 pl-5">{c.projects.map((p) => <li key={p}>{p}</li>)}</ul></dd></div>}
                  <div><dt className="text-sm text-muted">Contact</dt><dd className="break-all">{c.email}{c.phone ? ` · ${c.phone}` : ""}</dd></div>
                  {links.length > 0 && <div><dt className="text-sm text-muted">Links</dt><dd className="grid gap-0.5">{links.map(([k, url]) => <a key={k} className="link break-all" href={url} target={url.startsWith("/") ? undefined : "_blank"} rel="noreferrer noopener">{LINK_LABEL[k]}</a>)}</dd></div>}
                </dl>
              </section>

              {resume && (
                <details className="card">
                  <summary className="flex items-center justify-between gap-2 px-5 py-4 font-semibold">Resume text<span className="eyebrow">Open</span></summary>
                  <div className="border-t border-line px-5 py-4">
                    <pre tabIndex={0} aria-label="Resume text" className="max-h-96 overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-ink-2">{resume.extractedText}</pre>
                    <a className="link mt-3 inline-block text-sm" href={`/api/resume/${resume.id}`}>Download {resume.fileName}</a>
                  </div>
                </details>
              )}
            </aside>

            {isOwner ? (
              <CaptureForm
                connectionId={id}
                tags={tags}
                done={!!obs?.captureCompletedAt}
                claimQuestions={resumeClaims.filter((k) => !k.hiddenByRecruiterId && k.suggestedQuestion && (k.status === "discrepancy" || k.status === "partial")).map((k) => k.suggestedQuestion!).slice(0, 2)}
                initial={{
                  notes: obs?.notes ?? "", areasOfInterest: obs?.areasOfInterest ?? "", candidateQuestions: obs?.candidateQuestions ?? "", followUpQuestions: obs?.followUpQuestions ?? "", recommendedNextSteps: obs?.recommendedNextSteps ?? "",
                  tags: obs?.tags ?? [], ratingCommunication: obs?.ratingCommunication ?? null, ratingTechnical: obs?.ratingTechnical ?? null, ratingInterest: obs?.ratingInterest ?? null,
                }}
              />
            ) : (
              <section className="card card-pad" aria-labelledby="ro">
                <h2 id="ro" className="text-xl font-semibold">{owner.name}&apos;s notes</h2>
                <p className="hint mt-1">Only the recruiter who had the conversation can edit these.</p>
                <dl className="mt-4 grid gap-4">
                  {[["Tags", (obs?.tags ?? []).join(", ")], ["Areas of interest discussed", obs?.areasOfInterest], ["Notes", obs?.notes], ["Candidate's questions", obs?.candidateQuestions], ["Follow-up questions", obs?.followUpQuestions], ["Recommended next step", obs?.recommendedNextSteps]].map(([k, v]) => (
                    <div key={k}><dt className="eyebrow">{k}</dt><dd className="mt-1 whitespace-pre-wrap">{v || <span className="text-muted">Nothing recorded</span>}</dd></div>
                  ))}
                  <div><dt className="eyebrow">Rated by {owner.name}</dt><dd className="mt-1 text-sm">{[["Communication", obs?.ratingCommunication], ["Technical depth", obs?.ratingTechnical], ["Interest in the role", obs?.ratingInterest]].map(([k, v]) => `${k} ${v ?? "–"}/5`).join(" · ")}</dd></div>
                </dl>
              </section>
            )}
          </div>
        )}

        {tab === "evidence" && <EvidenceTab connectionId={id} candidate={c} claims={claims} sources={sources} canEdit={canEdit} />}

        {tab === "summary" && (
          !summary ? (
            <Empty title="No draft yet">
              <p>Drafts are built from the profile, the resume, the recruiter&apos;s notes and any checked links. Ratings are never included.</p>
              {canEdit && <form action={generateSummary.bind(null, id)} className="mt-5"><SubmitButton className="btn btn-primary">Draft a summary</SubmitButton></form>}
            </Empty>
          ) : (
            <div className="grid gap-4">
              {summary.approvalStatus !== "draft" && current && summary.sourcesHash !== current.hash && (
                <Notice tone="warn" role="alert"><span><span className="font-semibold">Sources changed since this was {summary.approvalStatus}.</span> The profile, notes or evidence have been edited. Draft again and review it before relying on this summary.</span></Notice>
              )}
              <SummaryEditor
                key={summary.createdAt.toISOString()}
                connectionId={id}
                canEdit={canEdit}
                initial={summary.edited ?? summary.draft}
                rejected={summary.rejectedStatements ?? []}
                approval={{ status: summary.approvalStatus, by: approver, at: summary.approvedAt ? fmtDate(summary.approvedAt) : null, editCount: summary.editCount }}
                provider={summary.provider}
                sources={current ? sourceBundle(current.input) : {}}
                evidence={current?.input.evidence ?? []}
              />
              <p className="hint flex flex-wrap items-center gap-2">
                <Pill plain>{summary.provider === "claude" ? "Drafted by Claude" : "Drafted by rules"}</Pill>
                Drafted {fmtDate(summary.createdAt)}. Draft engine available now: {aiProvider() === "claude" ? "Claude, with rule-based fallback" : "rule-based"}.
              </p>
            </div>
          )
        )}
      </div>
      {c.evidenceState === "running" && <Refresher every={3500} />}
    </div>
  );
}
