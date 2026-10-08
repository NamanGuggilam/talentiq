"use client";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { createCandidate, updateProfile, type ProfileState } from "@/app/actions/candidate";
import { WORK_AUTH_OPTIONS } from "@/lib/profile-options";

type Values = Record<string, string>;
const BLANK: Values = { firstName: "", lastName: "", preferredName: "", email: "", phone: "", university: "", degreeProgram: "", major: "", graduationDate: "", gpa: "", workAuthorization: "", desiredFunction: "", technicalInterests: "", preferredLocations: "", skills: "", coursework: "", projects: "", github: "", devpost: "", credly: "", site: "" };

function Section({ n, title, children, note }: { n: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="card card-pad" aria-labelledby={`sec-${n}`}>
      <h2 id={`sec-${n}`} className="flex items-baseline gap-3 text-xl font-semibold">
        <span className="eyebrow rounded-sm bg-accent px-1.5 py-0.5 !text-accent-ink">{n}</span>
        {title}
      </h2>
      {note && <p className="hint mt-1">{note}</p>}
      <div className="mt-4 grid gap-4">{children}</div>
    </section>
  );
}

export function ProfileForm({ mode, initial, next, hasResume, consented, existing }: { mode: "create" | "edit"; initial?: Values; next?: string; hasResume?: string; consented?: boolean; existing?: boolean }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(mode === "create" ? createCandidate : updateProfile, null);
  const [values, setValues] = useState<Values>({ ...BLANK, ...initial });
  const [parse, setParse] = useState<{ busy: boolean; msg?: string; bad?: boolean }>({ busy: false });
  const [consent, setConsent] = useState(!!consented);
  const summary = useRef<HTMLDivElement>(null);
  const errors = state?.errors ?? {};

  useEffect(() => {
    if (state?.error || state?.recoveryCode) summary.current?.focus();
  }, [state]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setParse({ busy: true });
    try {
      const fd = new FormData();
      fd.set("resume", f);
      const res = await fetch("/api/resume/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) return setParse({ busy: false, bad: true, msg: data.error });
      const p = data.parsed as Record<string, string | string[]>;
      // Only fill fields the student has not typed in already.
      setValues((v) => {
        const out = { ...v };
        for (const k of ["firstName", "lastName", "email", "phone", "university", "degreeProgram", "major", "graduationDate", "gpa"]) if (!out[k] && typeof p[k] === "string") out[k] = p[k] as string;
        if (!out.skills && Array.isArray(p.skills)) out.skills = p.skills.join(", ");
        if (!out.coursework && Array.isArray(p.coursework)) out.coursework = p.coursework.join(", ");
        if (!out.projects && Array.isArray(p.projects)) out.projects = p.projects.join("\n");
        return out;
      });
      setParse({ busy: false, msg: "Resume read. Check the details below and fix anything we got wrong." });
    } catch {
      setParse({ busy: false, bad: true, msg: "We could not read that file right now. You can still fill in the form by hand." });
    }
  }

  if (state?.recoveryCode) {
    return (
      <div ref={summary} tabIndex={-1} className="card card-pad rise mx-auto max-w-xl outline-none">
        <p className="eyebrow">Profile saved</p>
        <h2 className="mt-2 text-2xl font-bold">Save your recovery code</h2>
        <p className="mt-2 text-ink-2">This phone will remember you for 30 days. To open your profile on another device you need this code. We show it once and cannot recover it for you.</p>
        <p className="mt-5 select-all rounded-md border border-line-strong bg-raised px-4 py-5 text-center font-mono text-2xl font-semibold tracking-[0.12em]" aria-label={`Recovery code ${state.recoveryCode.split("").join(" ")}`}>{state.recoveryCode}</p>
        {state.placed && (
          <div className="mt-5 rounded-[var(--radius-md)] bg-raised p-4" role="status">
            <p className="eyebrow">Your line</p>
            <p className="mt-1 text-lg font-semibold">You are in {state.placed.recruiterName}&apos;s line</p>
            <p className="mt-1 text-[0.9375rem] text-ink-2">{state.placed.reason} You can leave or pick a different recruiter on the next screen.</p>
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={() => navigator.clipboard?.writeText(state.recoveryCode!)}>Copy code</button>
          <Link href={state.next ?? "/me"} className="btn btn-primary">I saved it, continue</Link>
        </div>
      </div>
    );
  }

  if (mode === "create" && existing) {
    return (
      <div className="card card-pad mx-auto max-w-xl">
        <p className="eyebrow">Already signed in</p>
        <h2 className="mt-2 text-2xl font-bold">You already have a profile on this device</h2>
        <p className="mt-2 text-ink-2">Open it to make changes, or carry on to where you were going.</p>
        <div className="mt-5 flex flex-wrap gap-2"><Link href={next ?? "/me"} className="btn btn-primary">Continue</Link><Link href="/me" className="btn">My profile</Link></div>
      </div>
    );
  }

  const input = (k: string, label: string, opts: { required?: boolean; type?: string; hint?: string; autoComplete?: string; wide?: boolean; placeholder?: string; inputMode?: "text" | "email" | "tel" | "decimal" | "url" } = {}) => (
    <div className={`field ${opts.wide ? "" : ""}`}>
      <label htmlFor={k} className="label">{label}{opts.required && <span className="ml-1 font-normal text-muted">(required)</span>}</label>
      <input id={k} name={k} type={opts.type ?? "text"} inputMode={opts.inputMode} required={opts.required} autoComplete={opts.autoComplete} placeholder={opts.placeholder} value={values[k]} onChange={set(k)} className="input"
        aria-invalid={errors[k as keyof typeof errors] ? true : undefined} aria-describedby={[opts.hint && `${k}-hint`, errors[k as keyof typeof errors] && `${k}-error`].filter(Boolean).join(" ") || undefined} />
      {opts.hint && <p id={`${k}-hint`} className="hint">{opts.hint}</p>}
      {errors[k as keyof typeof errors] && <p id={`${k}-error`} className="error-text">{errors[k as keyof typeof errors]}</p>}
    </div>
  );

  const errorList = Object.entries(errors);
  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      {next && <input type="hidden" name="next" value={next} />}

      {state?.error && (
        <div ref={summary} tabIndex={-1} role="alert" className="notice outline-none" data-tone="bad">
          <div>
            <p className="font-semibold">{state.error}</p>
            {errorList.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-sm">
                {errorList.map(([k, msg]) => <li key={k}><a className="underline" href={`#${k}`}>{msg}</a></li>)}
              </ul>
            )}
          </div>
        </div>
      )}

      <Section n="01" title="Resume" note="Upload it and we fill in the rest of the form for you to check.">
        <div className="field">
          <label htmlFor="resume" className="label">Resume file <span className="font-normal text-muted">(PDF, DOCX or TXT, up to 4 MB)</span></label>
          <input id="resume" name="resume" type="file" accept=".pdf,.docx,.txt" onChange={onFile} className="input" aria-invalid={errors.resume ? true : undefined} aria-describedby="resume-status" />
          <div id="resume-status" role="status" aria-live="polite" className="min-h-5 text-sm">
            {parse.busy && <span className="inline-flex items-center gap-2 text-muted"><span className="spinner" />Reading your resume…</span>}
            {!parse.busy && parse.msg && <span className={parse.bad ? "error-text" : "font-medium text-ok"}>{parse.msg}</span>}
            {!parse.busy && !parse.msg && hasResume && <span className="text-muted">On file: {hasResume}. Choose a file only if you want to replace it.</span>}
          </div>
          {errors.resume && <p id="resume-error" className="error-text">{errors.resume}</p>}
        </div>
      </Section>

      <Section n="02" title="About you">
        {input("firstName", "First name", { required: true, autoComplete: "given-name" })}
        {input("lastName", "Last name", { required: true, autoComplete: "family-name" })}
        {input("preferredName", "Preferred name", { hint: "What should recruiters call you?" })}
        {input("email", "Email address", { required: true, type: "email", inputMode: "email", autoComplete: "email" })}
        {input("phone", "Phone number", { type: "tel", inputMode: "tel", autoComplete: "tel" })}
        {input("university", "University", { autoComplete: "organization" })}
        {input("degreeProgram", "Degree", { placeholder: "B.S." })}
        {input("major", "Major")}
        {input("graduationDate", "Graduation date", { placeholder: "May 2027" })}
        {input("gpa", "GPA", { inputMode: "decimal", hint: "Optional. Leave blank if you prefer." })}
      </Section>

      <Section n="03" title="What you are looking for">
        {input("desiredFunction", "Internship or job function", { placeholder: "Software engineering intern", wide: true })}
        {input("technicalInterests", "Areas of technical interest", { hint: "Separate with commas.", placeholder: "Routing, data pipelines" })}
        {input("preferredLocations", "Preferred work locations", { hint: "Separate with commas.", placeholder: "Lowell AR, Dallas TX" })}
        <div className="field">
          <label htmlFor="workAuthorization" className="label">Work authorization <span className="font-normal text-muted">(optional)</span></label>
          <select id="workAuthorization" name="workAuthorization" value={values.workAuthorization} onChange={set("workAuthorization")} className="input">
            <option value="">Not provided</option>
            {WORK_AUTH_OPTIONS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
      </Section>

      <Section n="04" title="Skills and work">
        {input("skills", "Skills", { hint: "Separate with commas.", wide: true })}
        {input("coursework", "Relevant coursework", { hint: "Separate with commas.", wide: true })}
        <div className="field">
          <label htmlFor="projects" className="label">Projects and experience</label>
          <textarea id="projects" name="projects" rows={4} value={values.projects} onChange={set("projects")} className="input" aria-describedby="projects-hint" />
          <p id="projects-hint" className="hint">One per line.</p>
        </div>
      </Section>

      <Section n="05" title="Links to your work" note="Optional. If you add links, TalentIQ reads those pages, and only those pages, to back up what your resume says.">
        {input("github", "GitHub", { placeholder: "github.com/your-username", inputMode: "url" })}
        {input("site", "Portfolio site", { placeholder: "https://your-site.dev", inputMode: "url" })}
        {input("devpost", "Devpost", { placeholder: "devpost.com/your-username", inputMode: "url" })}
        {input("credly", "Credly", { placeholder: "credly.com/users/your-name", inputMode: "url" })}
        <div className="">
          <label className="flex items-start gap-3 rounded-md border border-line-strong bg-raised p-3">
            <input id="consent" type="checkbox" name="consent" className="check mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-describedby={errors.consent ? "consent-error" : undefined} />
            <span className="text-sm leading-6"><span className="font-semibold">Read the links I entered.</span> TalentIQ may open these public pages to check them against my resume. It will not search the web for me or read anything I did not list here. I can turn this off later.</span>
          </label>
          {errors.consent && <p id="consent-error" className="error-text mt-1.5">{errors.consent}</p>}
        </div>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={pending || parse.busy} aria-busy={pending}>
          {pending && <span className="spinner" />}
          {mode === "create" ? "Create my profile" : "Save changes"}
        </button>
        {mode === "edit" && <Link href="/me" className="btn btn-quiet">Cancel</Link>}
        <p className="hint">Recruiters see your profile only after you choose to share it.</p>
      </div>
    </form>
  );
}
