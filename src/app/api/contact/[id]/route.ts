import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCandidate } from "@/lib/auth";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** A recruiter's contact card, for a student who has shared their profile with that recruiter. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCandidate();
  const missing = () => new NextResponse("Not found", { status: 404 });
  if (!me || !/^[0-9a-f-]{36}$/i.test(id)) return missing();
  const [row] = await db
    .select({ name: schema.recruiters.name, title: schema.recruiters.title, email: schema.recruiters.email, company: schema.events.company, event: schema.events.name })
    .from(schema.connections)
    .innerJoin(schema.recruiters, eq(schema.connections.recruiterId, schema.recruiters.id))
    .leftJoin(schema.events, eq(schema.connections.eventId, schema.events.id))
    .where(and(eq(schema.connections.candidateId, me.id), eq(schema.connections.recruiterId, id)));
  if (!row) return missing();
  const [first, ...rest] = row.name.split(" ");
  const card = ["BEGIN:VCARD", "VERSION:3.0", `N:${esc(rest.join(" "))};${esc(first)};;;`, `FN:${esc(row.name)}`, row.company && `ORG:${esc(row.company)}`, row.title && `TITLE:${esc(row.title)}`, `EMAIL;TYPE=WORK:${esc(row.email)}`, row.event && `NOTE:${esc(`Met at ${row.event} through TalentIQ`)}`, "END:VCARD"].filter(Boolean).join("\r\n") + "\r\n";
  return new NextResponse(card, { headers: { "content-type": "text/vcard; charset=utf-8", "content-disposition": `attachment; filename="${row.name.replace(/[^\w ]/g, "").replace(/ /g, "-")}.vcf"`, "cache-control": "private, no-store" } });
}
