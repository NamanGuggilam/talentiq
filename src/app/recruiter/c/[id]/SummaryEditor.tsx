"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { generateSummary, saveSummary } from "@/app/actions/recruiter";
import type { RejectedStatement, SourceLabel, SummaryDraft, SummaryStatement } from "@/db/schema";

type SectionKey = "snapshot" | "keySkills" | "relevantExperience";
const SECTIONS: [SectionKey, string][] = [["snapshot", "Snapshot"], ["keySkills", "Key skills"], ["relevantExperience", "Relevant experience"]];
type Bundle = { resume?: string; candidate?: string; notes?: string; linked?: string };
const PANEL: [SourceLabel, keyof Bundle, string][] = [["Resume", "resume", "Resume"], ["Candidate", "candidate", "Candidate's profile"], ["Recruiter note", "notes", "Recruiter's notes"], ["Linked page", "linked", "Linked pages"]];

const words = (s: string) => new Set((s.toLowerCase().match(/[a-z0-9+#]{3,}/g) ?? []));
const pieces = (text: string) => text.split(/\n+|(?<=[.!?])\s+|\s+\.\s+/).map((s) => s.trim()).filter((s) => s.length > 2);

/** The line in a source that shares the most words with a statement: what the reviewer should look at. */
function bestLine(statement: string, sourceText: string): string | null {
  const want = words(statement);
  let best: string | null = null, score = 0;
  for (const p of pieces(sourceText)) {
    const have = words(p);
    let hit = 0;
    for (const w of want) if (have.has(w)) hit++;
    const s = hit / Math.max(want.size, 1);
    if (s > score) { score = s; best = p; }
  }
  return score >= 0.3 ? best : null;
}

export function SummaryEditor({ connectionId, canEdit, initial, rejected, approval, provider, sources, evidence }: {
  connectionId: string; canEdit: boolean; initial: SummaryDraft; rejected: RejectedStatement[]; provider: string;
  approval: { status: "draft" | "approved" | "rejected"; by: string | null; at: string | null; editCount: number };
  sources: Bundle; evidence: { text: string; quote: string; url: string }[];
}) {
  const [draft, setDraft] = useState<SummaryDraft>(initial);
  const [selected, setSelected] = useState<{ section: SectionKey; index: number } | null>(null);
  const [editing, setEditing] = useState<{ section: SectionKey; index: number; text: string } | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [redrafting, startRedraft] = useTransition();
  const markRef = useRef<HTMLElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const current: SummaryStatement | null = selected ? draft[selected.section][selected.index] ?? null : null;
  let highlight: { key: keyof Bundle; line: string } | null = null;
  if (current) {
    for (const [label, key] of PANEL) {
      if (!current.sources.includes(label)) continue;
      const line = bestLine(current.text, sources[key] ?? "");
      if (line) { highlight = { key, line }; break; }
    }
  }
  const highlightId = highlight ? `${highlight.key}:${highlight.line}` : "";

  useEffect(() => { markRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }, [highlightId]);

  const update = (section: SectionKey, list: SummaryStatement[]) => { setDraft((d) => ({ ...d, [section]: list })); setMessage(null); };
  const commitEdit = () => {
    if (!editing) return;
    const text = editing.text.trim();
    const list = [...draft[editing.section]];
    if (!text) list.splice(editing.index, 1);
    else if (text !== list[editing.index].text) list[editing.index] = { ...list[editing.index], text, edited: true };
    update(editing.section, list);
    setEditing(null);
  };

  const run = (intent: "save" | "approve" | "reject") => start(async () => {
    const res = await saveSummary(connectionId, draft, intent);
    setMessage(res.ok ? { tone: "ok", text: intent === "approve" ? "Approved. This summary is now part of the record." : intent === "reject" ? "Rejected. It will not be exported." : "Edits saved." } : { tone: "bad", text: res.error ?? "Could not save." });
  });

  const renderSource = (key: keyof Bundle, text: string) => {
    if (!highlight || highlight.key !== key) return text;
    const at = text.indexOf(highlight.line);
    if (at < 0) return text;
    return <>{text.slice(0, at)}<mark ref={markRef} className="rounded-sm bg-accent px-0.5 text-accent-ink">{highlight.line}</mark>{text.slice(at + highlight.line.length)}</>;
  };

  const total = SECTIONS.reduce((n, [k]) => n + draft[k].length, 0);

  return (
    <div className="grid gap-5 desk:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] desk:items-start">
      <div className="grid content-start gap-4">
        <div className="card card-pad">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="eyebrow">{approval.status === "approved" ? `Approved by ${approval.by ?? "a recruiter"} · ${approval.at}` : approval.status === "rejected" ? `Rejected by ${approval.by ?? "a recruiter"} · ${approval.at}` : "Draft · not part of the record until approved"}</p>
            <p className="eyebrow">{total} statements · {approval.editCount} edits so far</p>
          </div>

          {SECTIONS.map(([key, label]) => (
            <section key={key} className="mt-5" aria-labelledby={`s-${key}`}>
              <h2 id={`s-${key}`} className="font-display text-lg font-semibold">{label}</h2>
              {draft[key].length === 0 ? <p className="mt-1 text-sm text-muted">Nothing supported by the sources.</p> : (
                <ul className="mt-2 grid gap-1.5">
                  {draft[key].map((st, i) => {
                    const isSel = selected?.section === key && selected.index === i;
                    const isEd = editing?.section === key && editing.index === i;
                    return (
                      <li key={`${key}-${i}`} className={`rounded-md border px-3 py-2 transition-colors ${isSel ? "border-accent-deep bg-raised" : "border-transparent hover:border-line"}`}>
                        {isEd ? (
                          <div className="grid gap-2">
                            <label htmlFor="edit-statement" className="sr-only">Edit statement</label>
                            <textarea id="edit-statement" autoFocus rows={2} maxLength={400} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commitEdit(); }} className="input" />
                            <div className="flex gap-2"><button type="button" className="btn btn-ink btn-sm" onClick={commitEdit}>Done</button><button type="button" className="btn btn-quiet btn-sm" onClick={() => setEditing(null)}>Cancel</button></div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                            <button type="button" className="min-w-0 flex-1 text-left" aria-pressed={isSel} onClick={() => setSelected(isSel ? null : { section: key, index: i })} title="Show where this came from">
                              <span>{st.text}</span>{" "}
                              <span className="whitespace-nowrap text-xs text-accent-text">[{st.sources.join(", ")}]</span>
                              {st.edited && <span className="ml-1.5 whitespace-nowrap text-xs text-muted">· edited by recruiter</span>}
                            </button>
                            {canEdit && (
                              <span className="flex flex-none gap-1">
                                <button type="button" className="btn btn-quiet btn-sm !min-h-8 !px-2" onClick={() => { setSelected({ section: key, index: i }); setEditing({ section: key, index: i, text: st.text }); }} aria-label={`Edit: ${st.text}`}>Edit</button>
                                <button type="button" className="btn btn-quiet btn-sm !min-h-8 !px-2" onClick={() => { update(key, draft[key].filter((_, j) => j !== i)); setSelected(null); }} aria-label={`Remove: ${st.text}`}>Remove</button>
                              </span>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ))}

          <section className="mt-5" aria-labelledby="s-missing">
            <h2 id="s-missing" className="font-display text-lg font-semibold">Missing information</h2>
            {draft.missingInfo.length ? <ul className="mt-2 flex flex-wrap gap-1.5">{draft.missingInfo.map((m) => <li key={m} className="pill" data-tone="warn">{m}</li>)}</ul> : <p className="mt-1 text-sm font-medium text-ok">Nothing required is missing.</p>}
          </section>

          {canEdit && (
            <div className="mt-6 border-t border-line-strong pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="btn btn-primary" disabled={pending || redrafting} aria-busy={pending} onClick={() => run("approve")}>{pending && <span className="spinner" />}{approval.status === "approved" && !dirty ? "Approved" : "Approve summary"}</button>
                <button type="button" className="btn" disabled={pending || redrafting || !dirty} onClick={() => run("save")}>Save edits</button>
                <button type="button" className="btn btn-danger" disabled={pending || redrafting} onClick={() => run("reject")}>Reject</button>
                <button type="button" className="btn btn-quiet ml-auto" disabled={pending || redrafting} aria-busy={redrafting} onClick={() => { if (!dirty || window.confirm("Draft again? Your unsaved edits will be replaced.")) startRedraft(() => generateSummary(connectionId)); }}>{redrafting && <span className="spinner" />}Draft again</button>
              </div>
              <p role="status" aria-live="polite" className={`mt-2 min-h-5 text-sm font-medium ${message?.tone === "bad" ? "text-bad" : "text-ok"}`}>{message?.text}{!message && dirty && <span className="text-muted">You have unsaved edits.</span>}</p>
            </div>
          )}
        </div>

        {rejected.length > 0 && (
          <details className="card">
            <summary className="flex items-center justify-between gap-2 px-5 py-4 font-semibold">Removed by the checker<span className="pill" data-tone="outline">{rejected.length} removed</span></summary>
            <div className="border-t border-line px-5 py-4">
              <p className="hint">The {provider === "claude" ? "model" : "draft"} wrote these, and code removed them before you saw the draft.</p>
              <ul className="mt-3 grid gap-3">
                {rejected.map((r, i) => (
                  <li key={i} className="border-l-2 border-bad pl-3">
                    <p className="text-[0.9375rem] line-through decoration-bad/60">{r.text}</p>
                    <p className="eyebrow mt-1">{r.reason}{r.sources.length ? ` · cited ${r.sources.join(", ")}` : ""}</p>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        )}
      </div>

      <aside className="card content-start desk:sticky desk:top-24 desk:max-h-[calc(100vh-7rem)] desk:overflow-auto" aria-label="Sources" tabIndex={0}>
        <div className="sticky top-0 z-10 border-b border-line bg-surface px-5 py-3">
          <h2 className="eyebrow">Sources</h2>
          <p className="mt-1 text-sm text-ink-2" role="status">{current ? (highlight ? "Highlighted: the line this statement rests on." : "No single line matches this statement closely. Check it against the sources below.") : "Select a statement to see where it came from."}</p>
        </div>
        <div className="grid gap-5 px-5 py-4">
          {PANEL.map(([label, key, title]) => {
            const text = (sources[key] ?? "").trim();
            const cited = current?.sources.includes(label);
            return (
              <section key={key} className={`rounded-md border p-3 transition-colors ${cited ? "border-accent-deep" : "border-line"}`} aria-label={title}>
                <h3 className="flex items-center justify-between gap-2 text-xs"><span>[{label}] {title}</span>{cited && <span className="pill" data-tone="accent" data-plain="">Cited</span>}</h3>
                {key === "linked" && evidence.length > 0 ? (
                  <ul className="mt-2 grid gap-2 text-sm text-ink-2">
                    {evidence.map((e, i) => <li key={i}><span className="font-medium text-ink">{renderSource("linked", e.text)}</span>: “{renderSource("linked", e.quote)}” <a className="link" href={e.url} target={e.url.startsWith("/") ? undefined : "_blank"} rel="noreferrer noopener">page</a></li>)}
                  </ul>
                ) : text ? (
                  <p tabIndex={0} className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-2">{renderSource(key, key === "candidate" || key === "notes" ? text.replace(/ \. /g, "\n") : text)}</p>
                ) : (
                  <p className="mt-2 text-sm text-muted">Nothing provided.</p>
                )}
              </section>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
