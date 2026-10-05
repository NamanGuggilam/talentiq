import type { SummaryDraft, SummaryStatement } from "@/db/schema";
import { filterSupported, type SourceBundle } from "./validateCitations";

// Pre-written (template-based) AI responses. No API key or network needed.
// Swap for the Claude-backed implementation by setting AI_PROVIDER=claude later.

export type ParsedResume = {
  firstName: string; lastName: string; email: string;
  university: string; major: string; graduationDate: string;
  skills: string[]; projects: string[]; coursework: string[];
};

const SKILLS = ["Python", "React", "TypeScript", "JavaScript", "Java", "SQL", "AWS", "Docker", "C++", "Machine Learning", "Data Analysis", "Node.js", "Excel", "Git"];

export function mockParseResume(text: string): ParsedResume {
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] ?? "";
  const nameLine = text.split("\n").map((l) => l.trim()).find((l) => /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(l)) ?? "";
  const [firstName = "", lastName = ""] = nameLine.split(" ");
  const university = text.match(/(University of [A-Z][\w ]+|[A-Z][\w ]+ University|[A-Z][\w ]+ College)/)?.[0].trim() ?? "";
  const major = text.match(/(?:B\.?S\.?|Bachelor of Science|Major)[^\n]*?(?:in|:)\s*([A-Z][\w &]+)/)?.[1].trim() ?? "";
  const graduationDate = text.match(/(?:Expected|Graduat\w+)[^\n]*?((?:May|Dec|December|Aug|August)\s+20\d\d)/i)?.[1] ?? "";
  const lower = text.toLowerCase();
  const skills = SKILLS.filter((s) => lower.includes(s.toLowerCase()));
  const projects = text.split("\n").filter((l) => /^\s*[-•*]\s*(built|developed|created|designed)/i.test(l)).map((l) => l.replace(/^\s*[-•*]\s*/, "").trim()).slice(0, 4);
  const coursework = text.match(/Coursework:?\s*([^\n]+)/i)?.[1].split(/,\s*/).map((s) => s.trim()).filter(Boolean) ?? [];
  return { firstName, lastName, email, university, major, graduationDate, skills, projects, coursework };
}

export type SummaryInput = {
  candidate: { firstName: string; university?: string | null; major?: string | null; graduationDate?: string | null; skills?: string[] | null; projects?: string[] | null; desiredFunction?: string | null };
  resumeText?: string;
  notes?: string;
  areasOfInterest?: string | null;
};

export function mockSummarize(inp: SummaryInput): { draft: SummaryDraft; rejected: number } {
  const c = inp.candidate;
  const candidateText = [c.university, c.major, c.graduationDate, c.desiredFunction, ...(c.skills ?? []), ...(c.projects ?? [])].filter(Boolean).join(" ");
  const src: SourceBundle = { resume: inp.resumeText ?? "", candidate: candidateText, notes: [inp.notes, inp.areasOfInterest].filter(Boolean).join(" ") };
  const st = (text: string, sources: SummaryStatement["sources"]): SummaryStatement => ({ text, sources });

  const snapshot: SummaryStatement[] = [];
  if (c.university && c.major) snapshot.push(st(`${c.major} student at ${c.university}.`, ["Candidate"]));
  if (c.graduationDate) snapshot.push(st(`Expected graduation ${c.graduationDate}.`, ["Candidate"]));
  if (c.desiredFunction) snapshot.push(st(`Interested in ${c.desiredFunction}.`, ["Candidate"]));
  if (inp.areasOfInterest) snapshot.push(st(`Discussed interest in ${inp.areasOfInterest}.`, ["Recruiter note"]));

  const keySkills = (c.skills ?? []).map((s) => st(`${s} listed on resume.`, ["Resume"]));
  const relevantExperience = (c.projects ?? []).map((p) => st(p.endsWith(".") ? p : `${p}.`, ["Resume"]));

  const missingInfo: string[] = [];
  if (!c.skills?.length) missingInfo.push("Skills");
  if (!c.projects?.length) missingInfo.push("Project or work experience");
  if (!c.graduationDate) missingInfo.push("Graduation date");
  if (!c.desiredFunction) missingInfo.push("Desired internship or job function");
  if (!inp.notes?.trim()) missingInfo.push("Recruiter conversation notes");

  let rejected = 0;
  const check = (l: SummaryStatement[]) => { const r = filterSupported(l, src); rejected += r.rejected.length; return r.kept; };
  return { draft: { snapshot: check(snapshot), keySkills: check(keySkills), relevantExperience: check(relevantExperience), missingInfo }, rejected };
}

/** Pre-written follow-up question suggestions keyed on skills/interests found in the source. */
const QUESTIONS: Record<string, string> = {
  "machine learning": "What was your contribution to your machine learning project?",
  python: "Can you walk me through a Python project you're proud of?",
  react: "How did you structure state in your React work?",
  sql: "Describe a query you optimized or a schema you designed.",
  aws: "Which AWS services have you used, and for what?",
};
export function mockInterviewQuestions(text: string): string[] {
  const l = text.toLowerCase();
  const q = Object.entries(QUESTIONS).filter(([k]) => l.includes(k)).map(([, v]) => v);
  return q.length ? q.slice(0, 3) : ["What project are you most excited to talk about?"];
}
