import { describe, it, expect } from "vitest";
import { assertPublicUrl, isPrivateAddress } from "./safeFetch";
import { htmlToLines, normalizeLink } from "./sources";

describe("link reader safety", () => {
  it("treats loopback, private, link-local and metadata addresses as private", () => {
    for (const ip of ["127.0.0.1", "10.0.0.5", "172.16.3.4", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) expect(isPrivateAddress(ip)).toBe(true);
    for (const ip of ["8.8.8.8", "140.82.112.3", "2606:4700:4700::1111"]) expect(isPrivateAddress(ip)).toBe(false);
  });
  it("refuses anything that is not plain public https", async () => {
    for (const u of ["http://example.com", "https://localhost/x", "https://127.0.0.1/", "https://[::1]/", "https://169.254.169.254/latest/meta-data", "https://example.com:8443/", "https://user:pw@example.com/", "ftp://example.com", "https://intranet/", "https://db.internal/"]) await expect(assertPublicUrl(u)).rejects.toThrow();
  });
});

describe("normalizeLink", () => {
  it("canonicalises GitHub usernames and URLs", () => {
    expect(normalizeLink("github", "octocat")).toEqual({ ok: true, url: "https://github.com/octocat" });
    expect(normalizeLink("github", "http://github.com/octocat/repo?tab=x")).toEqual({ ok: true, url: "https://github.com/octocat" });
  });
  it("rejects the wrong site, LinkedIn and junk", () => {
    expect(normalizeLink("github", "https://evil.example/octocat").ok).toBe(false);
    expect(normalizeLink("site", "https://www.linkedin.com/in/someone").ok).toBe(false);
    expect(normalizeLink("devpost", "javascript:alert(1)").ok).toBe(false);
  });
  it("keeps demo pages as same-site paths", () => {
    expect(normalizeLink("github", "/mock/github/mayar")).toEqual({ ok: true, url: "/mock/github/mayar" });
    expect(normalizeLink("github", "https://any.example/mock/credly/mayar").ok).toBe(false);
  });
});

describe("htmlToLines", () => {
  it("keeps headings and list items, drops scripts, styles and navigation", () => {
    const { title, lines } = htmlToLines(`<html><head><title>Me &amp; my work</title><style>p{}</style></head><body><nav><li>Home page link</li></nav><h1>Route solver</h1><script>steal()</script><ul><li>2nd place, <b>State Fair</b> 2019</li></ul><p>ok</p></body></html>`);
    expect(title).toBe("Me & my work");
    expect(lines).toEqual(["Route solver", "2nd place, State Fair 2019"]);
  });
});
