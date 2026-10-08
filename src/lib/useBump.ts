"use client";
import { useEffect, useRef } from "react";

type MotionCtor = { requestPermission?: () => Promise<"granted" | "denied"> };

/** iOS asks for motion access, and only in response to a tap on the page. Other browsers need nothing. */
export async function requestMotion(): Promise<boolean> {
  const ctor = (window as unknown as { DeviceMotionEvent?: MotionCtor }).DeviceMotionEvent;
  if (!ctor) return false;
  if (typeof ctor.requestPermission !== "function") return true;
  try { return (await ctor.requestPermission()) === "granted"; } catch { return false; }
}

/**
 * Calls `onBump` when the phone is knocked against something: a sharp jump in acceleration between two readings.
 * Gentle movement, such as walking or turning the phone over, stays under the threshold.
 */
export function useBump(active: boolean, onBump: () => void) {
  const cb = useRef(onBump);
  useEffect(() => { cb.current = onBump; }, [onBump]);
  useEffect(() => {
    if (!active) return;
    let last: { x: number; y: number; z: number } | null = null;
    let quietUntil = 0;
    function onMotion(e: DeviceMotionEvent) {
      const a = e.acceleration?.x != null ? e.acceleration : e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const now = performance.now();
      if (last && now > quietUntil) {
        const jolt = Math.hypot(a.x - last.x, a.y - last.y, a.z - last.z);
        if (jolt > 13) { quietUntil = now + 1800; cb.current(); }
      }
      last = { x: a.x, y: a.y, z: a.z };
    }
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [active]);
}
