import { z } from "zod";
import type { CandidateLinks } from "@/db/schema";
import { ParsedResumeSchema, type ParsedResume } from "@/lib/ai/types";
import { extractText } from "@/lib/extractText";
import { classifyLinks } from "@/lib/scrape/sources";

export const MAX_UPLOAD_BYTES = 4_000_000; // all files together; the host caps a request at 4.5 MB
export const MAX_EXTRA_FILES = 3;
const FILE_TYPES: Record<string, string> = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain" };

const line = (max: number) => z.string().trim().max(max).transform((s) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ""));

// The student types almost nothing. Everything else is read from their resume.
export const ProfileSchema = z.object({
  firstName: line(80).pipe(z.string().min(1, "Enter your first name.")),
  lastName: line(80).pipe(z.string().min(1, "Enter your last name.")),
  email: z.string().trim().toLowerCase().max(200).pipe(z.email("Enter an email address like name@school.edu.")),
  desiredFunction: line(160),
});
export type ProfileInput = z.infer<typeof ProfileSchema>;
export type ProfileErrors = Partial<Record<keyof ProfileInput | "resume" | "files" | "links", string>>;

export function readProfileForm(form: FormData): { data?: ProfileInput; links: CandidateLinks; consent: boolean; parsed: ParsedResume | null; errors: ProfileErrors; values: Record<string, string> } {
  const values: Record<string, string> = {};
  for (const k of ["firstName", "lastName", "email", "desiredFunction", "links"]) values[k] = String(form.get(k) ?? "");
  const res = ProfileSchema.safeParse(values);
  const errors: ProfileErrors = {};
  if (!res.success) for (const issue of res.error.issues) errors[issue.path[0] as keyof ProfileInput] ??= issue.message;
  // What the resume reader returned when the file was chosen. It is the student's own data, so it is only shape-checked.
  let parsed: ParsedResume | null = null;
  try { const p = ParsedResumeSchema.safeParse(JSON.parse(String(form.get("parsed") ?? ""))); if (p.success) parsed = p.data; } catch {}
  return { data: res.success ? res.data : undefined, links: classifyLinks(values.links.slice(0, 1200)), consent: form.get("consent") === "on", parsed, errors, values };
}

/** Profile columns filled from the resume reader. Lists are capped; blanks become null. */
export function fromParsed(p: ParsedResume | null) {
  if (!p) return {};
  const s = (v: string, max: number) => v.trim().slice(0, max) || null;
  const l = (v: string[], n: number, max: number) => [...new Set(v.map((x) => x.trim().slice(0, max)).filter(Boolean))].slice(0, n);
  return { phone: s(p.phone, 40), university: s(p.university, 120), degreeProgram: s(p.degreeProgram, 80), major: s(p.major, 120), graduationDate: s(p.graduationDate, 40), gpa: s(p.gpa, 8), skills: l(p.skills, 30, 40), projects: l(p.projects, 8, 240), coursework: l(p.coursework, 20, 80) };
}

export type Upload = { fileName: string; mime: string; size: number; fileB64: string; text: string };

/** Validates and reads one uploaded file. Returns null when nothing was chosen. */
export async function readUpload(file: FormDataEntryValue | null): Promise<Upload | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name} is over 4 MB.`);
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (!(ext in FILE_TYPES)) throw new Error("Upload PDF, DOCX or TXT files.");
  const buf = Buffer.from(await file.arrayBuffer());
  // Check the file really is what its name says before handing it to a parser.
  const magic = buf.subarray(0, 4).toString("latin1");
  if (ext === "pdf" && magic !== "%PDF") throw new Error(`${file.name} is not a valid PDF.`);
  if (ext === "docx" && magic !== "PK\u0003\u0004") throw new Error(`${file.name} is not a valid DOCX.`);
  if (ext === "txt" && buf.includes(0)) throw new Error(`${file.name} is not plain text.`);
  let text: string;
  try { text = (await extractText(file)).replace(/\u0000/g, "").trim(); } catch { throw new Error(`We could not read ${file.name}. Try exporting it again as a PDF.`); }
  if (text.length < 20) throw new Error(`No text found in ${file.name}. If it is a scan, upload a text-based PDF.`);
  return { fileName: file.name.replace(/[^\w.\- ()]/g, "_").slice(-120), mime: FILE_TYPES[ext], size: file.size, fileB64: buf.toString("base64"), text: text.slice(0, 60_000) };
}
export const readResume = readUpload;

/** The resume and any other files from one form, with a combined size limit. */
export async function readUploads(form: FormData, errors: ProfileErrors): Promise<{ resume: Upload | null; extras: Upload[] }> {
  let resume: Upload | null = null;
  const extras: Upload[] = [];
  try { resume = await readUpload(form.get("resume")); } catch (e) { errors.resume = e instanceof Error ? e.message : "We could not read that file."; }
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_EXTRA_FILES) errors.files = `Add up to ${MAX_EXTRA_FILES} other files.`;
  else if (files.reduce((n, f) => n + f.size, resume?.size ?? 0) > MAX_UPLOAD_BYTES) errors.files = "All files together must be under 4 MB.";
  else for (const f of files) { try { const u = await readUpload(f); if (u) extras.push(u); } catch (e) { errors.files = e instanceof Error ? e.message : "We could not read one of those files."; } }
  return { resume, extras };
}
