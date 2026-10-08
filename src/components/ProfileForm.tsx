"use client";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { createCandidate, updateProfile, type ProfileState } from "@/app/actions/candidate";

type Values = { firstName: string; lastName: string; email: string; desiredFunction: string; links: string };
const BLANK: Values = { firstName: "", lastName: "", email: "", desiredFunction: "", links: "" };
type Found = { skills?: string[]; university?: string; major?: string; graduationDate?: string };

/**
 * The whole student form: a resume, optional other files, a name, what they want to talk about, and links.
 * Everything else on the profile is read from the resume by the server.
 */
export function ProfileForm({ mode, initial, next, hasResume, hasFiles, consented, existing }: { mode: "create" | "edit"; initial?: Partial<Values>; next?: string; hasResume?: string; hasFiles?: string[]; consented?: boolean; existing?: boolean }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(mode === "create" ? createCandidate : updateProfile, null);
  const [values, setValues] = useState<Values>({ ...BLANK, ...initial });
  const [parse, setParse] = useState<{ busy: boolean; msg?: string; bad?: boolean }>({ busy: false });
  const [parsed, setParsed] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [consent, setConsent] = useState(!!consented);
  const summary = useRef<HTMLDivElement>(null);
  const errors = state?.errors ?? {};

  useEffect(() => { if (state?.error || state?.recoveryCode) summary.current?.focus(); }, [state]);
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  async function onResume(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setParse({ busy: true });
    try {
      const fd = new FormData();
      fd.set("resume", f);
      const res = await fetch("/api/resume/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) return setParse({ busy: false, bad: true, msg: data.error });
      const p = data.parsed as Found & { firstName?: string; lastName?: string; email?: string };
      setParsed(JSON.stringify(data.parsed));
      setFound(p);
      // Fill only what the student has not typed already.
      setValues((v) => ({ ...v, firstName: v.firstName || p.firstName || "", lastName: v.lastName || p.lastName || "", email: v.email || p.email || "", links: v.links || (data.links ?? []).join("\n") }));
      setParse({ busy: false, msg: "Resume read." });
    } catch {
      setParse({ busy: false, bad: true, msg: "Could not read that file right now. You can still continue." });
    }
  }

  if (state?.recoveryCode) {
    return (
      <div ref={summary} tabIndex={-1} className="card card-pad outline-none">
        {state.placed && (
          <div className="mb-5" role="status">
            <p className="eyebrow">Your line</p>
            <p className="mt-1 font-display text-2xl font-bold uppercase italic leading-none">You are in {state.placed.recruiterName}&apos;s line</p>
            <p className="mt-2 text-[0.9375rem] font-semibold text-ink-2">{state.placed.reason}</p>
          </div>
        )}
        <h2 className="text-xl">Save your recovery code</h2>
        <p className="mt-1 text-sm font-semibold text-ink-2">It opens your profile on another device. Shown once.</p>
        <p className="mt-3 select-all bg-raised px-4 py-4 text-center font-mono text-2xl font-bold tracking-[0.12em]" aria-label={`Recovery code ${state.recoveryCode.split("").join(" ")}`}>{state.recoveryCode}</p>
        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
          <Link href={state.next ?? "/line"} className="btn btn-primary !min-h-12">I saved it, continue</Link>
          <button type="button" className="btn !min-h-12" onClick={() => navigator.clipboard?.writeText(state.recoveryCode!)}>Copy</button>
        </div>
      </div>
    );
  }

  if (mode === "create" && existing) {
    return (
      <div className="card card-pad">
        <h2 className="text-xl">You already have a profile</h2>
        <div className="mt-4 flex flex-wrap gap-2"><Link href={next ?? "/line"} className="btn btn-primary">Continue</Link><Link href="/me" className="btn">My profile</Link></div>
      </div>
    );
  }

  const input = (k: keyof Values, label: string, o: { required?: boolean; type?: string; autoComplete?: string; placeholder?: string; inputMode?: "text" | "email" } = {}) => (
    <div className="field">
      <label htmlFor={k} className="label">{label}</label>
      <input id={k} name={k} type={o.type ?? "text"} inputMode={o.inputMode} required={o.required} autoComplete={o.autoComplete} placeholder={o.placeholder} value={values[k]} onChange={set(k)} className="input" aria-invalid={errors[k] ? true : undefined} aria-describedby={errors[k] ? `${k}-error` : undefined} />
      {errors[k] && <p id={`${k}-error`} className="error-text">{errors[k]}</p>}
    </div>
  );
  const got = found ? [found.major, found.university, found.graduationDate, ...(found.skills ?? []).slice(0, 5)].filter(Boolean) : [];

  return (
    <form noValidate className="grid gap-4" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }}>
      {next && <input type="hidden" name="next" value={next} />}
      <input type="hidden" name="parsed" value={parsed} />

      {state?.error && (
        <div ref={summary} tabIndex={-1} role="alert" className="notice outline-none" data-tone="bad">
          <div><p>{state.error}</p><ul className="mt-1 list-disc pl-5 text-sm">{Object.entries(errors).map(([k, msg]) => <li key={k}><a className="underline" href={`#${k}`}>{msg}</a></li>)}</ul></div>
        </div>
      )}

      <section className="card card-pad grid gap-4" aria-labelledby="sec-files">
        <h2 id="sec-files">Upload</h2>
        <div className="field">
          <label htmlFor="resume" className="label">Resume</label>
          <input id="resume" name="resume" type="file" accept=".pdf,.docx,.txt" onChange={onResume} className="input" aria-invalid={errors.resume ? true : undefined} aria-describedby="resume-status" />
          <div id="resume-status" role="status" aria-live="polite" className="min-h-5 text-sm font-semibold">
            {parse.busy && <span className="inline-flex items-center gap-2 text-muted"><span className="spinner" />Reading your resume…</span>}
            {!parse.busy && parse.msg && <span className={parse.bad ? "error-text" : "text-ok"}>{parse.msg}</span>}
            {!parse.busy && !parse.msg && hasResume && <span className="text-muted">On file: {hasResume}</span>}
          </div>
          {got.length > 0 && <p className="flex flex-wrap gap-1.5" aria-label="Read from your resume">{got.map((g) => <span key={g} className="tag">{g}</span>)}</p>}
          {errors.resume && <p id="resume-error" className="error-text">{errors.resume}</p>}
        </div>
        <div className="field">
          <label htmlFor="files" className="label">Other files <span className="font-normal text-muted">(optional)</span></label>
          <input id="files" name="files" type="file" multiple accept=".pdf,.docx,.txt" className="input" aria-invalid={errors.files ? true : undefined} aria-describedby="files-hint" />
          <p id="files-hint" className="hint">{hasFiles?.length ? `On file: ${hasFiles.join(", ")}. ` : ""}Transcript, certificates, project write-ups. Up to 3.</p>
          {errors.files && <p id="files-error" className="error-text">{errors.files}</p>}
        </div>
      </section>

      <section className="card card-pad grid gap-4" aria-labelledby="sec-you">
        <h2 id="sec-you">You</h2>
        <div className="grid grid-cols-2 gap-3">
          {input("firstName", "First name", { required: true, autoComplete: "given-name" })}
          {input("lastName", "Last name", { required: true, autoComplete: "family-name" })}
        </div>
        {input("email", "Email", { required: true, type: "email", inputMode: "email", autoComplete: "email" })}
        {input("desiredFunction", "What do you want to talk about?", { placeholder: "Software internship, routing" })}
        <div className="field">
          <label htmlFor="links" className="label">Links <span className="font-normal text-muted">(optional)</span></label>
          <textarea id="links" name="links" rows={2} value={values.links} onChange={set("links")} placeholder="github.com/you" className="input !min-h-[4.5rem]" />
          <label className="mt-1 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="consent" className="check" checked={consent} onChange={(e) => setConsent(e.target.checked)} />Read these pages to back up my resume</label>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary !min-h-14 flex-1 !text-base" disabled={pending || parse.busy} aria-busy={pending}>{pending && <span className="spinner" />}{mode === "create" ? "Create my profile" : "Save changes"}</button>
        {mode === "edit" && <Link href="/me" className="btn btn-quiet">Cancel</Link>}
      </div>
    </form>
  );
}
