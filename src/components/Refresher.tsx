"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-fetches the current page on an interval while the tab is visible. Used while background work finishes. */
export function Refresher({ every = 4000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, every);
    return () => clearInterval(id);
  }, [router, every]);
  return null;
}
