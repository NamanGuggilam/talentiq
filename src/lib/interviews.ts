import { and, eq, gt, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";

export const INTERVIEW_MINUTES = 30;
const ZONE = "America/Chicago";
const local = (d: Date) => Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d).map((p) => [p.type, p.value]));

export const fmtSlot = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: ZONE, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);

/**
 * Open half-hour interview times with one recruiter: 9:00 to 4:30 Central on the next two days,
 * minus any time another student has already taken.
 */
export async function openSlots(recruiterId: string, now = new Date()): Promise<Date[]> {
  const taken = new Set((await db.select({ at: schema.connections.interviewAt }).from(schema.connections).where(and(eq(schema.connections.recruiterId, recruiterId), isNotNull(schema.connections.interviewAt), gt(schema.connections.interviewAt, now)))).map((r) => r.at!.getTime()));
  const today = `${local(now).year}-${local(now).month}-${local(now).day}`;
  const start = Math.ceil(now.getTime() / 1_800_000) * 1_800_000;
  const out: Date[] = [];
  for (let t = start; t < start + 72 * 3_600_000 && out.length < 32; t += 1_800_000) {
    const d = new Date(t), l = local(d);
    const hour = Number(l.hour) % 24;
    if (`${l.year}-${l.month}-${l.day}` === today || hour < 9 || hour >= 17 || taken.has(t)) continue;
    out.push(d);
  }
  return out;
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** A calendar file for one booked interview. */
export function interviewIcs(o: { id: string; at: Date; student: string; recruiter: string; company: string | null }): string {
  const end = new Date(o.at.getTime() + INTERVIEW_MINUTES * 60_000);
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TalentIQ//Interview//EN", "BEGIN:VEVENT", `UID:${o.id}@talentiq`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(o.at)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`Interview: ${o.student} and ${o.recruiter}${o.company ? ` (${o.company})` : ""}`)}`, `DESCRIPTION:${esc("Booked through TalentIQ.")}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n") + "\r\n";
}
