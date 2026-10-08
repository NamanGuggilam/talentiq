import { describe, it, expect } from "vitest";
import { mockCheckClaims, mockExtractClaims, mockFindExtras, mockParseResume, mockSearchQuery, mockSummarize } from "./mock";
import type { EvidenceInput } from "./types";

const resume = `Jane Doe
jane.doe@uni.edu
University of Arkansas
B.S. in Computer Science, Expected May 2027
Coursework: Data Structures, Databases
Skills: Python, React, SQL
- Built a React dashboard with Python and SQL
- 1st place, Arkansas State Science and Engineering Fair 2019
- Led a team of 4 at NWA Freight Hackathon 2023
- CompTIA Security+ certification
`;
const evidence: EvidenceInput[] = [{ sourceId: "s1", kind: "site", url: "/mock/site/jane", facts: { languages: ["Python", "Rust"], lines: ["Arkansas State Science and Engineering Fair 2019: 2nd place, Computer Science category.", "LoadLens, NWA Freight Hackathon 2023, team of 4, Best Use of Data prize.", "Languages across public repositories: Python, Rust."] } }];

describe("rule-based engine", () => {
  it("parses a resume", () => {
    const p = mockParseResume(resume);
    expect(p).toMatchObject({ firstName: "Jane", lastName: "Doe", email: "jane.doe@uni.edu", university: "University of Arkansas", major: "Computer Science", graduationDate: "May 2027" });
    expect(p.skills).toEqual(expect.arrayContaining(["Python", "React", "SQL"]));
  });

  it("produces fully cited summaries, flags missing information, and never sees ratings", () => {
    const p = mockParseResume(resume);
    const { draft, rejected } = mockSummarize({ candidate: { ...p }, resumeText: resume });
    expect(rejected).toHaveLength(0);
    expect([...draft.snapshot, ...draft.keySkills, ...draft.relevantExperience].every((s) => s.sources.length > 0)).toBe(true);
    expect(draft.missingInfo).toEqual(expect.arrayContaining(["Recruiter conversation notes", "Desired internship or job function"]));
    // @ts-expect-error ratings are not part of the summary input type, by design
    const _ = { candidate: p, ratingCommunication: 5 } satisfies Parameters<typeof mockSummarize>[0];
    void _;
  });

  it("labels each claim against the linked pages", () => {
    const claims = mockExtractClaims(resume);
    const checks = mockCheckClaims(claims, evidence);
    const by = (re: RegExp) => checks[claims.findIndex((c) => re.test(c.text))];
    expect(by(/Science and Engineering Fair/).status).toBe("discrepancy");
    expect(by(/Science and Engineering Fair/).suggestedQuestion).toMatch(/walk me through/i);
    expect(by(/Led a team/).status).toBe("partial");
    expect(by(/CompTIA/).status).toBe("not_found");
    expect(by(/^Python$/).status).toBe("verified");
  });

  it("marks everything not checked when no page was read", () => {
    const claims = mockExtractClaims(resume);
    expect(mockCheckClaims(claims, []).every((c) => c.status === "not_checked")).toBe(true);
  });

  it("finds skills on linked pages that the resume left out", () => {
    expect(mockFindExtras(resume, evidence).map((e) => e.text)).toEqual(["Rust"]);
  });

  it("turns a question into filters and refuses to rank", () => {
    const vocab = { majors: ["Data Science", "Computer Science"], universities: ["University of Arkansas"], tags: ["Internship"] };
    const f = mockSearchQuery("Data Science majors graduating 2027 who know SQL", vocab);
    expect(f).toMatchObject({ refused: false, majors: ["Data Science"], skills: ["SQL"], graduationYear: "2027" });
    expect(mockSearchQuery("who is the best candidate", vocab).refused).toBe(true);
    expect(mockSearchQuery("rank the top 5 students", vocab).refused).toBe(true);
  });
});

import { mockChooseRecruiter } from "./mock";
describe("matching a student to a line", () => {
  const lines = [
    { id: "d", name: "Dana Lee", focus: "Data science, analytics, forecasting", waiting: 5, minutes: 20 },
    { id: "s", name: "Sam Ortiz", focus: "Software engineering, routing, cloud platforms", waiting: 3, minutes: 12 },
    { id: "p", name: "Priya Raman", focus: "Supply chain, logistics, operations research", waiting: 2, minutes: 8 },
  ];
  it("matches on the topics the student named", () => {
    expect(mockChooseRecruiter({ desiredFunction: "Logistics Technology Intern", major: "Supply Chain Management" }, lines)?.id).toBe("p");
    expect(mockChooseRecruiter({ desiredFunction: "Software Engineering Intern", technicalInterests: ["Routing"] }, lines)?.id).toBe("s");
    expect(mockChooseRecruiter({ major: "Data Science", technicalInterests: ["Forecasting"] }, lines)?.id).toBe("d");
  });
  it("falls back to the shortest wait, and says so, when nothing matches", () => {
    const pick = mockChooseRecruiter({ major: "Philosophy" }, lines);
    expect(pick?.id).toBe("p");
    expect(pick?.reason).toMatch(/shortest wait/);
  });
  it("never comments on the student", () => {
    expect(mockChooseRecruiter({ desiredFunction: "Software Engineering Intern" }, lines)?.reason).not.toMatch(/strong|good|great|qualified|fit\b/i);
  });
});
