import { useId } from "react";

/**
 * The TalentIQ mark is a Q: a ring (the conversation), a dot at its centre (the candidate) and a tail that leaves
 * the ring (the hand-off to a human decision). On load the ring draws, the dot lands and the tail extends.
 * On hover, or when `live`, a signal orbits the ring and a tap ripple spreads from the dot.
 */
export function Mark({ size = 28, live = false, className = "" }: { size?: number; live?: boolean; className?: string }) {
  const id = useId();
  return (
    <svg className={`mark ${className}`} data-live={live ? "" : undefined} width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-g`} x1="8" y1="8" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5fded4" /><stop offset="0.55" stopColor="#39c5bb" /><stop offset="1" stopColor="#0b6f72" />
        </linearGradient>
      </defs>
      <circle className="m-ripple" cx="30" cy="30" r="19" stroke="#e12885" strokeWidth="2.5" />
      <circle className="m-ring" cx="30" cy="30" r="19" stroke={`url(#${id}-g)`} strokeWidth="7.5" strokeLinecap="round" transform="rotate(45 30 30)" />
      <path className="m-tail" d="M44 44 56.5 56.5" stroke={`url(#${id}-g)`} strokeWidth="7.5" strokeLinecap="round" />
      <circle className="m-dot" cx="30" cy="30" r="6.5" fill="#e12885" />
      <g className="m-orbit"><circle cx="30" cy="11" r="3.25" fill="#fff" stroke="#e12885" strokeWidth="2" /></g>
    </svg>
  );
}

export function Wordmark({ size = 28, animate = false }: { size?: number; animate?: boolean }) {
  const letters = "TalentIQ".split("");
  return (
    <span className="inline-flex items-center gap-2 text-ink">
      <Mark size={size} />
      <span className="font-display font-bold tracking-tight" style={{ fontSize: size * 0.72, lineHeight: 1 }}>
        {animate
          ? letters.map((ch, i) => <span key={i} className="wordmark-letter" style={{ animationDelay: `${500 + i * 45}ms` }} aria-hidden="true">{ch}</span>)
          : "TalentIQ"}
        {animate && <span className="sr-only">TalentIQ</span>}
      </span>
    </span>
  );
}

/** Home-page centrepiece: the mark suspended in a drop of liquid glass, with the three sources floating around it. */
export function HeroOrb({ className = "" }: { className?: string }) {
  return (
    <div className={`orb ${className}`} role="img" aria-label="TalentIQ mark inside a drop of glass, with Resume, Notes and Links floating around it.">
      <div className="orb-glow" />
      <div className="orb-ring" />
      <div className="orb-ring orb-ring-2" />
      <div className="orb-body" />
      <div className="orb-mark"><Mark size={120} live className="h-full w-full" /></div>
      <span className="orb-chip glass" aria-hidden="true">Resume</span>
      <span className="orb-chip glass" aria-hidden="true">Notes</span>
      <span className="orb-chip glass" aria-hidden="true">Links</span>
      <span className="glass absolute bottom-[4%] right-[4%] flex items-center gap-2 rounded-full px-3 py-1.5" aria-hidden="true" style={{ animation: "rise 800ms var(--ease-out-expo) 1.1s both" }}>
        <span className="eq"><i /><i /><i /><i /><i /></span>
        <span className="text-[0.8125rem] font-semibold">Live</span>
      </span>
    </div>
  );
}
