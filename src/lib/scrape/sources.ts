import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CandidateLinks, ExtractedFacts, LinkKind } from "@/db/schema";
import { FetchBlocked, robotsAllows, safeGet } from "./safeFetch";

export const LINK_LABEL: Record<LinkKind, string> = { github: "GitHub", devpost: "Devpost", credly: "Credly", site: "Portfolio site" };
const HOSTS: Record<Exclude<LinkKind, "site">, RegExp> = { github: /^(www\.)?github\.com$/i, devpost: /^(www\.)?devpost\.com$/i, credly: /^(www\.)?credly\.com$/i };
const MOCK_PATH = /^\/mock\/(github|devpost|credly|site)\/([a-z0-9][a-z0-9-]{0,38})$/i;

/**
 * Turn what a student typed into a canonical link, or explain why it cannot be used.
 * Demo profile pages are stored as same-site paths (/mock/<kind>/<handle>).
 */
export function normalizeLink(kind: LinkKind, raw: string): { ok: true; url: string } | { ok: false; error: string } {
  const v = raw.trim();
  if (!v) return { ok: true, url: "" };
  if (v.length > 300) return { ok: false, error: `${LINK_LABEL[kind]} link is too long.` };
  const mock = v.match(MOCK_PATH) ?? (() => { try { return new URL(v).pathname.match(MOCK_PATH); } catch { return null; } })();
  if (mock) return mock[1].toLowerCase() === kind ? { ok: true, url: `/mock/${kind}/${mock[2].toLowerCase()}` } : { ok: false, error: `That demo link is not a ${LINK_LABEL[kind]} page.` };
  if (kind === "github" && /^[a-z\d](?:[a-z\d-]{0,38})$/i.test(v)) return { ok: true, url: `https://github.com/${v}` };
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`); } catch { return { ok: false, error: `${LINK_LABEL[kind]} link is not a valid web address.` }; }
  if (url.protocol !== "https:") url.protocol = "https:";
  if (kind !== "site" && !HOSTS[kind].test(url.hostname)) return { ok: false, error: `${LINK_LABEL[kind]} link must be on ${kind}.com.` };
  if (/(^|\.)linkedin\.com$/i.test(url.hostname)) return { ok: false, error: "LinkedIn pages cannot be read. Use a portfolio, GitHub, Devpost or Credly link." };
  if (kind === "github") {
    const user = url.pathname.split("/").filter(Boolean)[0];
    if (!user || !/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(user)) return { ok: false, error: "GitHub link should look like github.com/your-username." };
    return { ok: true, url: `https://github.com/${user}` };
  }
  url.hash = "";
  return { ok: true, url: url.toString() };
}

export function normalizeLinks(input: Partial<Record<LinkKind, string>>): { links: CandidateLinks; errors: Partial<Record<LinkKind, string>> } {
  const links: CandidateLinks = {};
  const errors: Partial<Record<LinkKind, string>> = {};
  for (const kind of schema.LINK_KINDS) {
    const r = normalizeLink(kind, input[kind] ?? "");
    if (!r.ok) errors[kind] = r.error;
    else if (r.url) links[kind] = r.url;
  }
  return { links, errors };
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

/** Headings, list items and paragraphs as plain lines. Scripts, styles, navigation and forms are dropped. */
export function htmlToLines(html: string): { title?: string; lines: string[] } {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|nav|footer|form|iframe|template|head)\b[\s\S]*?<\/\1>/gi, " ");
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const m of body.matchAll(/<(h[1-4]|li|p|dt|dd|figcaption|td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const text = clean(decode(m[2].replace(/<[^>]+>/g, " ")));
    const key = text.toLowerCase();
    if (text.length < 4 || text.length > 260 || seen.has(key)) continue;
    seen.add(key);
    lines.push(text);
    if (lines.length >= 120) break;
  }
  return { title: title ? clean(decode(title)).slice(0, 140) : undefined, lines };
}

async function fetchGithub(profileUrl: string): Promise<ExtractedFacts> {
  const user = new URL(profileUrl).pathname.split("/").filter(Boolean)[0];
  const headers: Record<string, string> = { "x-github-api-version": "2022-11-28" };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await safeGet(`https://api.github.com/users/${encodeURIComponent(user)}/repos?per_page=100&sort=pushed&type=owner`, { accept: "application/vnd.github+json", headers });
  if (res.status === 404) throw new FetchBlocked("That GitHub account was not found.");
  if (res.status === 403 || res.status === 429) throw new FetchBlocked("GitHub is limiting requests right now. Try again later.");
  if (res.status !== 200) throw new FetchBlocked(`GitHub answered with status ${res.status}.`);
  type Repo = { name: string; description: string | null; language: string | null; fork: boolean; created_at: string; pushed_at: string; stargazers_count: number };
  const repos = (JSON.parse(res.body) as Repo[]).filter((r) => !r.fork).slice(0, 30);
  const languages = [...new Set(repos.map((r) => r.language).filter((l): l is string => !!l))];
  const year = (d: string) => d.slice(0, 4);
  const lines = repos.map((r) => clean(`Repository ${r.name}${r.description ? `: ${r.description}` : ""}.${r.language ? ` Main language ${r.language}.` : ""} Created ${year(r.created_at)}, last updated ${year(r.pushed_at)}.${r.stargazers_count ? ` ${r.stargazers_count} stars.` : ""}`));
  if (languages.length) lines.unshift(`Languages across public repositories: ${languages.join(", ")}.`);
  if (repos.length) {
    const years = repos.flatMap((r) => [year(r.created_at), year(r.pushed_at)]).sort();
    lines.unshift(`${repos.length} public repositories, active from ${years[0]} to ${years[years.length - 1]}.`);
  }
  return {
    title: `${user} on GitHub`, languages, lines,
    repos: repos.map((r) => ({ name: r.name, description: r.description ?? undefined, language: r.language ?? undefined, created: year(r.created_at), pushed: year(r.pushed_at), stars: r.stargazers_count })),
  };
}

async function fetchPage(pageUrl: string): Promise<ExtractedFacts> {
  const target = new URL(pageUrl);
  if (!(await robotsAllows(target))) throw new FetchBlocked("That site asks automated readers not to open this page.");
  const res = await safeGet(pageUrl);
  if (res.status !== 200) throw new FetchBlocked(`The page answered with status ${res.status}.`);
  const { title, lines } = htmlToLines(res.body);
  if (!lines.length) throw new FetchBlocked("No readable text was found on that page.");
  return { title, lines };
}

async function fetchMock(path: string): Promise<ExtractedFacts> {
  const m = path.match(MOCK_PATH);
  if (!m) throw new FetchBlocked("Unknown demo page.");
  const [p] = await db.select().from(schema.mockProfiles).where(and(eq(schema.mockProfiles.kind, m[1].toLowerCase() as LinkKind), eq(schema.mockProfiles.handle, m[2].toLowerCase())));
  if (!p) throw new FetchBlocked("That demo page does not exist.");
  return p.facts;
}

/** Read one linked page and return only the specific facts we keep. Bios, photos and other people's data are never stored. */
export async function readLink(kind: LinkKind, url: string): Promise<ExtractedFacts> {
  if (url.startsWith("/mock/")) return fetchMock(url);
  return kind === "github" ? fetchGithub(url) : fetchPage(url);
}
