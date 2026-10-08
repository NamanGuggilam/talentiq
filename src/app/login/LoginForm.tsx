"use client";
import { useActionState } from "react";
import { login, type FormState } from "@/app/actions/auth";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(login, null);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      {state?.error && <p role="alert" className="notice" data-tone="bad">{state.error}</p>}
      <div className="field">
        <label htmlFor="email" className="label">Work email</label>
        <input id="email" name="email" type="email" inputMode="email" autoComplete="username" required defaultValue={state?.fields?.email} className="input" />
      </div>
      <div className="field">
        <label htmlFor="password" className="label">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      <button className="btn btn-primary" disabled={pending} aria-busy={pending}>{pending && <span className="spinner" />}Sign in</button>
    </form>
  );
}
