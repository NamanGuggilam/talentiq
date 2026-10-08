"use client";
import { useActionState } from "react";
import { changePassword, type FormState } from "@/app/actions/auth";

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, null);
  return (
    <form action={action} className="grid gap-4">
      {state?.error && <p role="alert" className="notice" data-tone="bad">{state.error}</p>}
      {state?.ok && <p role="status" className="notice" data-tone="ok">{state.ok}</p>}
      <div className="field"><label htmlFor="current" className="label">Current password</label><input id="current" name="current" type="password" autoComplete="current-password" required className="input" /></div>
      <div className="field"><label htmlFor="next" className="label">New password</label><input id="next" name="next" type="password" autoComplete="new-password" minLength={12} required className="input" /></div>
      <div className="field"><label htmlFor="confirm" className="label">New password again</label><input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} required className="input" /></div>
      <div><button className="btn btn-ink" disabled={pending} aria-busy={pending}>{pending && <span className="spinner" />}Change password</button></div>
    </form>
  );
}
