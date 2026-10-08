import Link from "next/link";
import { redirect } from "next/navigation";
import { HeroOrb } from "@/components/Logo";
import { Notice } from "@/components/ui";
import { getCandidate, getRecruiter } from "@/lib/auth";
import { getView } from "@/lib/view";

const STEPS = [
  ["Make your profile", "Upload a resume and the form fills itself in. Fix anything that is off."],
  ["Tap the badge", "Scan or tap a recruiter's badge. Your profile is shared only when you press Share."],
  ["Have the conversation", "The recruiter adds quick notes and their own ratings while it is fresh."],
  ["Reviewed by people", "Every summary sentence shows its source, and a recruiter signs it off."],
] as const;

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const [recruiter, candidate, sp] = await Promise.all([getRecruiter(), getCandidate(), searchParams]);
  const view = await getView();
  if (view === "recruiter-phone") redirect(recruiter ? "/recruiter" : "/login");
  if (recruiter && view !== "student") redirect("/recruiter");
  return (
    <div className="shell pt-4">
      {sp.deleted && <div className="mb-4"><Notice tone="ok">Your profile and everything attached to it has been deleted.</Notice></div>}

      <HeroOrb className="rise mx-auto w-[82%]" />

      <div className="text-center">
        <h1 className="rise rise-1 text-[2.5rem] font-bold leading-[1.02]">Three minutes at the booth. <span className="bg-gradient-to-r from-accent-deep to-pink-deep bg-clip-text text-transparent">Nothing lost.</span></h1>
        <p className="rise rise-2 mx-auto mt-4 max-w-sm text-[1.0625rem] leading-relaxed text-ink-2">One clean record of every career-fair conversation: the student&apos;s profile, the recruiter&apos;s notes, and a summary that shows its sources.</p>
        <div className="rise rise-3 mt-6 grid gap-2.5">
          <Link href={candidate ? "/me" : "/signup"} className="btn btn-primary !min-h-[3.25rem] !text-base">{candidate ? "Open my profile" : "I'm a student"}</Link>
          {view !== "student" && <Link href="/login" className="btn !min-h-[3.25rem] !text-base">I&apos;m a recruiter</Link>}
        </div>
        {!candidate && <p className="rise rise-4 mt-4 text-sm text-muted">Already have a profile? <Link href="/find" className="link">Find it</Link></p>}
      </div>

      <section className="mt-12" aria-labelledby="how">
        <h2 id="how" className="text-center text-2xl font-bold">How it works</h2>
        <ol className="stagger mt-5 grid gap-3">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="card flex items-start gap-4 p-4">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-gradient-to-b from-[#6fe4da] to-accent font-bold text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.7)]" aria-hidden="true">{i + 1}</span>
              <div><h3 className="text-[1.0625rem] font-semibold">{title}</h3><p className="mt-0.5 text-[0.9375rem] leading-relaxed text-ink-2">{body}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="card mt-6 p-5 text-center" aria-labelledby="people">
        <h2 id="people" className="text-xl font-bold">People decide. Always.</h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">TalentIQ never scores or ranks anyone. The only ratings are the ones a recruiter enters, shown under their name.</p>
      </section>
    </div>
  );
}
