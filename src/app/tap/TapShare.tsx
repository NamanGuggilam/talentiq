"use client";
import Link from "next/link";
import { useActionState, useCallback, useRef, useState } from "react";
import { connect, type ConnectState } from "@/app/actions/candidate";
import { TapStage } from "@/components/TapStage";
import { requestMotion, useBump } from "@/lib/useBump";

type Match = { id: string; token: string; name: string; title: string | null; company: string | null };
type Phase = "idle" | "armed" | "searching" | "matched" | "none";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ShareCard({ match, onShared }: { match: Match; onShared: (m: Match) => void }) {
  const [state, action, pending] = useActionState<ConnectState, FormData>(async (prev, fd) => {
    const res = await connect(prev, fd);
    if (res?.ok) onShared(match);
    return res;
  }, null);
  return (
    <form action={action} className="card p-4">
      <input type="hidden" name="token" value={match.token} />
      <input type="hidden" name="method" value="tap" />
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 flex-none place-items-center rounded-full bg-accent text-lg font-bold text-accent-ink" aria-hidden="true">{match.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
        <div className="min-w-0"><p className="truncate text-lg font-semibold">{match.name}</p><p className="truncate text-sm text-muted">{[match.title, match.company].filter(Boolean).join(" · ")}</p></div>
      </div>
      {state?.error && <p role="alert" className="notice mt-3" data-tone="bad">{state.error}</p>}
      <button className="btn btn-primary mt-4 w-full !min-h-12" disabled={pending} aria-busy={pending}>{pending && <span className="spinner" />}Share my profile with {match.name.split(" ")[0]}</button>
    </form>
  );
}

export function TapShare({ resumeName, linkCount, calledBy }: { resumeName: string | null; linkCount: number; calledBy?: string }) {
  // When a recruiter has just called this student, tap starts ready with no extra step.
  const [phase, setPhase] = useState<Phase>(calledBy ? "armed" : "idle");
  const [motion, setMotion] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);
  const [shared, setShared] = useState<Match | null>(null);
  const busy = useRef(false);

  const fire = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setPhase("searching");
    navigator.vibrate?.(30);
    try {
      const res = await fetch("/api/tap", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ as: "candidate" }) });
      let data = await res.json();
      // The recruiter's tap may reach the server a moment after ours, so look again a few times.
      for (let i = 0; res.ok && !data.matches?.length && i < 6; i++) {
        await sleep(600);
        data = await (await fetch(`/api/tap?id=${data.id}`, { cache: "no-store" })).json().then((d) => ({ ...d, id: data.id }));
      }
      if (data.matches?.length) { setMatches(data.matches); setPhase("matched"); navigator.vibrate?.([20, 40, 60]); }
      else setPhase("none");
    } catch { setPhase("none"); }
    busy.current = false;
  }, []);

  useBump(phase === "armed" || phase === "none", fire);

  if (shared) {
    return (
      <div className="card p-6 text-center" role="status">
        <div className="relative mx-auto h-24 w-24">
          <span className="burst" /><span className="burst" /><span className="burst" />
          <svg className="relative" width="96" height="96" viewBox="0 0 56 56" fill="none" aria-hidden="true">
            <circle cx="28" cy="28" r="24" fill="#39c5bb" style={{ transformOrigin: "center", animation: "pop 560ms var(--ease-spring) both" }} />
            <path d="M18 29l7 7 14-16" stroke="#052f31" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 40, strokeDashoffset: 40, animation: "draw 420ms var(--ease-out-expo) 320ms forwards" }} />
          </svg>
        </div>
        <h2 className="mt-4 text-2xl font-bold">Sent to {shared.name}</h2>
        <dl className="mt-4 grid gap-3 text-left">
          <div className="rounded-[var(--radius-md)] bg-raised p-3"><dt className="eyebrow">You sent</dt><dd className="mt-1 text-[0.9375rem]">Your profile{resumeName ? `, your resume (${resumeName})` : ""}{linkCount ? ` and ${linkCount} ${linkCount === 1 ? "link" : "links"}` : ""}</dd></div>
          <div className="rounded-[var(--radius-md)] bg-raised p-3"><dt className="eyebrow">You received</dt><dd className="mt-1 text-[0.9375rem]">{shared.name}&apos;s contact card</dd></div>
        </dl>
        <div className="mt-5 grid gap-2">
          <a href={`/api/contact/${shared.id}`} className="btn btn-primary" download>Save {shared.name.split(" ")[0]}&apos;s contact</a>
          <Link href="/me" className="btn">Done</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="card p-5 text-center">
        <TapStage live={phase !== "idle" && phase !== "matched"} />
        <p role="status" aria-live="polite" className="min-h-12 text-[1.0625rem] font-semibold">
          {phase === "idle" && "Bring your phone to the recruiter's and tap them together."}
          {phase === "armed" && (calledBy ? `${calledBy} is ready for you. Tap your phone against theirs.` : "Ready. Tap your phone against the recruiter's.")}
          {phase === "searching" && "Looking for the other phone…"}
          {phase === "matched" && (matches.length > 1 ? "More than one recruiter tapped just now. Pick yours." : "Found them.")}
          {phase === "none" && "No recruiter phone answered. Ask them to open Receive by tap, then try again."}
        </p>
        {phase === "idle" ? (
          <button type="button" className="btn btn-primary mt-3 w-full !min-h-12" onClick={async () => { setMotion(await requestMotion()); setPhase("armed"); }}>Get ready</button>
        ) : phase !== "matched" && (
          <button type="button" className="btn mt-3 w-full !min-h-12" disabled={phase === "searching"} onClick={async () => { void requestMotion().then(setMotion); await fire(); }}>{phase === "searching" && <span className="spinner" />}Tap now</button>
        )}
        {phase !== "idle" && phase !== "matched" && <p className="hint mt-2">{motion ? "If the bump is not picked up, both of you can press Tap now at the same moment." : "This phone did not allow motion sensing. Both of you press Tap now at the same moment."}</p>}
      </div>

      {phase === "matched" && matches.map((m) => <ShareCard key={m.token} match={m} onShared={setShared} />)}
      {phase === "matched" && <button type="button" className="btn btn-quiet" onClick={() => { setMatches([]); setPhase("armed"); }}>Not them, try again</button>}

      <p className="hint text-center">Nothing is sent until you press Share. You can also scan the QR code on a recruiter&apos;s badge.</p>
    </div>
  );
}
