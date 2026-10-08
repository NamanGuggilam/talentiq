import type { ClaimStatus, RecordStatus } from "@/db/schema";

type Tone = "ok" | "warn" | "bad" | "accent" | "outline" | undefined;

export function Pill({ tone, children, plain }: { tone?: Tone; children: React.ReactNode; plain?: boolean }) {
  return <span className="pill" data-tone={tone} data-plain={plain ? "" : undefined}>{children}</span>;
}

const STATUS_TONE: Record<RecordStatus, Tone> = { New: "outline", Reviewed: undefined, "Follow-Up": "warn", "Interview Requested": "accent", Closed: undefined };
export const StatusPill = ({ status }: { status: RecordStatus }) => <Pill tone={STATUS_TONE[status]}>{status}</Pill>;

export const CLAIM_LABEL: Record<ClaimStatus, string> = { verified: "Verified", partial: "Partial", discrepancy: "Discrepancy", not_found: "Not found", not_checked: "Not checked" };
const CLAIM_TONE: Record<ClaimStatus, Tone> = { verified: "ok", partial: "warn", discrepancy: "bad", not_found: undefined, not_checked: "outline" };
export const ClaimPill = ({ status }: { status: ClaimStatus }) => <Pill tone={CLAIM_TONE[status]}>{CLAIM_LABEL[status]}</Pill>;

const SUMMARY_TONE = { none: "outline", draft: "warn", approved: "ok", rejected: "bad" } as const;
const SUMMARY_LABEL = { none: "No draft", draft: "Draft", approved: "Approved", rejected: "Rejected" } as const;
export type SummaryState = keyof typeof SUMMARY_LABEL;
export const SummaryPill = ({ state }: { state: SummaryState }) => <Pill tone={SUMMARY_TONE[state]}>{SUMMARY_LABEL[state]}</Pill>;

export function PageHead({ eyebrow, title, children, actions }: { eyebrow?: string; title: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="pb-5 pt-5">
      {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
      <h1 className="text-[2rem] font-bold leading-tight">{title}</h1>
      {children && <div className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-2">{children}</div>}
      {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, name, hint, error, required, children, optional }: { label: string; name: string; hint?: string; error?: string; required?: boolean; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={name} className="label">
        {label}
        {required && <span className="ml-1 font-normal text-muted">(required)</span>}
        {optional && <span className="ml-1 font-normal text-muted">(optional)</span>}
      </label>
      {children}
      {hint && <p id={`${name}-hint`} className="hint">{hint}</p>}
      {error && <p id={`${name}-error`} className="error-text">{error}</p>}
    </div>
  );
}

export function Notice({ tone, children, role = "status" }: { tone?: "ok" | "bad" | "warn"; children: React.ReactNode; role?: "status" | "alert" }) {
  return <div className="notice" data-tone={tone} role={role}>{children}</div>;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card px-6 py-10 text-center">
      <p className="font-display text-xl font-semibold">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-muted">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="card card-pad">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold tabular-nums">{value}</p>
      {sub && <p className="hint mt-1">{sub}</p>}
    </div>
  );
}

export const fmtDate = (d: Date | null | undefined) => (d ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }).format(d) : "");
export const displayName = (c: { firstName: string; lastName: string; preferredName?: string | null }) => `${c.preferredName?.trim() || c.firstName} ${c.lastName}`;
