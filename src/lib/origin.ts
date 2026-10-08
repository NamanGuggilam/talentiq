import { headers } from "next/headers";

/** Public origin of this deployment, for building absolute links such as the badge QR code. */
export async function appOrigin(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  let host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  // In the side-by-side demo, links meant for students (the badge QR code) should open the student address.
  const [name, port] = host.split(":");
  if (port && port === (process.env.TIQ_PORT_RECRUITER_PHONE ?? "3211")) host = `${name}:${process.env.TIQ_PORT_STUDENT ?? "3212"}`;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
