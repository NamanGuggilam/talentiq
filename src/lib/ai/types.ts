import { z } from "zod";
import type { ClaimStatus, ExtractedFacts, RejectedStatement, SourceKind, SummaryDraft } from "@/db/schema";

export const ParsedResumeSchema = z.object({
  firstName: z.string(), lastName: z.string(), email: z.string(), phone: z.string(),
  university: z.string(), degreeProgram: z.string(), major: z.string(), graduationDate: z.string(), gpa: z.string(),
  skills: z.array(z.string()), projects: z.array(z.string()), coursework: z.array(z.string()),
});
export type ParsedResume = z.infer<typeof ParsedResumeSchema>;

export const CLAIM_TYPES = ["skill", "project", "award", "certification", "experience"] as const;
export const ClaimDraftSchema = z.object({ type: z.enum(CLAIM_TYPES), text: z.string(), resumeQuote: z.string() });
export type ClaimDraft = z.infer<typeof ClaimDraftSchema>;

export type EvidenceInput = { sourceId: string; kind: SourceKind; url: string; facts: ExtractedFacts };
export type ClaimCheck = { status: ClaimStatus; sourceId: string | null; evidenceQuote: string | null; explanation: string; suggestedQuestion: string | null };
export type FoundExtra = { type: ClaimDraft["type"]; text: string; sourceId: string; evidenceQuote: string };

export type SummaryInput = {
  candidate: {
    firstName: string; preferredName?: string | null; university?: string | null; degreeProgram?: string | null; major?: string | null;
    graduationDate?: string | null; gpa?: string | null; workAuthorization?: string | null; desiredFunction?: string | null;
    technicalInterests?: string[] | null; preferredLocations?: string[] | null; skills?: string[] | null; projects?: string[] | null; coursework?: string[] | null;
  };
  resumeText?: string;
  // Recruiter-entered text. Ratings are deliberately absent: the AI never sees them.
  notes?: string | null; areasOfInterest?: string | null; candidateQuestions?: string | null; followUpQuestions?: string | null; recommendedNextSteps?: string | null;
  tags?: string[] | null;
  evidence?: { text: string; quote: string; url: string }[];
};
export type SummaryResult = { draft: SummaryDraft; rejected: RejectedStatement[]; provider: "claude" | "mock" };

export const SearchFiltersSchema = z.object({
  refused: z.boolean(),
  keywords: z.array(z.string()), skills: z.array(z.string()), majors: z.array(z.string()), universities: z.array(z.string()),
  locations: z.array(z.string()), tags: z.array(z.string()),
  graduationYear: z.string(), status: z.string(),
});
export type SearchFilters = z.infer<typeof SearchFiltersSchema>;
export const emptyFilters = (): SearchFilters => ({ refused: false, keywords: [], skills: [], majors: [], universities: [], locations: [], tags: [], graduationYear: "", status: "" });

export type RouteStudent = { desiredFunction?: string | null; major?: string | null; technicalInterests?: string[] | null; skills?: string[] | null };
export type RouteOption = { id: string; name: string; focus: string; waiting: number; minutes: number };
export type RouteChoice = { id: string; reason: string } | null;
