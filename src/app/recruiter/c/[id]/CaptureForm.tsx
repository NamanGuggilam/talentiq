"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { completeCapture, saveObservation, suggestQuestions, type ObservationPatch } from "@/app/actions/recruiter";

type Values = { notes: string; areasOfInterest: string; candidateQuestions: string; followUpQuestions: string; recommendedNextSteps: string; tags: string[]; ratingCommunication: number | null; ratingTechnical: number | null; ratingInterest: number | null };

const RATINGS = [
  ["ratingCommunication", "Communication", "How clearly they explained their work in this conversation."],
  ["ratingTechnical", "Technical depth", "How far into the detail they could go when asked."],
  ["ratingInterest", "Interest in the role", "How specific their interest in this role and company was."],
] as const;

type Recognition = { continuous: boolean; interimResults: boolean; lang: string; start(): void; stop(): void; onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

type SpeechWindow = { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
const noSubscribe = () => () => {};
const hasSpeech = () => { const w = window as unknown as SpeechWindow; return !!(w.SpeechRecognition ?? w.webkitSpeechRecognition); };

export function CaptureForm({ connectionId, tags, initial, done, claimQuestions }: { connectionId: string; tags: string[]; initial: Values; done: boolean; claimQuestions: string[] }) {
  const [v, setV] = useState<Values>(initial);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState<string[]>(claimQuestions);
  const [asking, startAsking] = useTransition();
  const [finishing, startFinish] = useTransition();
  const [listening, setListening] = useState(false);
  // Browser capability, read after hydration so server and client markup agree.
  const canDictate = useSyncExternalStore(noSubscribe, hasSpeech, () => false);
  const dirty = useRef<ObservationPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rec = useRef<Recognition | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    const patch = dirty.current;
    if (!Object.keys(patch).length) return true;
    dirty.current = {};
    setSave("saving");
    const res = await saveObservation(connectionId, patch).catch(() => ({ ok: false, error: "Could not reach the server. Your text is still here; it will retry on the next change." }));
    if (!res.ok) { dirty.current = { ...patch, ...dirty.current }; setError(res.error ?? "Could not save."); setSave("error"); return false; }
    setSave("saved");
    return true;
  }, [connectionId]);

  const change = useCallback(<K extends keyof Values>(k: K, value: Values[K], now = false) => {
    setV((s) => ({ ...s, [k]: value }));
    dirty.current = { ...dirty.current, [k]: value };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, now ? 0 : 700);
  }, [flush]);

  useEffect(() => {
    // Save anything pending if the phone locks or the tab is hidden mid-conversation.
    const onHide = () => { if (document.visibilityState === "hidden") void flush(); };
    document.addEventListener("visibilitychange", onHide);
    return () => { document.removeEventListener("visibilitychange", onHide); rec.current?.stop(); };
  }, [flush]);

  function toggleDictation() {
    if (listening) return rec.current?.stop();
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.continuous = true; r.interimResults = false; r.lang = "en-US";
    r.onresult = (e) => {
      let heard = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) heard += e.results[i][0].transcript;
      if (heard.trim()) setV((s) => { const notes = `${s.notes}${s.notes && !/\s$/.test(s.notes) ? " " : ""}${heard.trim()}`.slice(0, 4000); dirty.current = { ...dirty.current, notes }; if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(flush, 700); return { ...s, notes }; });
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  }

  const prompt = (k: "areasOfInterest" | "candidateQuestions" | "followUpQuestions" | "recommendedNextSteps", label: string, placeholder: string) => (
    <div className="field">
      <label htmlFor={k} className="label">{label}</label>
      <input id={k} value={v[k]} maxLength={600} placeholder={placeholder} onChange={(e) => change(k, e.target.value)} onBlur={() => void flush()} className="input" />
    </div>
  );

  return (
    <form className="grid content-start gap-4" onSubmit={(e) => { e.preventDefault(); startFinish(async () => { if (await flush()) await completeCapture(connectionId); }); }}>
      <div className="glass sticky top-[3.75rem] z-20 flex items-center justify-between gap-3 rounded-[var(--radius-md)] px-3 py-2">
        <p className="eyebrow">{done ? "Capture finished · still editable" : "Capture · saves as you type"}</p>
        <p role="status" aria-live="polite" className={`text-xs ${save === "error" ? "text-bad" : "text-muted"}`}>
          {save === "saving" && "Saving…"}{save === "saved" && "Saved"}{save === "error" && error}
        </p>
      </div>

      {questions.length > 0 && (
        <section className="card card-pad" aria-labelledby="ask">
          <h2 id="ask" className="eyebrow">Questions you could ask</h2>
          <ul className="mt-3 grid gap-2">{questions.map((q) => <li key={q} className="flex gap-3 text-[0.9375rem]"><span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-accent" aria-hidden="true" />{q}</li>)}</ul>
        </section>
      )}
      <div>
        <button type="button" className="btn btn-sm" disabled={asking} aria-busy={asking} onClick={() => startAsking(async () => { const q = await suggestQuestions(connectionId); if (q.length) setQuestions([...new Set([...claimQuestions, ...q])].slice(0, 4)); })}>
          {asking && <span className="spinner" />}Suggest questions from their resume
        </button>
      </div>

      <section className="card card-pad" aria-labelledby="tags-h">
        <h2 id="tags-h" className="eyebrow">Tags</h2>
        {tags.length === 0 ? <p className="hint mt-2">No tags are set up for this event. A coordinator can add them in Admin.</p> : (
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-labelledby="tags-h">
            {tags.map((t) => (
              <label key={t} className="toggle-chip">
                <input type="checkbox" checked={v.tags.includes(t)} onChange={(e) => change("tags", e.target.checked ? [...v.tags, t] : v.tags.filter((x) => x !== t), true)} />
                {t}
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="card card-pad grid gap-4" aria-labelledby="notes-h">
        <div className="flex items-center justify-between gap-3">
          <h2 id="notes-h" className="eyebrow">Conversation notes</h2>
          {canDictate && (
            <button type="button" className={`btn btn-sm ${listening ? "btn-ink" : ""}`} aria-pressed={listening} onClick={toggleDictation}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><rect x="4.5" y="1" width="5" height="8" rx="2.5" stroke="currentColor" strokeWidth="1.5" /><path d="M2 7a5 5 0 0 0 10 0M7 12v1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              {listening ? "Stop dictating" : "Dictate"}
            </button>
          )}
        </div>
        {prompt("areasOfInterest", "Areas of interest discussed", "Routing engine team, summer internship")}
        <div className="field">
          <label htmlFor="notes" className="label">Notes</label>
          <textarea id="notes" rows={5} maxLength={4000} value={v.notes} placeholder="What they told you, in their words where you can." onChange={(e) => change("notes", e.target.value)} onBlur={() => void flush()} className="input" aria-describedby="notes-hint" />
          <p id="notes-hint" className="hint">Write what was said. Hunches such as “probably a strong leader” are kept out of the summary.{listening && <span className="ml-1 font-semibold text-ink">Listening… audio is not stored.</span>}</p>
        </div>
        {prompt("candidateQuestions", "What they asked you", "Asked about relocation and mentorship")}
        {prompt("followUpQuestions", "Follow-up questions for later", "Ask about the scale of the capstone dataset")}
        {prompt("recommendedNextSteps", "Recommended next step", "Send internship posting, intro to routing team")}
      </section>

      <section className="card card-pad" aria-labelledby="rate-h">
        <h2 id="rate-h" className="eyebrow">Your ratings of this conversation</h2>
        <p className="hint mt-1">Your judgement, recorded under your name. Optional. The AI never sees these and never produces a score of its own.</p>
        <div className="mt-4 grid gap-5">
          {RATINGS.map(([k, label, help]) => (
            <fieldset key={k}>
              <legend className="label">{label}</legend>
              <p className="hint mb-2">{help}</p>
              <div className="flex items-center gap-3">
                <div className="scale flex-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label key={n}>
                      <input type="radio" name={k} value={n} checked={v[k] === n} onChange={() => change(k, n, true)} aria-label={`${label}: ${n} out of 5${n === 1 ? ", limited in this conversation" : n === 5 ? ", strong in this conversation" : ""}`} />
                      {n}
                    </label>
                  ))}
                </div>
                <button type="button" className="btn btn-quiet btn-sm" disabled={v[k] == null} onClick={() => change(k, null, true)} aria-label={`Clear ${label} rating`}>Clear</button>
              </div>
              <div className="mt-1 flex justify-between pr-[4.5rem] text-[0.6875rem] text-muted" aria-hidden="true"><span>Limited</span><span>Strong</span></div>
            </fieldset>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary !min-h-12 !px-5" disabled={finishing} aria-busy={finishing}>{finishing && <span className="spinner" />}{done ? "Save and redraft summary" : "Done, draft the summary"}</button>
        <p className="hint">Records the capture time and drafts a sourced summary for you to check.</p>
      </div>
    </form>
  );
}
