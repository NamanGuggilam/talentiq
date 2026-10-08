import { describe, it, expect } from "vitest";
import { hashSecret, normalizeRecoveryCode, recoveryCode, verifySecret } from "./crypto";
import { safeNext } from "./auth-paths";

describe("secrets", () => {
  it("hashes with a fresh salt and verifies", async () => {
    const a = await hashSecret("correct horse battery"), b = await hashSecret("correct horse battery");
    expect(a).not.toBe(b);
    expect(await verifySecret("correct horse battery", a)).toBe(true);
    expect(await verifySecret("wrong", a)).toBe(false);
    expect(await verifySecret("anything", null)).toBe(false);
    expect(await verifySecret("anything", "plaintext")).toBe(false);
  });
  it("makes recovery codes that survive being retyped loosely", () => {
    const code = recoveryCode();
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(normalizeRecoveryCode(code.toLowerCase().replace(/-/g, " "))).toBe(code);
  });
});

describe("safeNext", () => {
  it("allows same-site paths only", () => {
    expect(safeNext("/c/abc?m=nfc", "/me")).toBe("/c/abc?m=nfc");
    for (const bad of ["//evil.example", "https://evil.example", "/\\evil.example", "javascript:alert(1)", undefined, 5]) expect(safeNext(bad, "/me")).toBe("/me");
  });
});
