"use client";
import Link from "next/link";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { connect, type ConnectState } from "@/app/actions/candidate";
import { TapStage } from "@/components/TapStage";
import { requestMotion, useBump, useMotionReady } from "@/lib/useBump";

type Match = { id: string; token: string; name: string; title: string | null; company: string | null };
type Phase = "idle" | "armed" | "searching" | "matched" | "none";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One matched recruiter. With `auto`, the profile is sent after a two second pause, so a tap feels like a tap;
 * Cancel stops it. With several matches the student chooses, and nothing is sent until they do.
 */
function ShareCard({ match, auto, onShared, onCancel }: { match: Match; auto: boolean; onShared: (m: Match) => void; onCancel: () => void }) {
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ConnectState, FormData>(async (prev, fd) => {
    const res = await connect(prev, fd);
    if (res?.ok) onShared(match);
    return res;
  }, null);
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => form.current?.requestSubmit(), 2000);
    return () => clearTimeout(t);
  }, [auto]);
  return (
    <form ref={form} action={action} className="card p-4">
      <input type="hidden" name="token" value={match.token} />
      <input type="hidden" name="method" value="tap" />
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 flex-none place-items-center rounded-full bg-accent text-lg font-bold text-accent-ink" aria-hidden="true">{match.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
        <div className="min-w-0"><p className="truncate text-lg font-semibold">{match.name}</p><p className="truncate text-sm text-muted">{[match.title, match.company].filter(Boolean).join(" · ")}</p></div>
      </div>
      {state?.error && <p role="alert" className="notice mt-3" data-tone="bad">{state.error}</p>}
      {auto && !state?.error ? (
        <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-2">
          <p role="status" className="flex items-center gap-2 font-display text-lg font-bold uppercase italic"><span className="spinner" />Sending to {match.name.split(" ")[0]}…</p>
          {!pending && <button type="button" className="btn btn-sm" onClick={onCancel}>Cancel</button>}
        </div>
      ) : (
        <button className="btn btn-primary mt-4 w-full !min-h-12" disabled={pending} aria-busy={pending}>{pending && <span className="spinner" />}Send to {match.name.split(" ")[0]}</button>
      )}
    </form>
  );
}

export function TapShare({ resumeName, linkCount, calledBy }: { resumeName: string | null; linkCount: number; calledBy?: string }) {
  // When a recruiter has just called this student, tap starts ready with no extra step.
  const [phase, setPhase] = useState<Phase>(calledBy ? "armed" : "idle");
  const [motion, setMotion] = useState(true);
  const [auto, setAuto] = useState(true);
  // Opened already armed (the recruiter just called): check whether this phone can feel a bump yet.
  useMotionReady(!!calledBy, setMotion);
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
      if (data.matches?.length) { setMatches(data.matches); setAuto(data.matches.length === 1); setPhase("matched"); navigator.vibrate?.([20, 40, 60]); }
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
          {phase === "idle" && "Tap your phone on the recruiter's."}
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
        {phase !== "idle" && phase !== "matched" && !motion && <button type="button" className="btn btn-primary mt-2 w-full !min-h-12" onClick={async () => setMotion(await requestMotion())}>Turn on tap</button>}
        {phase !== "idle" && phase !== "matched" && <p className="hint mt-2">{motion ? "Knock the two phones together. No luck? Both press Tap now." : "Allow motion so this phone can feel the tap, or both press Tap now."}</p>}
      </div>

      {phase === "matched" && matches.map((m) => <ShareCard key={m.token} match={m} auto={auto && matches.length === 1} onShared={setShared} onCancel={() => setAuto(false)} />)}
      {phase === "matched" && <button type="button" className="btn btn-quiet" onClick={() => { setMatches([]); setPhase("armed"); }}>Not them, try again</button>}

      
    </div>
  );
}
