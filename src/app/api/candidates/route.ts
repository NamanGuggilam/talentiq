import { NextResponse } from "next/server";
import { z } from "zod";
import { db, dbReady, schema } from "@/db";

const list = z.array(z.string()).default([]);
const Body = z.object({
  firstName: z.string().min(1), lastName: z.string().min(1), email: z.string().email(),
  university: z.string().optional(), major: z.string().optional(), graduationDate: z.string().optional(),
  desiredFunction: z.string().optional(), skills: list, projects: list, coursework: list,
  resume: z.object({ fileName: z.string(), text: z.string() }).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Please check the highlighted fields.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  await dbReady;
  const { resume, ...fields } = parsed.data;
  try {
    const [c] = await db.insert(schema.candidates).values(fields).returning();
    if (resume) await db.insert(schema.resumes).values({ candidateId: c.id, fileName: resume.fileName, extractedText: resume.text });
    return NextResponse.json({ id: c.id });
  } catch {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }
}
