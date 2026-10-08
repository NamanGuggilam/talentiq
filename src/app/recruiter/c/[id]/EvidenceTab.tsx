import { recheckEvidence, toggleClaim } from "@/app/actions/recruiter";
import { SubmitButton } from "@/components/SubmitButton";
import { ClaimPill, Empty, Pill } from "@/components/ui";
import type { schema } from "@/db";
import { LINK_LABEL } from "@/lib/scrape/sources";

type Claim = typeof schema.claims.$inferSelect;
type Source = typeof schema.evidenceSources.$inferSelect;
const TYPE_LABEL = { skill: "Skill", project: "Project", award: "Award", certification: "Certification", experience: "Experience" } as const;

function ClaimRow({ claim, source, connectionId, canEdit }: { claim: Claim; source?: Source; connectionId: string; canEdit: boolean }) {
  const hidden = !!claim.hiddenByRecruiterId;
  return (
    <li className={`grid gap-3 py-4 ${hidden ? "opacity-55" : ""}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <ClaimPill status={claim.status} />
          <span className="eyebrow">{TYPE_LABEL[claim.type]}</span>
          {hidden && <Pill tone="outline">Hidden from summary</Pill>}
        </div>
        <p className="mt-2 font-medium">{claim.text}</p>
        {claim.explanation && <p className="mt-1 text-[0.9375rem] text-ink-2">{claim.explanation}</p>}
        {claim.evidenceQuote && source && (
          <figure className="mt-3 border-l-2 border-line-strong pl-3">
            <blockquote className="text-[0.9375rem] text-ink-2">“{claim.evidenceQuote}”</blockquote>
            <figcaption className="eyebrow mt-1">
              {LINK_LABEL[source.kind]} · {source.kind === "file" ? source.url : <a className="underline" href={source.url} target={source.url.startsWith("/") ? undefined : "_blank"} rel="noreferrer noopener">{source.url.replace(/^https:\/\//, "")}</a>}
            </figcaption>
          </figure>
        )}
        {claim.suggestedQuestion && !hidden && (
          <p className="mt-3 rounded-md border border-line-strong bg-raised px-3 py-2 text-[0.9375rem]"><span className="eyebrow mr-2">Ask</span>{claim.suggestedQuestion}</p>
        )}
      </div>
      {canEdit && claim.status !== "not_checked" && (
        <form action={toggleClaim} className="">
          <input type="hidden" name="connectionId" value={connectionId} />
          <input type="hidden" name="claimId" value={claim.id} />
          <SubmitButton className="btn btn-quiet btn-sm">{hidden ? "Restore" : "Looks wrong"}</SubmitButton>
        </form>
      )}
    </li>
  );
}

/** What the linked pages say about each resume claim. Labels only: no totals, no percentage, no score. */
export function EvidenceTab({ connectionId, candidate, claims, sources, canEdit }: { connectionId: string; candidate: typeof schema.candidates.$inferSelect; claims: Claim[]; sources: Source[]; canEdit: boolean }) {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const resumeClaims = claims.filter((c) => c.kind === "resume_claim");
  const extras = claims.filter((c) => c.kind === "found_not_on_resume");
  const links = Object.keys(candidate.links ?? {}).length;
  const running = candidate.evidenceState === "running";

  return (
    <div className="grid gap-5">
      <section className="card card-pad flex flex-wrap items-start justify-between gap-4" aria-labelledby="ev-how">
        <div className="max-w-2xl">
          <h2 id="ev-how" className="text-xl font-semibold">Differences are things to ask about, not reasons to reject.</h2>
          <p className="mt-1 text-ink-2">
            {sources.length ? "Checked against the links and files this student shared." : !links ? "No links or files were shared, so nothing was checked." : "Links were added but not allowed to be read."}
          </p>
          {sources.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {sources.map((s) => <li key={s.id}><Pill tone={s.fetchStatus === "ok" ? "ok" : "warn"}>{LINK_LABEL[s.kind]}: {s.fetchStatus === "ok" ? "read" : s.error ?? "not read"}</Pill></li>)}
            </ul>
          )}
        </div>
        {canEdit && (
          <form action={recheckEvidence}>
            <input type="hidden" name="connectionId" value={connectionId} />
            <SubmitButton className="btn btn-sm" disabled={running}>{running ? "Checking…" : "Check again"}</SubmitButton>
          </form>
        )}
      </section>

      {running && <p role="status" className="flex items-center gap-2 text-sm text-muted"><span className="spinner" />Reading linked pages and comparing them with the resume…</p>}

      {resumeClaims.length === 0 && !running ? (
        <Empty title="No checkable claims found">The resume has no awards, certifications, projects or named skills that a public page could confirm.</Empty>
      ) : (
        <section className="card card-pad" aria-labelledby="ev-claims">
          <h2 id="ev-claims" className="eyebrow">Resume claims</h2>
          <ul className="mt-1 divide-y divide-dashed divide-line">
            {resumeClaims.map((c) => <ClaimRow key={c.id} claim={c} source={c.evidenceSourceId ? byId.get(c.evidenceSourceId) : undefined} connectionId={connectionId} canEdit={canEdit} />)}
          </ul>
        </section>
      )}

      {extras.length > 0 && (
        <section className="card card-pad" aria-labelledby="ev-extra">
          <h2 id="ev-extra" className="eyebrow">Also found in linked pages · not on the resume</h2>
          <ul className="mt-3 grid gap-3">
            {extras.map((c) => {
              const s = c.evidenceSourceId ? byId.get(c.evidenceSourceId) : undefined;
              return (
                <li key={c.id} className={`rounded-md border border-line-strong bg-raised p-4 ${c.hiddenByRecruiterId ? "opacity-55" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-lg font-semibold">{c.text}</p>
                    <span className="eyebrow">{TYPE_LABEL[c.type]}</span>
                  </div>
                  {c.evidenceQuote && <p className="mt-1 text-sm text-ink-2">“{c.evidenceQuote}”</p>}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    {s && (s.kind === "file" ? <span className="eyebrow">{s.url}</span> : <a className="eyebrow underline" href={s.url} target={s.url.startsWith("/") ? undefined : "_blank"} rel="noreferrer noopener">{LINK_LABEL[s.kind]}</a>)}
                    {canEdit && (
                      <form action={toggleClaim}>
                        <input type="hidden" name="connectionId" value={connectionId} />
                        <input type="hidden" name="claimId" value={c.id} />
                        <SubmitButton className="btn btn-quiet btn-sm">{c.hiddenByRecruiterId ? "Restore" : "Looks wrong"}</SubmitButton>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
