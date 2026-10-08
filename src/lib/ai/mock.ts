import { RECORD_STATUSES, type SummaryDraft, type SummaryStatement } from "@/db/schema";
import { filterSupported, quoteAppears, type SourceBundle } from "./validateCitations";
import { emptyFilters, type RouteChoice, type RouteOption, type RouteStudent, type ClaimCheck, type ClaimDraft, type EvidenceInput, type FoundExtra, type ParsedResume, type SearchFilters, type SummaryInput, type SummaryResult } from "./types";

// Rule-based implementations. They run with no API key or network, back the tests and the seed script,
// and are the fallback whenever the model is unavailable or over its daily cap.

export const KNOWN_SKILLS = ["Python", "React", "TypeScript", "JavaScript", "Java", "SQL", "AWS", "Docker", "Kubernetes", "C++", "C#", "Go", "Rust", "Swift", "Kotlin", "Machine Learning", "Data Analysis", "Node.js", "Excel", "Git", "Tableau", "Power BI", "Terraform", "PostgreSQL", "MongoDB", "Linux", "R", "MATLAB", "Figma", "Operations Research", "Spark", "Pandas", "TensorFlow", "PyTorch"];
const hasSkill = (text: string, s: string) => new RegExp(`(^|[^a-z0-9+#])${s.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9+#]|$)`, "i").test(text);

export function mockParseResume(text: string): ParsedResume {
  const lines = text.split("\n").map((l) => l.trim());
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] ?? "";
  const phone = text.match(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/)?.[0] ?? "";
  const nameLine = lines.find((l) => /^[A-Z][a-z'’-]+(?: [A-Z]\.?)? [A-Z][a-z'’-]+$/.test(l)) ?? "";
  const nameParts = nameLine.split(" ");
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
  const university = text.match(/(University of [A-Z][\w&]*(?: [A-Z][\w&]*)*|[A-Z][\w&]*(?: [A-Z][\w&]*)* (?:State )?University|[A-Z][\w&]*(?: [A-Z][\w&]*)* College)/)?.[0].trim() ?? "";
  const degree = text.match(/\b(B\.S\.|B\.A\.|M\.S\.|BS|BA|MS|Bachelor of Science|Bachelor of Arts|Master of Science)(?=[\s,])/)?.[0] ?? "";
  const major = text.match(/(?:B\.?S\.?|B\.?A\.?|M\.?S\.?|Bachelor of Science|Bachelor of Arts|Master of Science|Major)[^\n]*?(?:in|:)\s*([A-Z][A-Za-z &]+?)(?=,|\n|$| Expected| \()/)?.[1].trim() ?? "";
  const graduationDate = text.match(/(?:Expected|Graduat\w+)[^\n]*?((?:May|Dec|December|Aug|August|Spring|Fall)\s+20\d\d)/i)?.[1] ?? "";
  const gpa = text.match(/GPA:?\s*(\d\.\d{1,2})/i)?.[1] ?? "";
  const skills = KNOWN_SKILLS.filter((s) => hasSkill(text, s));
  const projects = lines.filter((l) => /^[-•*]\s*(built|developed|created|designed|implemented|led|wrote)/i.test(l)).map((l) => l.replace(/^[-•*]\s*/, "")).slice(0, 5);
  const coursework = text.match(/Coursework:?\s*([^\n]+)/i)?.[1].split(/,\s*/).map((s) => s.trim().replace(/\.$/, "")).filter(Boolean) ?? [];
  return { firstName, lastName, email, phone, university, degreeProgram: degree, major, graduationDate, gpa, skills, projects, coursework };
}

export function mockExtractClaims(text: string): ClaimDraft[] {
  const out: ClaimDraft[] = [];
  const lines = text.split("\n").map((l) => l.replace(/^\s*[-•*]\s*/, "").trim()).filter((l) => l.length > 8);
  for (const l of lines) {
    if (/\b(place|winner|won|award|prize|finalist|honou?rable mention)\b/i.test(l)) out.push({ type: "award", text: l, resumeQuote: l });
    else if (/\b(certified|certification|certificate)\b/i.test(l)) out.push({ type: "certification", text: l, resumeQuote: l });
    else if (/^(built|developed|created|designed|implemented|led|wrote)\b/i.test(l)) out.push({ type: "project", text: l, resumeQuote: l });
    else if (/\b(intern|assistant|engineer|analyst|developer)\b.*\b(20\d\d)\b/i.test(l)) out.push({ type: "experience", text: l, resumeQuote: l });
  }
  for (const s of KNOWN_SKILLS.filter((k) => hasSkill(text, k)).slice(0, 8)) out.push({ type: "skill", text: s, resumeQuote: s });
  return out.slice(0, 16);
}

