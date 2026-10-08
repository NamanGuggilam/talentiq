"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { TapStage } from "@/components/TapStage";
import { requestMotion, useBump, useMotionReady } from "@/lib/useBump";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Recruiter's half of tap to share. While ready, a bump (or the button) makes this phone discoverable for a few seconds.
 * With `auto` it starts ready, which is how it behaves the moment someone is called from the line, and it opens the
 * student's notes as soon as their profile arrives.
 */
export function TapReceiver({ initialCount, auto = false, bare = false, expecting }: { initialCount: number; auto?: boolean; bare?: boolean; expecting?: string }) {
  const router = useRouter();
  const [ready, setReady] = useState(auto);
  const [motion, setMotion] = useState(true);
  useMotionReady(auto, setMotion);
  const [status, setStatus] = useState("");
  const [received, setReceived] = useState<{ id: string; name: string } | null>(null);
  const count = useRef(initialCount);
  const busy = useRef(false);

  const fire = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    navigator.vibrate?.(30);
    setStatus(`Tap sent. Waiting for ${expecting ?? "the student"}\u2019s phone…`);
    try {
      const res = await fetch("/api/tap", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ as: "recruiter" }) });
      if (!res.ok) { setStatus((await res.json()).error ?? "Could not send the tap."); busy.current = false; return; }
      // The student still has to confirm, so watch for the new connection for a little while.
      let got = false;
      for (let i = 0; i < 22 && !got; i++) {
        await sleep(1000);
        const p = await (await fetch("/api/pulse", { cache: "no-store" })).json();
        if (p.count > count.current) {
          count.current = p.count; got = true;
          setReceived({ id: p.latestId, name: p.latestName }); setStatus(""); navigator.vibrate?.([20, 40, 60]);
          if (auto) router.push(`/recruiter/c/${p.latestId}`);
        }
      }
      if (!got) setStatus("No one confirmed. Tap again when the student is ready.");
    } catch { setStatus("Could not reach the server. Check your connection and tap again."); }
    busy.current = false;
  }, [auto, expecting, router]);

  useBump(ready, fire);

  const body = (
    <>
      <TapStage live={ready} />
      {received && (
        <div role="status" className="notice mb-3" data-tone="ok">
          <span>Received <span className="font-semibold">{received.name}</span>: profile and resume. <Link className="link" href={`/recruiter/c/${received.id}`}>Open</Link></span>
        </div>
      )}
      <p role="status" aria-live="polite" className="min-h-6 text-center text-[0.9375rem] font-semibold">{status || (ready ? (expecting ? `Ready. Tap phones with ${expecting}.` : "Ready to receive.") : "")}</p>
      {!ready ? (
        <button type="button" className="btn btn-primary mt-2 w-full !min-h-12" onClick={async () => { setMotion(await requestMotion()); setReady(true); }}>Get ready to receive</button>
      ) : (
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
          <button type="button" className="btn btn-primary !min-h-12" onClick={async () => { void requestMotion().then(setMotion); await fire(); }}>Tap now</button>
          {!auto && <button type="button" className="btn btn-quiet !min-h-12" onClick={() => { setReady(false); setStatus(""); }}>Stop</button>}
        </div>
      )}
      {ready && !motion && <button type="button" className="btn btn-primary mt-2 w-full !min-h-12" onClick={async () => setMotion(await requestMotion())}>Turn on tap</button>}
      {ready && <p className="hint mt-2 text-center">{motion ? "Knock the two phones together. No luck? Both press Tap now." : "Allow motion so this phone can feel the tap, or both press Tap now."}</p>}
    </>
  );
  if (bare) return body;
  return (
    <section className="card card-pad" aria-labelledby="tap-h">
      <h2 id="tap-h" className="text-xl font-semibold">Receive by tap</h2>
      
      {body}
    </section>
  );
}
