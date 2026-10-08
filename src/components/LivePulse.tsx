"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Watches for new connections and refreshes the list when one arrives, announcing it to screen readers. */
export function LivePulse({ initialCount, initialLine }: { initialCount: number; initialLine?: string }) {
  const router = useRouter();
  const count = useRef(initialCount);
  // What the server rendered, so a change that lands before the first poll is still noticed.
  const line = useRef<string | null>(initialLine ?? null);
  const [message, setMessage] = useState("");
  const [live, setLive] = useState(true);

  useEffect(() => { count.current = Math.max(count.current, initialCount); }, [initialCount]);
  useEffect(() => {
    let stopped = false;
    async function tick() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/pulse", { cache: "no-store" });
        if (res.status === 401) return router.refresh();
        const data = await res.json();
        if (stopped) return;
        setLive(true);
        // The virtual line changed (someone joined, left or was called): refresh quietly.
        if (line.current !== null && data.line !== line.current) router.refresh();
        line.current = data.line ?? "";
        if (data.count > count.current) {
          const n = data.count - count.current;
          count.current = data.count;
          setMessage(n === 1 && data.latestName ? `${data.latestName} just connected.` : `${n} new people connected.`);
          router.refresh();
        }
      } catch { if (!stopped) setLive(false); }
    }
    const id = setInterval(tick, 3500);
    return () => { stopped = true; clearInterval(id); };
  }, [router]);

  return (
    <span className="inline-flex items-center gap-2">
      <span className="pill" data-tone={live ? "ok" : "warn"}>{live ? "Live" : "Reconnecting"}</span>
      <span role="status" aria-live="polite" className="text-sm font-medium text-ok">{message}</span>
    </span>
  );
}
