"use client";
import Link from "next/link";
import { useActionState } from "react";
import { connect, type ConnectState } from "@/app/actions/candidate";

export function ConnectForm({ token, method, already, recruiterName, myName, children }: { token: string; method: "qr" | "nfc" | "tap"; already: boolean; recruiterName: string; myName: string; children: React.ReactNode }) {
  const [state, action, pending] = useActionState<ConnectState, FormData>(connect, null);
  const done = already || state?.ok;

  if (done) {
    return (
      <div role="status">
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
          <circle cx="28" cy="28" r="26" fill="var(--accent)" stroke="var(--ink)" strokeWidth="2" style={{ transformOrigin: "center", animation: "pop 520ms var(--ease-spring) both" }} />
          <path d="M17 29l8 8 15-17" stroke="var(--accent-ink)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 40, strokeDashoffset: 40, animation: "draw 420ms var(--ease-out-expo) 320ms forwards" }} />
        </svg>
        <p className="eyebrow mt-4">Shared</p>
        <h1 className="mt-2 text-2xl font-bold">{recruiterName} has your profile</h1>
        <p className="mb-4 mt-2 text-ink-2">You are in their list now. You can put your phone away and talk.</p>
        {children}
        <Link href="/me" className="btn mt-5 w-full">See who has my profile</Link>
      </div>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="method" value={method} />
      <p className="eyebrow">Share your profile</p>
      <h1 className="mt-2 text-2xl font-bold">Share with this recruiter?</h1>
      <p className="mb-4 mt-2 text-ink-2">Signed in as <span className="font-semibold text-ink">{myName}</span>. They will see your profile, resume and the links you added. Nothing is shared until you press Share.</p>
      {children}
      {state?.error && <p role="alert" className="notice mt-4" data-tone="bad">{state.error}</p>}
      <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
        <button className="btn btn-primary !min-h-12 !text-base" disabled={pending} aria-busy={pending}>{pending && <span className="spinner" />}Share my profile</button>
        <Link href="/me" className="btn !min-h-12">Cancel</Link>
      </div>
    </form>
  );
}
