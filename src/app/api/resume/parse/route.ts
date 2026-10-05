import { NextResponse } from "next/server";
import { extractText } from "@/lib/extractText";
import { parseResume } from "@/lib/ai";

export async function POST(req: Request) {
  const file = (await req.formData()).get("resume");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a resume file." }, { status: 400 });
  if (file.size > 5_000_000) return NextResponse.json({ error: "File must be under 5 MB." }, { status: 400 });
  try {
    const text = await extractText(file);
    return NextResponse.json({ fileName: file.name, text, parsed: parseResume(text) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not read that file." }, { status: 422 });
  }
}
