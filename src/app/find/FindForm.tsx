"use client";
import { useActionState } from "react";
import { findProfile, type FormState } from "@/app/actions/auth";

export function FindForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(findProfile, null);
  return (
    <form action={action} className="card card-pad grid gap-4">
      <input type="hidden" name="next" value={next} />
      {state?.error && <p role="alert" className="notice" data-tone="bad">{state.error}</p>}
      <div className="field">
        <label htmlFor="email" className="label">Email address</label>
        <input id="email" name="email" type="email" inputMode="email" autoComplete="email" required defaultValue={state?.fields?.email} className="input" />
      </div>
      <div className="field">
        <label htmlFor="lastName" className="label">Last name</label>
        <input id="lastName" name="lastName" autoComplete="family-name" required defaultValue={state?.fields?.lastName} className="input" />
      </div>
      <div className="field">
        <label htmlFor="code" className="label">Recovery code</label>
        <input id="code" name="code" required autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="XXXX-XXXX-XXXX" className="input font-mono uppercase tracking-widest" aria-describedby="code-hint" />
        <p id="code-hint" className="hint">Twelve letters and numbers. Dashes are optional.</p>
      </div>
      <button className="btn btn-primary" disabled={pending} aria-busy={pending}>{pending && <span className="spinner" />}Open my profile</button>
    </form>
  );
}
