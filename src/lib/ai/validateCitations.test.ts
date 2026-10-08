import { describe, it, expect } from "vitest";
import { quoteAppears, validateStatement } from "./validateCitations";

const src = {
  resume: "Built a React dashboard and Python ETL pipelines at Acme. Completed Intro to Python. 2nd place, State Science Fair 2019.",
  notes: "Asked about logistics routing. I think she knows AWS. Seemed really passionate, probably a strong leader.",
  candidate: "Computer Science . University of Arkansas . May 2027",
  linked: "Repository route-solver: Vehicle routing with time windows. Main language Rust.",
};
const ok = (text: string, sources: Parameters<typeof validateStatement>[0]["sources"]) => validateStatement({ text, sources }, src).ok;

describe("validateStatement", () => {
  it("accepts supported, cited statements", () => {
    expect(ok("Built a React dashboard and Python pipelines.", ["Resume"])).toBe(true);
    expect(ok("Computer Science student at University of Arkansas.", ["Candidate"])).toBe(true);
    expect(ok("Rust is the main language of the route-solver repository.", ["Linked page"])).toBe(true);
  });
  it("accepts short, plainly worded statements", () => {
    expect(ok("Lists Python as a skill.", ["Resume"])).toBe(true);
    expect(ok("She is seeking a role in Computer Science.", ["Candidate"])).toBe(true);
    expect(ok("Knows Kubernetes.", ["Resume"])).toBe(false);
    expect(ok("Leads Python work.", ["Resume"])).toBe(false);
  });
  it("rejects uncited statements", () => expect(ok("Knows React", [])).toBe(false));
  it("rejects claims the cited source does not support", () => expect(ok("Led a Kubernetes migration at Google.", ["Resume"])).toBe(false));
  it("rejects a statement that cites the wrong source", () => expect(ok("Built a React dashboard.", ["Recruiter note"])).toBe(false));
  it("rejects strengthened wording", () => {
    expect(ok("Proficient in Python.", ["Resume"])).toBe(false);
    expect(ok("Expert in React dashboards.", ["Resume"])).toBe(false);
  });
  it("rejects a changed number or placement", () => {
    expect(ok("1st place at the State Science Fair 2019.", ["Resume"])).toBe(false);
    expect(ok("2nd place at the State Science Fair 2019.", ["Resume"])).toBe(true);
    expect(ok("Expected graduation May 2026.", ["Candidate"])).toBe(false);
  });
  it("rejects scoring, verdicts and protected or personal traits, whatever the source says", () => {
    for (const t of ["Top candidate with React experience.", "Strong hire for the routing team.", "Great personality and Python skills.", "Seemed nervous when asked about Python.", "Recommended for hiring; built React dashboard.", "Rated 8/10 on Python."]) expect(ok(t, ["Resume", "Recruiter note"])).toBe(false);
  });
  it("does not let a recruiter's hunch through as fact via a strength word", () => expect(ok("A passionate leader.", ["Resume"])).toBe(false));
});

describe("quoteAppears", () => {
  it("matches ignoring case and punctuation", () => expect(quoteAppears("2nd place, state science fair", src.resume)).toBe(true));
  it("does not match text that is absent", () => expect(quoteAppears("1st place state science fair", src.resume)).toBe(false));
});
