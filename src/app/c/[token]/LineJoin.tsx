"use client";
import Link from "next/link";
import { useActionState } from "react";
import { joinLine, type LineState } from "@/app/actions/candidate";

/** Joining the line is the main action after scanning a badge. */
export function LineJoin({ token, recruiterName, waiting, minutes, open, inLine }: { token: string; recruiterName: string; waiting: number; minutes: number; open: boolean; inLine: boolean }) {
  const [state, action, pending] = useActionState<LineState, FormData>(joinLine, null);
  const first = recruiterName.split(" ")[0];

  if (inLine || state?.ok) {
    return (
      <div role="status" className="text-center">
        <p className="text-lg font-semibold">You are in {first}&apos;s line.</p>
        <p className="mt-1 text-sm text-muted">Go and see other booths. We will tell you when it is your turn.</p>
        <Link href="/line" className="btn btn-primary mt-4 w-full !min-h-12">See my place in line</Link>
      </div>
    );
  }
  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-[var(--radius-md)] bg-raised p-3"><p className="text-3xl font-bold tabular-nums">{waiting}</p><p className="eyebrow">{waiting === 1 ? "person waiting" : "people waiting"}</p></div>
        <div className="rounded-[var(--radius-md)] bg-raised p-3"><p className="text-3xl font-bold tabular-nums">{minutes}<span className="text-lg font-semibold"> min</span></p><p className="eyebrow">estimated wait</p></div>
      </div>
      {state?.error && <p role="alert" className="notice mt-3" data-tone="bad">{state.error}</p>}
      <p className="hint mt-3 text-center">Joining lets {first} see your name now, and open your profile and resume when it is your turn.</p>
      {open ? (
        <button className="btn btn-primary mt-4 w-full !min-h-12 !text-base" disabled={pending} aria-busy={pending}>{pending && <span className="spinner" />}Join {first}&apos;s line</button>
      ) : (
        <p className="notice mt-4" data-tone="warn">{first} is not taking new people in line right now.</p>
      )}
    </form>
  );
}
