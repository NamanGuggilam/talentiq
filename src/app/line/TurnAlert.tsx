"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** When a recruiter calls this student: buzz the phone, announce it, and open Tap, already armed. */
export function TurnAlert({ called }: { called: string[] }) {
  const router = useRouter();
  const seen = useRef<string[] | null>(null);
  const key = called.join("|");
  useEffect(() => {
    const names = key ? key.split("|") : [];
    // Only a call that arrives while this page is open moves the student on; one that was already there does not.
    const fresh = seen.current !== null && names.some((n) => !seen.current!.includes(n));
    seen.current = names;
    if (fresh) { navigator.vibrate?.([120, 80, 120, 80, 240]); router.push("/tap"); }
  }, [key, router]);
  return <p role="alert" className={called.length ? "notice mb-3" : "sr-only"} data-tone="ok">{called.length ? `${called.join(" and ")} ${called.length === 1 ? "is" : "are"} ready for you now.` : ""}</p>;
}
