import Link from "next/link";
import { redirect } from "next/navigation";
import { Mark } from "@/components/Logo";
import { Notice } from "@/components/ui";
import { getCandidate, getRecruiter } from "@/lib/auth";
import { getView } from "@/lib/view";

const STEPS = [
  ["Make your profile", "Upload your resume. The form fills itself in."],
  ["Get a place in line", "We match you to the recruiter who covers what you want to talk about."],
  ["Tap phones at the booth", "Your profile goes to them, their contact card comes to you."],
] as const;

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const [recruiter, candidate, sp] = await Promise.all([getRecruiter(), getCandidate(), searchParams]);
  const view = await getView();
  if (view === "recruiter-phone") redirect(recruiter ? "/recruiter" : "/login");
  if (recruiter && view !== "student") redirect("/recruiter");
  return (
    <>
      <section className="bg-accent text-accent-ink">
        <div className="shell pb-10 pt-12">
          <Mark size={72} tone="light" live />
          <h1 className="mt-8 text-[2.75rem] font-bold leading-[1.02] tracking-tight">Skip the line.<br />Meet the right recruiter.</h1>
          <p className="mt-4 max-w-[22rem] text-[1.0625rem] leading-relaxed">TalentIQ holds your place at the career fair and hands your resume over with a tap.</p>
        </div>
      </section>

      <div className="shell -mt-6">
        <div className="card grid gap-2.5 p-4 shadow-[0_12px_32px_-18px_rgb(14_42_48/0.4)]">
          {sp.deleted && <Notice tone="ok">Your profile and everything attached to it has been deleted.</Notice>}
          <Link href={candidate ? "/line" : "/signup"} className="btn btn-primary !min-h-[3.25rem] !text-base">{candidate ? "See my place in line" : "Get started"}</Link>
          {view !== "student" && <Link href="/login" className="btn !min-h-[3.25rem] !text-base">I&apos;m a recruiter</Link>}
          {!candidate && <p className="pt-1 text-center text-sm text-muted">Already have a profile? <Link href="/find" className="link">Find it</Link></p>}
        </div>

        <ol className="mt-8">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="grid grid-cols-[2rem_1fr] gap-x-3 border-t border-line py-4 first:border-t-0">
              <span className="pt-0.5 text-lg font-bold tabular-nums text-accent-text" aria-hidden="true">{i + 1}</span>
              <div><h2 className="text-[1.0625rem] font-semibold">{title}</h2><p className="mt-0.5 text-[0.9375rem] leading-relaxed text-ink-2">{body}</p></div>
            </li>
          ))}
        </ol>

        <p className="mt-4 border-t border-line pt-4 text-sm leading-relaxed text-muted">People make every decision. TalentIQ never scores or ranks anyone.</p>
      </div>
    </>
  );
}
