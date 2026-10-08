"use client";
import { useEffect, useRef } from "react";

type MotionCtor = { requestPermission?: () => Promise<"granted" | "denied"> };
const ctor = () => (window as unknown as { DeviceMotionEvent?: MotionCtor }).DeviceMotionEvent;

/** iPhones ask before a page may read motion. Other phones do not. */
export const motionNeedsPermission = () => typeof ctor()?.requestPermission === "function";

/**
 * Asks for motion access. On an iPhone the first call must come from a button press; once granted, later
 * calls on this site resolve straight away, so it is safe to call again when a screen opens.
 */
export async function requestMotion(): Promise<boolean> {
  const c = ctor();
  if (!c) return false;
  if (typeof c.requestPermission !== "function") return true;
  try { return (await c.requestPermission()) === "granted"; } catch { return false; }
}

/**
 * Calls `onBump` when the phone is knocked against something: a sharp change in acceleration between two readings.
 * Walking and turning the phone over stay under the threshold; a light phone-to-phone tap goes over it.
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
        if (jolt > 6) { quietUntil = now + 1800; cb.current(); }
      }
      last = { x: a.x, y: a.y, z: a.z };
    }
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [active]);
}

/** Runs once when a tap screen opens: true if the bump can be felt already, false if the phone still has to be asked. */
export function useMotionReady(enabled: boolean, onResult: (ok: boolean) => void) {
  const done = useRef(false);
  useEffect(() => {
    if (!enabled || done.current) return;
    done.current = true;
    void requestMotion().then(onResult);
  }, [enabled, onResult]);
}
