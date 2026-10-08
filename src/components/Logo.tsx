/**
 * The TalentIQ mark is a Q: a ring (the conversation), a dot at its centre (the candidate) and a tail that leaves
 * the ring (the hand-off to a human decision). On load the ring draws, the dot lands and the tail extends.
 * `tone="light"` is for use on the teal brand colour.
 */
export function Mark({ size = 28, live = false, tone = "brand", className = "" }: { size?: number; live?: boolean; tone?: "brand" | "light"; className?: string }) {
  const ring = tone === "light" ? "#ffffff" : "#39c5bb";
  return (
    <svg className={`mark ${className}`} data-live={live ? "" : undefined} width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      <circle className="m-ripple" cx="30" cy="30" r="19" stroke="#e12885" strokeWidth="2" />
      <circle className="m-ring" cx="30" cy="30" r="19" stroke={ring} strokeWidth="8" transform="rotate(45 30 30)" />
      <path className="m-tail" d="M44 44 56 56" stroke={ring} strokeWidth="8" strokeLinecap="round" />
      <circle className="m-dot" cx="30" cy="30" r="6" fill="#e12885" />
      <g className="m-orbit"><circle cx="30" cy="11" r="3" fill="#e12885" /></g>
    </svg>
  );
}

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 text-ink">
      <Mark size={size} />
      <span className="font-display font-bold tracking-tight" style={{ fontSize: size * 0.7, lineHeight: 1 }}>TalentIQ</span>
    </span>
  );
}
