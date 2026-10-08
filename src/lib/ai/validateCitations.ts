import type { RejectedStatement, SourceLabel, SummaryStatement } from "@/db/schema";

/** The only text the AI is allowed to draw on. Every statement is checked against the part it cites. */
export type SourceBundle = { resume?: string; candidate?: string; notes?: string; linked?: string };
const SOURCE_KEY: Record<SourceLabel, keyof SourceBundle> = { Resume: "resume", Candidate: "candidate", "Recruiter note": "notes", "Linked page": "linked" };

// Ranking, verdicts and protected or sensitive traits never belong in a summary, whatever the source says.
const FORBIDDEN = [
  /\b(scor(e|es|ed|ing)|rank(s|ed|ing)?|top candidate|best candidate|reject(ed|ion)?|not a fit|good fit|great fit|strong hire|no hire|should (be )?hire[d]?|hire (him|her|them)|recommend(ed)? (for )?hir\w*|\d+\s*\/\s*10|out of (5|10|ten|five))\b/i,
  /\b(age[d]?|gender|race|ethnicit\w*|religio\w*|disabilit\w*|pregnan\w*|nationalit\w*|marital|sexual\w*|accent|personalit\w*|emotion\w*|nervous|anxious|confident|charismatic|attractive|introvert\w*|extrovert\w*)\b/i,
];

// Words that upgrade a claim. They only stand if the source used the same word.
const STRENGTH = new Set(["expert", "expertise", "proficient", "proficiency", "advanced", "fluent", "mastery", "mastered", "extensive", "senior", "lead", "led", "leader", "leadership", "strong", "excellent", "exceptional", "outstanding", "deep", "skilled", "seasoned", "passionate", "award", "winner", "won", "first", "1st"]);

const STOP = new Set(["the", "and", "with", "for", "has", "have", "had", "was", "were", "are", "candidate", "student", "experience", "demonstrated", "mentioned", "interested", "their", "that", "this", "from", "listed", "resume", "expected", "graduation", "discussed", "interest", "shows", "show", "include", "includes", "including", "also", "page", "linked", "public", "profile", "recruiter", "noted", "note", "notes", "says", "said", "per", "using", "used", "use", "into", "about", "work", "worked", "project", "projects", "skills", "skill", "lists", "list", "she", "her", "his", "him", "they", "them", "role", "seeking", "seeks", "wants", "conversation", "noted", "named", "states", "stated", "appears", "currently", "one", "two"]);

const tokens = (s: string) => (s.toLowerCase().match(/[a-z0-9+#.]{2,}/g) ?? []).map((w) => w.replace(/^\.+|\.+$/g, "")).filter(Boolean);
const stem = (w: string) => (w.length > 4 ? w.replace(/(ing|ed|es|s)$/, "") : w);

/**
 * A statement stands only if it cites a source we hold, contains no verdict or protected-trait wording,
 * most of its content words appear in the cited source, and every number or strength word appears there too.
 */
export function validateStatement(st: SummaryStatement, src: SourceBundle): { ok: boolean; reason?: string } {
  if (!st.sources?.length) return { ok: false, reason: "No source cited" };
  if (st.sources.some((s) => !(s in SOURCE_KEY))) return { ok: false, reason: "Unknown source" };
  if (FORBIDDEN.some((re) => re.test(st.text))) return { ok: false, reason: "Judgement or protected-trait wording" };

  const haystackRaw = st.sources.map((s) => src[SOURCE_KEY[s]] ?? "").join(" ");
  if (!haystackRaw.trim()) return { ok: false, reason: "Cited source is empty" };
  const hay = new Set(tokens(haystackRaw).flatMap((w) => [w, stem(w)]));
  const inSource = (w: string) => hay.has(w) || hay.has(stem(w));

  const all = [...new Set(tokens(st.text))];
  const strict = all.filter((w) => /\d/.test(w) || STRENGTH.has(w) || STRENGTH.has(stem(w)));
  const missingStrict = strict.find((w) => !inSource(w));
  if (missingStrict) return { ok: false, reason: `"${missingStrict}" is not in the cited source` };

  const content = all.filter((w) => w.length >= 3 && !STOP.has(w));
  if (!content.length) return { ok: false, reason: "Nothing checkable" };
  const hits = content.filter(inSource).length;
  // Very short statements get one word of slack; the strict check above still guards numbers and strength words.
  const enough = hits / content.length >= 0.6 || (content.length <= 3 && hits >= 1 && content.length - hits <= 1);
  return enough ? { ok: true } : { ok: false, reason: "Not supported by the cited source" };
}

export function filterSupported(list: SummaryStatement[], src: SourceBundle) {
  const kept: SummaryStatement[] = [];
  const rejected: RejectedStatement[] = [];
  for (const st of list) {
    const r = validateStatement(st, src);
    if (r.ok) kept.push(st);
    else rejected.push({ text: st.text, sources: st.sources ?? [], reason: r.reason! });
  }
  return { kept, rejected };
}

/** True when `quote` really appears in `text`, ignoring case, punctuation and spacing. */
export function quoteAppears(quote: string, text: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim();
  const q = norm(quote);
  return q.length >= 3 && norm(text).includes(q);
}
