import { z } from "zod";
import type { CandidateLinks, LinkKind } from "@/db/schema";
import { extractText } from "@/lib/extractText";
import { normalizeLinks } from "@/lib/scrape/sources";
import { WORK_AUTH_OPTIONS } from "./profile-options";

export const MAX_RESUME_BYTES = 4_000_000;
const RESUME_TYPES: Record<string, string> = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain" };

const line = (max: number) => z.string().trim().max(max).transform((s) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ""));
const list = (sep: RegExp, maxItems: number, maxLen: number) =>
  z.string().max(4000).transform((s) => [...new Set(s.split(sep).map((x) => x.trim().slice(0, maxLen)).filter(Boolean))].slice(0, maxItems));

export const ProfileSchema = z.object({
  firstName: line(80).pipe(z.string().min(1, "Enter your first name.")),
  lastName: line(80).pipe(z.string().min(1, "Enter your last name.")),
  preferredName: line(80),
  email: z.string().trim().toLowerCase().max(200).pipe(z.email("Enter an email address like name@school.edu.")),
  phone: line(40).refine((s) => !s || /^[+()\d\s.-]{7,}$/.test(s), "Enter a phone number using digits, spaces or dashes."),
  university: line(120),
  degreeProgram: line(80),
  major: line(120),
  graduationDate: line(40),
  gpa: line(8).refine((s) => !s || /^\d(\.\d{1,2})?$/.test(s), "Enter GPA as a number like 3.6."),
  workAuthorization: z.string().refine((s) => !s || (WORK_AUTH_OPTIONS as readonly string[]).includes(s), "Choose one of the listed options."),
  desiredFunction: line(120),
  technicalInterests: list(/,/, 12, 60),
  preferredLocations: list(/,/, 8, 60),
  skills: list(/,/, 30, 40),
  coursework: list(/,/, 20, 80),
  projects: list(/\n/, 8, 240),
});
export type ProfileInput = z.infer<typeof ProfileSchema>;
export const PROFILE_FIELDS = Object.keys(ProfileSchema.shape) as (keyof ProfileInput)[];

export type ProfileErrors = Partial<Record<keyof ProfileInput | LinkKind | "resume" | "consent", string>>;

export function readProfileForm(form: FormData): { data?: ProfileInput; links: CandidateLinks; consent: boolean; errors: ProfileErrors; values: Record<string, string> } {
  const values: Record<string, string> = {};
  for (const k of [...PROFILE_FIELDS, "github", "devpost", "credly", "site"]) values[k] = String(form.get(k) ?? "");
  const parsed = ProfileSchema.safeParse(values);
  const errors: ProfileErrors = {};
  if (!parsed.success) for (const issue of parsed.error.issues) errors[issue.path[0] as keyof ProfileInput] ??= issue.message;
  const { links, errors: linkErrors } = normalizeLinks({ github: values.github, devpost: values.devpost, credly: values.credly, site: values.site });
  Object.assign(errors, linkErrors);
  const consent = form.get("consent") === "on";
  if (Object.keys(links).length && !consent) errors.consent = "Tick the box to let TalentIQ read your links, or clear the links.";
  return { data: parsed.success ? parsed.data : undefined, links, consent, errors, values };
}

export type ResumeUpload = { fileName: string; mime: string; size: number; fileB64: string; text: string };

/** Validates and reads an uploaded resume. Returns null when no file was chosen. */
export async function readResume(file: FormDataEntryValue | null): Promise<ResumeUpload | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_RESUME_BYTES) throw new Error("That file is over 4 MB. Upload a smaller PDF, DOCX or TXT.");
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (!(ext in RESUME_TYPES)) throw new Error("Upload your resume as a PDF, DOCX or TXT file.");
  const buf = Buffer.from(await file.arrayBuffer());
  // Check the file really is what its name says before handing it to a parser.
  const magic = buf.subarray(0, 4).toString("latin1");
  if (ext === "pdf" && magic !== "%PDF") throw new Error("That file is not a valid PDF.");
  if (ext === "docx" && magic !== "PK\u0003\u0004") throw new Error("That file is not a valid DOCX.");
  if (ext === "txt" && buf.includes(0)) throw new Error("That file is not plain text.");
  let text: string;
  try { text = (await extractText(file)).replace(/\u0000/g, "").trim(); } catch { throw new Error("We could not read that file. Try exporting it again as a PDF."); }
  if (text.length < 20) throw new Error("We could not find any text in that file. If it is a scan, upload a text-based PDF.");
  const fileName = file.name.replace(/[^\w.\- ()]/g, "_").slice(-120);
  return { fileName, mime: RESUME_TYPES[ext], size: file.size, fileB64: buf.toString("base64"), text: text.slice(0, 60_000) };
}
