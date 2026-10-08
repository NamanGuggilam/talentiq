/**
 * Route handlers do not get the origin check that server actions have built in.
 * A state-changing request must come from this site, or it is refused.
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin) return req.headers.get("sec-fetch-site") === "same-origin";
  try { return new URL(origin).host === host; } catch { return false; }
}

export function csvCell(v: unknown): string {
  let s = v == null ? "" : Array.isArray(v) ? v.join("; ") : String(v);
  // Stop spreadsheet apps from running a cell that starts like a formula.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
