import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const UA = "TalentIQBot/1.0 (capstone prototype; reads only pages a candidate linked)";
const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

export class FetchBlocked extends Error {}

/** Loopback, private, link-local, CGNAT, multicast and reserved ranges, v4 and v6. */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    if (mapped) return isPrivateAddress(mapped);
    return s === "::" || s === "::1" || s.startsWith("fc") || s.startsWith("fd") || s.startsWith("fe8") || s.startsWith("fe9") || s.startsWith("fea") || s.startsWith("feb") || s.startsWith("ff") || s.startsWith("64:ff9b") || s.startsWith("2001:db8");
  }
  return true;
}

/** Throws unless the URL is plain https on the default port and resolves only to public addresses. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new FetchBlocked("That is not a valid web address."); }
  if (url.protocol !== "https:") throw new FetchBlocked("Only https links can be read.");
  if (url.port && url.port !== "443") throw new FetchBlocked("Links with a custom port cannot be read.");
  if (url.username || url.password) throw new FetchBlocked("Links with sign-in details cannot be read.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) { if (isPrivateAddress(host)) throw new FetchBlocked("That address is not public."); return url; }
  if (!host.includes(".") || /\.(local|localhost|internal|lan|home|corp|test|invalid)$/i.test(host)) throw new FetchBlocked("That address is not public.");
  const addrs = await lookup(host, { all: true }).catch(() => { throw new FetchBlocked("That site could not be found."); });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new FetchBlocked("That address is not public.");
  return url;
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) { await reader.cancel(); throw new FetchBlocked("That page is too large to read."); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** GET a public https page. Redirects are followed by hand so every hop is checked again. */
export async function safeGet(raw: string, opts: { accept?: string; headers?: Record<string, string> } = {}): Promise<{ status: number; body: string; url: string }> {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": UA, accept: opts.accept ?? "text/html,application/xhtml+xml", ...opts.headers },
      cache: "no-store",
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new FetchBlocked("The page redirected nowhere.");
      url = await assertPublicUrl(new URL(loc, url).toString());
      continue;
    }
    return { status: res.status, body: res.ok ? await readCapped(res) : "", url: url.toString() };
  }
  throw new FetchBlocked("Too many redirects.");
}

/** Minimal robots.txt check for the wildcard group. A missing or unreadable file means allowed. */
export async function robotsAllows(target: URL): Promise<boolean> {
  try {
    const { status, body } = await safeGet(`${target.origin}/robots.txt`, { accept: "text/plain" });
    if (status !== 200) return true;
    let applies = false;
    const disallow: string[] = [];
    const allow: string[] = [];
    for (const rawLine of body.split("\n")) {
      const line = rawLine.split("#")[0].trim();
      const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
      if (!m) continue;
      const key = m[1].toLowerCase(), val = m[2].trim();
      if (key === "user-agent") applies = val === "*" || /talentiq/i.test(val);
      else if (applies && key === "disallow" && val) disallow.push(val);
      else if (applies && key === "allow" && val) allow.push(val);
    }
    const path = target.pathname + target.search;
    const longest = (rules: string[]) => rules.filter((r) => path.startsWith(r.replace(/\*.*$/, ""))).reduce((n, r) => Math.max(n, r.length), -1);
    return longest(allow) >= longest(disallow);
  } catch {
    return true;
  }
}
