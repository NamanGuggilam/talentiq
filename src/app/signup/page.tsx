"use client";
import { useState } from "react";

type Form = { firstName: string; lastName: string; email: string; university: string; major: string; graduationDate: string; desiredFunction: string; skills: string; projects: string; coursework: string };
const empty: Form = { firstName: "", lastName: "", email: "", university: "", major: "", graduationDate: "", desiredFunction: "", skills: "", projects: "", coursework: "" };
const split = (s: string, sep: RegExp) => s.split(sep).map((x) => x.trim()).filter(Boolean);

export default function Signup() {
  const [form, setForm] = useState<Form>(empty);
  const [resume, setResume] = useState<{ fileName: string; text: string } | null>(null);
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true); setMsg(null);
    const fd = new FormData(); fd.set("resume", f);
    const res = await fetch("/api/resume/parse", { method: "POST", body: fd });
    const data = await res.json(); setBusy(false);
    if (!res.ok) return setMsg({ kind: "error", text: data.error });
    const p = data.parsed;
    setResume({ fileName: data.fileName, text: data.text });
    setForm({ ...form, firstName: p.firstName, lastName: p.lastName, email: p.email, university: p.university, major: p.major, graduationDate: p.graduationDate,
      skills: p.skills.join(", "), projects: p.projects.join("\n"), coursework: p.coursework.join(", ") });
    setMsg({ kind: "ok", text: "Resume read. Please review and correct the fields below." });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const res = await fetch("/api/candidates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      ...form, skills: split(form.skills, /,/), projects: split(form.projects, /\n/), coursework: split(form.coursework, /,/), resume: resume ?? undefined }) });
    const data = await res.json(); setBusy(false);
    setMsg(res.ok ? { kind: "ok", text: "Account created. You're ready to connect with a recruiter." } : { kind: "error", text: data.error });
  }

  const field = "mt-1 block w-full rounded border border-gray-600 px-3 py-2 text-base text-black focus:outline-none focus:ring-4 focus:ring-blue-600";
  const text = (k: keyof Form, label: string, req = false, type = "text") => (
    <div><label htmlFor={k} className="font-medium">{label}{req && <span aria-hidden> *</span>}</label>
      <input id={k} type={type} required={req} value={form[k]} onChange={set(k)} className={field} /></div>);

  return (
    <main className="mx-auto max-w-xl p-4">
      <h1 className="text-2xl font-bold">Create your TalentIQ profile</h1>
      <p className="mt-2">Upload your resume and we&apos;ll fill in your details. You can edit everything before saving.</p>
      <div className="mt-4">
        <label htmlFor="resume" className="font-medium">Resume (PDF, DOCX or TXT)</label>
        <input id="resume" type="file" accept=".pdf,.docx,.txt" onChange={onFile} className={field} />
      </div>
      <div role="status" aria-live="polite" className="mt-3 min-h-6">
        {busy && "Working…"}
        {msg && <p className={msg.kind === "error" ? "font-semibold text-red-700" : "font-semibold text-green-800"}>{msg.text}</p>}
      </div>
      <form onSubmit={submit} className="mt-2 space-y-4">
        {text("firstName", "First name", true)}{text("lastName", "Last name", true)}{text("email", "Email address", true, "email")}
        {text("university", "University")}{text("major", "Major")}{text("graduationDate", "Graduation date")}{text("desiredFunction", "Desired internship or job function")}
        <div><label htmlFor="skills" className="font-medium">Skills (comma separated)</label><input id="skills" value={form.skills} onChange={set("skills")} className={field} /></div>
        <div><label htmlFor="projects" className="font-medium">Projects (one per line)</label><textarea id="projects" rows={3} value={form.projects} onChange={set("projects")} className={field} /></div>
        <div><label htmlFor="coursework" className="font-medium">Relevant coursework (comma separated)</label><input id="coursework" value={form.coursework} onChange={set("coursework")} className={field} /></div>
        <button disabled={busy} className="rounded bg-blue-800 px-5 py-3 font-semibold text-white focus:outline-none focus:ring-4 focus:ring-blue-400 disabled:opacity-60">Create account</button>
      </form>
    </main>
  );
}