const STOP = new Set(["the", "and", "with", "for", "a", "an", "of", "in", "at", "to", "on", "using", "built", "developed", "created", "designed", "implemented", "wrote", "place", "team"]);
const content = (s: string) => [...new Set((s.toLowerCase().match(/[a-z0-9+#.]{2,}/g) ?? []).map((w) => w.replace(/\.+$/, "")).filter((w) => !STOP.has(w)))];
function placement(s: string): number | null {
  const m = s.toLowerCase().match(/\b(1st|first|2nd|second|3rd|third|winner|grand prize)\b/);
  if (!m) return null;
  return { "1st": 1, first: 1, winner: 1, "grand prize": 1, "2nd": 2, second: 2, "3rd": 3, third: 3 }[m[1]] ?? null;
}
const ORDINAL = ["", "1st", "2nd", "3rd"];

/** Deterministic claim check: best-matching line from the linked pages, then a comparison of what it says. */
export function mockCheckClaims(claims: ClaimDraft[], evidence: EvidenceInput[]): ClaimCheck[] {
  const usable = evidence.filter((e) => e.facts.lines.length);
  return claims.map((c): ClaimCheck => {
    if (!usable.length) return { status: "not_checked", sourceId: null, evidenceQuote: null, explanation: "No linked page was available to check this against.", suggestedQuestion: null };

    if (c.type === "skill") {
      for (const e of usable) {
        const line = e.facts.lines.find((l) => hasSkill(l, c.text));
        if (line) return { status: "verified", sourceId: e.sourceId, evidenceQuote: line, explanation: `${c.text} appears on the linked ${e.kind} page.`, suggestedQuestion: null };
      }
      return { status: "not_found", sourceId: null, evidenceQuote: null, explanation: `The linked pages do not mention ${c.text}.`, suggestedQuestion: null };
    }

    const want = content(c.text);
    let best: { e: EvidenceInput; line: string; score: number } | null = null;
    for (const e of usable) for (const line of e.facts.lines) {
      const have = new Set(content(line));
      const score = want.filter((w) => have.has(w)).length / Math.max(want.length, 1);
      if (!best || score > best.score) best = { e, line, score };
    }
    if (!best || best.score < 0.34) return { status: "not_found", sourceId: null, evidenceQuote: null, explanation: "Nothing on the linked pages matches this claim.", suggestedQuestion: `Can you tell me more about this: "${c.text}"?` };

    const claimed = placement(c.text), found = placement(best.line);
    if (claimed && found && claimed !== found) {
      return { status: "discrepancy", sourceId: best.e.sourceId, evidenceQuote: best.line, explanation: `The resume says ${ORDINAL[claimed]} place; the linked page says ${ORDINAL[found]}.`, suggestedQuestion: `Your resume lists ${ORDINAL[claimed]} place. Can you walk me through the project and the result?` };
    }
    const claimsLead = /\b(led|lead|captain|founder|managed)\b/i.test(c.text) && !/\b(led|lead|captain|founder|managed)\b/i.test(best.line);
    if (claimsLead || best.score < 0.6) {
      return { status: "partial", sourceId: best.e.sourceId, evidenceQuote: best.line, explanation: claimsLead ? "The linked page confirms the project but does not say who led it." : "The linked page supports part of this claim.", suggestedQuestion: claimsLead ? "Which part of this did you own, and how was the work split?" : `What was your own contribution to this: "${c.text}"?` };
    }
    return { status: "verified", sourceId: best.e.sourceId, evidenceQuote: best.line, explanation: "The linked page states the same thing.", suggestedQuestion: null };
  });
}

/** Skills and projects on the linked pages that the resume never mentions. */
export function mockFindExtras(resumeText: string, evidence: EvidenceInput[]): FoundExtra[] {
  const out: FoundExtra[] = [];
  const seen = new Set<string>();
  for (const e of evidence) {
    for (const lang of e.facts.languages ?? []) {
      if (seen.has(lang.toLowerCase()) || hasSkill(resumeText, lang)) continue;
      const line = e.facts.lines.find((l) => hasSkill(l, lang));
      if (line) { seen.add(lang.toLowerCase()); out.push({ type: "skill", text: lang, sourceId: e.sourceId, evidenceQuote: line }); }
    }
    for (const b of e.facts.badges ?? []) {
      if (quoteAppears(b.name, resumeText) || seen.has(b.name.toLowerCase())) continue;
      const line = e.facts.lines.find((l) => quoteAppears(b.name, l));
      if (line) { seen.add(b.name.toLowerCase()); out.push({ type: "certification", text: b.name, sourceId: e.sourceId, evidenceQuote: line }); }
    }
    for (const p of e.facts.projects ?? []) {
      if (quoteAppears(p.title, resumeText) || seen.has(p.title.toLowerCase())) continue;
      const line = e.facts.lines.find((l) => quoteAppears(p.title, l));
      if (line) { seen.add(p.title.toLowerCase()); out.push({ type: "project", text: p.title, sourceId: e.sourceId, evidenceQuote: line }); }
    }
  }
  return out.slice(0, 8);
}

export function sourceBundle(inp: SummaryInput): SourceBundle {
  const c = inp.candidate;
  return {
    resume: inp.resumeText ?? "",
    candidate: [c.firstName, c.preferredName, c.university, c.degreeProgram, c.major, c.graduationDate, c.gpa, c.workAuthorization, c.desiredFunction, ...(c.technicalInterests ?? []), ...(c.preferredLocations ?? []), ...(c.skills ?? []), ...(c.projects ?? []), ...(c.coursework ?? [])].filter(Boolean).join(" . "),
    notes: [inp.notes, inp.areasOfInterest, inp.candidateQuestions, inp.followUpQuestions, inp.recommendedNextSteps, ...(inp.tags ?? [])].filter(Boolean).join(" . "),
    linked: (inp.evidence ?? []).map((e) => `${e.text} . ${e.quote}`).join(" . "),
  };
}

export function missingInfo(inp: SummaryInput): string[] {
  const c = inp.candidate;
  const out: string[] = [];
  if (!c.graduationDate) out.push("Graduation date");
  if (!c.major) out.push("Major");
  if (!c.desiredFunction) out.push("Desired internship or job function");
  if (!c.preferredLocations?.length) out.push("Preferred work location");
  if (!c.workAuthorization) out.push("Work authorization");
  if (!c.skills?.length) out.push("Skills");
  if (!c.projects?.length) out.push("Project or work experience");
  if (!inp.resumeText?.trim()) out.push("Resume");
  if (!inp.notes?.trim() && !inp.areasOfInterest?.trim()) out.push("Recruiter conversation notes");
  return out;
}

export function mockSummarize(inp: SummaryInput): SummaryResult {
  const c = inp.candidate;
  const src = sourceBundle(inp);
  const st = (text: string, sources: SummaryStatement["sources"], url?: string): SummaryStatement => ({ text, sources, ...(url ? { url } : {}) });

  const snapshot: SummaryStatement[] = [];
  if (c.university && c.major) snapshot.push(st(`${c.major} student at ${c.university}.`, ["Candidate"]));
  if (c.graduationDate) snapshot.push(st(`Expected graduation ${c.graduationDate}.`, ["Candidate"]));
  if (c.desiredFunction) snapshot.push(st(`Interested in ${c.desiredFunction}.`, ["Candidate"]));
  if (c.preferredLocations?.length) snapshot.push(st(`Preferred locations: ${c.preferredLocations.join(", ")}.`, ["Candidate"]));
  if (inp.areasOfInterest?.trim()) snapshot.push(st(`Discussed ${inp.areasOfInterest.trim().replace(/\.$/, "")}.`, ["Recruiter note"]));
  if (inp.recommendedNextSteps?.trim()) snapshot.push(st(`Recruiter's next step: ${inp.recommendedNextSteps.trim().replace(/\.$/, "")}.`, ["Recruiter note"]));

  const resume = inp.resumeText ?? "";
  const keySkills = (c.skills ?? []).slice(0, 8).map((s) => (hasSkill(resume, s) ? st(`${s} listed on resume.`, ["Resume"]) : st(`${s} listed on profile.`, ["Candidate"])));
  for (const e of inp.evidence ?? []) if (e.text.length < 40 && !keySkills.some((k) => k.text.toLowerCase().startsWith(e.text.toLowerCase()))) keySkills.push(st(`${e.text} appears on a linked page.`, ["Linked page"], e.url));

  const relevantExperience = (c.projects ?? []).slice(0, 5).map((p) => st(p.endsWith(".") ? p : `${p}.`, quoteAppears(p, resume) ? ["Resume"] : ["Candidate"]));

  const rejected: SummaryResult["rejected"] = [];
  const check = (l: SummaryStatement[]) => { const r = filterSupported(l, src); rejected.push(...r.rejected); return r.kept; };
  const draft: SummaryDraft = { snapshot: check(snapshot), keySkills: check(keySkills), relevantExperience: check(relevantExperience), missingInfo: missingInfo(inp) };
  return { draft, rejected, provider: "mock" };
}

const QUESTIONS: [RegExp, string][] = [
  [/machine learning|pytorch|tensorflow/i, "What was your own contribution to your machine learning project?"],
  [/python/i, "Can you walk me through a Python project you built end to end?"],
  [/react|typescript|javascript/i, "How did you structure state and data fetching in your front-end work?"],
  [/sql|postgres|database/i, "Describe a query you had to optimise or a schema you designed."],
  [/aws|docker|kubernetes|terraform/i, "Which cloud services have you deployed to, and what did you run there?"],
  [/supply chain|logistics|routing|operations research/i, "What drew you to logistics problems, and which one have you worked on?"],
  [/intern/i, "What did you ship during your internship, and what would you change about it now?"],
];
export function mockInterviewQuestions(text: string, fromClaims: string[] = []): string[] {
  const q = [...fromClaims, ...QUESTIONS.filter(([re]) => re.test(text)).map(([, v]) => v)];
  return (q.length ? [...new Set(q)] : ["Which project are you most keen to talk about?"]).slice(0, 3);
}

const RANKING = /\b(best|top|strongest|weakest|worst|rank|ranking|score|who should (we|i) (hire|interview|pick)|most (qualified|impressive))\b/i;
export const isRankingRequest = (q: string) => RANKING.test(q);

/** Keyword reading of a search question. No ordering is implied by anything returned here. */
export function mockSearchQuery(q: string, vocab: { majors: string[]; universities: string[]; tags: string[] }): SearchFilters {
  const f = emptyFilters();
  if (isRankingRequest(q)) return { ...f, refused: true };
  let rest = q;
  const take = (list: string[], into: string[]) => {
    for (const v of list) if (v && new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(rest)) { into.push(v); rest = rest.replace(new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " "); }
  };
  for (const s of KNOWN_SKILLS) if (hasSkill(rest, s)) { f.skills.push(s); }
  for (const s of f.skills) rest = rest.replace(new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ");
  take(vocab.majors, f.majors); take(vocab.universities, f.universities); take(vocab.tags, f.tags);
  const status = RECORD_STATUSES.find((s) => new RegExp(`\\b${s}\\b`, "i").test(q));
  if (status) { f.status = status; rest = rest.replace(new RegExp(status, "ig"), " "); }
  const year = q.match(/\b(20\d\d)\b/)?.[1];
  if (year) { f.graduationYear = year; rest = rest.replace(year, " "); }
  const loc = q.match(/\b(?:in|near|wants?|prefers?|to)\s+([A-Z][a-z]+(?: [A-Z][a-z]+)?)(?:,|\b)/);
  if (loc && !f.universities.includes(loc[1])) { f.locations.push(loc[1]); rest = rest.replace(loc[1], " "); }
  const filler = new Set(["who", "which", "with", "and", "the", "that", "have", "has", "want", "wants", "students", "student", "candidates", "candidate", "people", "anyone", "mentioned", "show", "find", "me", "all", "for", "are", "is", "in", "to", "of", "a", "an", "or", "graduating", "graduate", "grads", "near", "prefers", "prefer", "know", "knows", "interested", "experience", "skills", "juniors", "seniors", "majors", "major", "from", "on", "their", "status"]);
  f.keywords = [...new Set((rest.toLowerCase().match(/[a-z0-9+#.]{3,}/g) ?? []).filter((w) => !filler.has(w)))].slice(0, 4);
  return f;
}

const ROUTE_STOP = new Set(["and", "the", "for", "with", "intern", "internship", "engineering", "engineer", "team", "roles", "role", "full", "time", "co", "op"]);
const topicWords = (s: string) => new Set((s.toLowerCase().match(/[a-z+#]{3,}/g) ?? []).filter((w) => !ROUTE_STOP.has(w)));

/**
 * Matches what a student says they want to talk about with what each recruiter covers. It compares topics only:
 * nothing about how good the student is. Ties go to the shorter line.
 */
export function mockChooseRecruiter(student: RouteStudent, options: RouteOption[]): RouteChoice {
  if (!options.length) return null;
  const wants = topicWords([student.desiredFunction, student.major, ...(student.technicalInterests ?? []), ...(student.skills ?? [])].filter(Boolean).join(" "));
  const scored = options.map((o) => {
    const shared = [...topicWords(o.focus)].filter((w) => wants.has(w));
    return { o, shared };
  }).sort((a, b) => b.shared.length - a.shared.length || a.o.minutes - b.o.minutes);
  const best = scored[0];
  if (!best.shared.length) return { id: best.o.id, reason: `${best.o.name} has the shortest wait right now.` };
  return { id: best.o.id, reason: `${best.o.name} covers ${best.shared.slice(0, 3).join(", ")}, which matches what you told us.` };
}
