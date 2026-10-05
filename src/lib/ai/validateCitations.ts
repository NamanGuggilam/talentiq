import type { SummaryStatement } from "@/db/schema";

export type SourceBundle = { resume?: string; candidate?: string; notes?: string };
const SOURCE_KEY = { Resume: "resume", Candidate: "candidate", "Recruiter note": "notes" } as const;

const FORBIDDEN = [
  /\b(score|ranked?|top candidate|best candidate|reject|not a fit|strong hire|hire him|hire her)\b/i,
  /\b(age|gender|race|ethnicity|religion|disabilit\w*|pregnan\w*|nationality|personality|emotion\w*)\b/i,
];

const words = (s: string) => (s.toLowerCase().match(/[a-z0-9+#.]{3,}/g) ?? []).map((w) => w.replace(/\.+$/, ""));

/** A statement is supported if it cites a source and most of its content words appear in that source. */
export function validateStatement(st: SummaryStatement, src: SourceBundle): { ok: boolean; reason?: string } {
  if (!st.sources?.length) return { ok: false, reason: "no citation" };
  if (FORBIDDEN.some((re) => re.test(st.text))) return { ok: false, reason: "forbidden content" };
  const haystack = st.sources.map((s) => (src[SOURCE_KEY[s]] ?? "").toLowerCase()).join(" ");
  const ws = [...new Set(words(st.text))].filter((w) => !STOP.has(w));
  if (!ws.length) return { ok: false, reason: "empty" };
  const hit = ws.filter((w) => haystack.includes(w)).length;
  return hit / ws.length >= 0.6 ? { ok: true } : { ok: false, reason: "unsupported by cited source" };
}

const STOP = new Set(["the", "and", "with", "for", "has", "have", "candidate", "student", "experience", "demonstrated", "mentioned", "interested", "their", "that", "this", "from", "listed", "resume", "expected", "graduation", "discussed", "interest", "student"]);

export function filterSupported(list: SummaryStatement[], src: SourceBundle) {
  const kept: SummaryStatement[] = [];
  const rejected: { st: SummaryStatement; reason: string }[] = [];
  for (const st of list) {
    const r = validateStatement(st, src);
    if (r.ok) kept.push(st);
    else rejected.push({ st, reason: r.reason! });
  }
  return { kept, rejected };
}
