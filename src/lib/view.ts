import { headers } from "next/headers";

/**
 * Which face of the app this request is for, taken from the port the visitor used, so the demo can run a recruiter
 * phone version and a student version side by side (see scripts/ports.mjs). It only chooses layout and navigation:
 * every page and action still checks the session itself.
 */
export type View = "auto" | "recruiter-phone" | "student";

export async function getView(): Promise<View> {
  const h = await headers();
  const port = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(":")[1] ?? h.get("x-forwarded-port") ?? "";
  if (port && port === (process.env.TIQ_PORT_STUDENT ?? "3212")) return "student";
  if (port && port === (process.env.TIQ_PORT_RECRUITER_PHONE ?? "3211")) return "recruiter-phone";
  return "auto";
}
