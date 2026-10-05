import { describe, it, expect } from "vitest";
import { mockParseResume, mockSummarize } from "./mock";

const resume = `Jane Doe
jane.doe@uni.edu
University of Arkansas
B.S. in Computer Science, Expected May 2027
Coursework: Data Structures, Databases
- Built a React dashboard with Python and SQL
`;

describe("mock AI", () => {
  it("parses a resume", () => {
    const p = mockParseResume(resume);
    expect(p).toMatchObject({ firstName: "Jane", email: "jane.doe@uni.edu", university: "University of Arkansas", graduationDate: "May 2027" });
    expect(p.skills).toEqual(expect.arrayContaining(["Python", "React", "SQL"]));
  });
  it("produces fully cited, validated summaries and flags missing info", () => {
    const p = mockParseResume(resume);
    const { draft, rejected } = mockSummarize({ candidate: { ...p }, resumeText: resume });
    expect(rejected).toBe(0);
    expect(draft.keySkills.every((s) => s.sources.length)).toBe(true);
    expect(draft.missingInfo).toContain("Recruiter conversation notes");
  });
});
