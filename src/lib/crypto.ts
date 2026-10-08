import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;
const PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** scrypt with a per-secret salt. Format: scrypt$<salt>$<hash>, both base64url. */
export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(secret.normalize("NFKC"), salt, 64, PARAMS);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifySecret(secret: string, stored: string | null | undefined): Promise<boolean> {
  const [scheme, saltB64, hashB64] = (stored ?? "").split("$");
  // Hash anyway when there is nothing to compare against, so a missing account costs the same time as a wrong password.
  const salt = scheme === "scrypt" && saltB64 ? Buffer.from(saltB64, "base64url") : Buffer.alloc(16);
  const expected = scheme === "scrypt" && hashB64 ? Buffer.from(hashB64, "base64url") : Buffer.alloc(64);
  const actual = await scrypt(secret.normalize("NFKC"), salt, 64, PARAMS);
  return expected.length === actual.length && timingSafeEqual(expected, actual) && scheme === "scrypt";
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// No 0/O/1/I/L, so a code read off a phone screen is hard to mistype.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/** e.g. "K7QM-2XHD-9RTB": about 59 bits. */
export function recoveryCode(): string {
  const bytes = randomBytes(12);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)].map((g) => g.join("")).join("-");
}
export const normalizeRecoveryCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/(.{4})(?=.)/g, "$1-");

export function tempPassword(): string {
  const bytes = randomBytes(14);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("").replace(/(.{5})(.{5})(.{4})/, "$1-$2-$3");
}
