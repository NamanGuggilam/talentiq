import { NextResponse } from "next/server";
import { parseResume } from "@/lib/ai";
import { sameOrigin } from "@/lib/http";
import { readUpload } from "@/lib/profile";
import { limitByIp } from "@/lib/rateLimit";
import { findLinks } from "@/lib/scrape/sources";

export const maxDuration = 60;

/** Reads an uploaded resume and returns what it found, including any links. Nothing is stored at this step. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Request not allowed." }, { status: 403 });
  if (!(await limitByIp("parse", 15, 600))) return NextResponse.json({ error: "Too many uploads in a short time. Wait a few minutes and try again." }, { status: 429 });
  try {
    const resume = await readUpload((await req.formData()).get("resume"));
    if (!resume) return NextResponse.json({ error: "Choose a resume file." }, { status: 400 });
    return NextResponse.json({ fileName: resume.fileName, parsed: await parseResume(resume.text), links: findLinks(resume.text) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "We could not read that file." }, { status: 422 });
  }
}
