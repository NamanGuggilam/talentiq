import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCandidate, getRecruiter } from "@/lib/auth";

/**
 * Serves an uploaded resume. Allowed for the student it belongs to, and for staff at an event where that
 * student shared their profile. Everyone else gets a 404, whether or not the file exists.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const missing = () => new NextResponse("Not found", { status: 404 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return missing();
  const [me, staff] = await Promise.all([getCandidate(), getRecruiter()]);
  if (!me && !staff) return missing();
  const [r] = await db.select().from(schema.resumes).where(eq(schema.resumes.id, id));
  if (!r?.fileB64) return missing();

  let allowed = me?.id === r.candidateId;
  if (!allowed && staff?.eventId) {
    const [c] = await db.select({ id: schema.connections.id }).from(schema.connections).where(and(eq(schema.connections.candidateId, r.candidateId), eq(schema.connections.eventId, staff.eventId))).limit(1);
    allowed = !!c;
  }
  if (!allowed) return missing();

  return new NextResponse(Buffer.from(r.fileB64, "base64"), {
    headers: {
      "content-type": r.mime,
      // Always a download: an uploaded file is never rendered in our origin.
      "content-disposition": `attachment; filename="${r.fileName.replace(/["\\\r\n]/g, "_")}"`,
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
      "cache-control": "private, no-store",
    },
  });
}
