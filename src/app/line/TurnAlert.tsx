"use client";
import { useEffect, useRef } from "react";

/**
 * When a recruiter calls this student: buzz the phone and announce it. The student stays on the "Go!" screen
 * and opens Tap themselves, so the screen never changes under their thumb.
 */
export function TurnAlert({ called }: { called: string[] }) {
  const seen = useRef<string[] | null>(null);
  const key = called.join("|");
  useEffect(() => {
    const names = key ? key.split("|") : [];
    if (seen.current !== null && names.some((n) => !seen.current!.includes(n))) navigator.vibrate?.([120, 80, 120, 80, 240]);
    seen.current = names;
  }, [key]);
  return <p role="alert" className={called.length ? "notice mb-3" : "sr-only"} data-tone="ok">{called.length ? `${called.join(" and ")} ${called.length === 1 ? "is" : "are"} ready for you now.` : ""}</p>;
}
