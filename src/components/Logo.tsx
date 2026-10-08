/**
 * The TalentIQ mark: a ring with two tails and two pink ties. It reads as a Q, and as twin tails.
 * On load the ring draws, the ties land and the tails fall. `tone="light"` is for use on the teal band.
 */
export function Mark({ size = 28, tone = "brand", className = "" }: { size?: number; tone?: "brand" | "light"; className?: string }) {
  const c = tone === "light" ? "#ffffff" : "#39c5bb";
  return (
    <svg className={`mark ${className}`} width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      <path className="m-tail" d="M16 27C8 36 11 48 6 60" stroke={c} strokeWidth="6" strokeLinecap="round" />
      <path className="m-tail" d="M48 27c8 9 5 21 10 33" stroke={c} strokeWidth="6" strokeLinecap="round" />
      <circle className="m-ring" cx="32" cy="24" r="14" stroke={c} strokeWidth="7" />
      <rect className="m-tie l" x="13" y="18" width="8" height="8" fill="#e12885" transform="rotate(20 17 22)" />
      <rect className="m-tie r" x="43" y="18" width="8" height="8" fill="#e12885" transform="rotate(-20 47 22)" />
    </svg>
  );
}

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-ink">
      <Mark size={size} />
      <span className="font-display font-bold italic uppercase tracking-tight" style={{ fontSize: size * 0.72, lineHeight: 1 }}>Talent<span className="text-pink-deep">IQ</span></span>
    </span>
  );
}

/** Two long ribbons that hang in the corner of a page band and sway slightly. Decoration only. */
export function Ribbons({ className = "" }: { className?: string }) {
  return (
    <svg className={`ribbons ${className}`} viewBox="0 0 140 200" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M52 -4C14 58 86 112 34 204h26C112 112 46 58 82 -4Z" fill="#0a6a6d" opacity="0.5" />
      <path d="M98 -4C70 50 128 104 92 204h20C150 104 96 50 122 -4Z" fill="#e12885" />
    </svg>
  );
}

/** Animated sound bars. */
export function Eq({ className = "" }: { className?: string }) {
  return <span className={`eq ${className}`} aria-hidden="true"><i /><i /><i /><i /><i /></span>;
}
