import { describe, it, expect } from "vitest";
import { validateStatement } from "./validateCitations";

const src = { resume: "Built a React dashboard and Python ETL pipelines at Acme.", notes: "Asked about logistics routing." };

describe("validateStatement", () => {
  it("accepts supported, cited statements", () => {
    expect(validateStatement({ text: "Built a React dashboard in Python pipelines", sources: ["Resume"] }, src).ok).toBe(true);
  });
  it("rejects uncited statements", () => {
    expect(validateStatement({ text: "Knows React", sources: [] }, src).ok).toBe(false);
  });
  it("rejects unsupported claims", () => {
    expect(validateStatement({ text: "Led Kubernetes migration at Google", sources: ["Resume"] }, src).ok).toBe(false);
  });
  it("rejects scoring and protected-trait language", () => {
    expect(validateStatement({ text: "Top candidate with great personality React", sources: ["Resume"] }, src).ok).toBe(false);
  });
});
