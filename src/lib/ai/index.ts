import { rateLimit } from "@/lib/rateLimit";
import * as claude from "./claude";
import * as mock from "./mock";
import type { RouteChoice, RouteOption, RouteStudent, ClaimCheck, ClaimDraft, EvidenceInput, FoundExtra, ParsedResume, SearchFilters, SummaryInput, SummaryResult } from "./types";

export type { ParsedResume, SummaryInput, SummaryResult, ClaimDraft, ClaimCheck, EvidenceInput, FoundExtra, SearchFilters } from "./types";

const DAILY_CAP = Number(process.env.AI_DAILY_CAP ?? 600);

export function aiProvider(): "claude" | "mock" {
  return process.env.AI_PROVIDER !== "mock" && process.env.ANTHROPIC_API_KEY ? "claude" : "mock";
}

/**
 * Run the model-backed version when it is configured and under the daily cap; otherwise, or if it fails,
 * use the rule-based version. Either way the result passes through the same code-side checks.
 */
async function withFallback<T>(name: string, viaClaude: () => Promise<T>, viaRules: () => T | Promise<T>): Promise<T> {
  if (aiProvider() === "claude") {
    try {
      if (await rateLimit("ai:daily", DAILY_CAP, 86_400)) return await viaClaude();
      console.warn(`ai:${name} daily cap reached, using rules`);
    } catch (e) {
      console.error(`ai:${name} failed, using rules:`, e instanceof Error ? e.message : e);
    }
  }
  return viaRules();
}

export const parseResume = (text: string): Promise<ParsedResume> =>
  withFallback("parseResume", () => claude.claudeParseResume(text), () => mock.mockParseResume(text));

export const extractClaims = (text: string): Promise<ClaimDraft[]> =>
  withFallback("extractClaims", () => claude.claudeExtractClaims(text), () => mock.mockExtractClaims(text));

export const checkClaims = (claims: ClaimDraft[], evidence: EvidenceInput[]): Promise<ClaimCheck[]> => {
  const usable = evidence.filter((e) => e.facts.lines.length);
  if (!claims.length || !usable.length) return Promise.resolve(mock.mockCheckClaims(claims, usable));
  return withFallback("checkClaims", () => claude.claudeCheckClaims(claims, usable), () => mock.mockCheckClaims(claims, usable));
};

export const findExtras = (resumeText: string, evidence: EvidenceInput[]): Promise<FoundExtra[]> => {
  const usable = evidence.filter((e) => e.facts.lines.length);
  if (!usable.length) return Promise.resolve([]);
  return withFallback("findExtras", () => claude.claudeFindExtras(resumeText, usable), () => mock.mockFindExtras(resumeText, usable));
};

export const summarize = (inp: SummaryInput): Promise<SummaryResult> =>
  withFallback("summarize", () => claude.claudeSummarize(inp), () => mock.mockSummarize(inp));

export const interviewQuestions = (context: string, fromClaims: string[] = []): Promise<string[]> =>
  withFallback("interviewQuestions", async () => [...new Set([...fromClaims, ...(await claude.claudeInterviewQuestions(context))])].slice(0, 3), () => mock.mockInterviewQuestions(context, fromClaims));

export const searchQuery = (q: string, vocab: { majors: string[]; universities: string[]; tags: string[] }): Promise<SearchFilters> => {
  // A ranking request is refused in code before any model is involved.
  if (mock.isRankingRequest(q)) return Promise.resolve({ ...mock.mockSearchQuery(q, vocab), refused: true });
  return withFallback("searchQuery", () => claude.claudeSearchQuery(q, vocab), () => mock.mockSearchQuery(q, vocab));
};

/** Which recruiter's line fits what this student wants to talk about. A topic match, never a judgement of the student. */
export const chooseRecruiter = (student: RouteStudent, options: RouteOption[]): Promise<RouteChoice> => {
  if (options.length <= 1) return Promise.resolve(mock.mockChooseRecruiter(student, options));
  return withFallback("chooseRecruiter", async () => (await claude.claudeChooseRecruiter(student, options)) ?? mock.mockChooseRecruiter(student, options), () => mock.mockChooseRecruiter(student, options));
};
