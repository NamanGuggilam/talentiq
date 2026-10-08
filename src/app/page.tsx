import Link from "next/link";
import { redirect } from "next/navigation";
import { Eq, Mark, Ribbons } from "@/components/Logo";
import { Notice } from "@/components/ui";
import { getCandidate, getRecruiter } from "@/lib/auth";
import { getView } from "@/lib/view";

const STEPS = [["Profile", "Drop in your resume."], ["Line", "We hold your place."], ["Tap", "Phones touch. Resume sent."]] as const;

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const [recruiter, candidate, sp] = await Promise.all([getRecruiter(), getCandidate(), searchParams]);
  const view = await getView();
  if (view === "recruiter-phone") redirect(recruiter ? "/recruiter" : "/login");
  if (recruiter && view !== "student") redirect("/recruiter");
  return (
    <div className="shell">
      <div className="pagehead band !pb-16 !pt-10">
        <Ribbons className="!w-44" />
        <Mark size={64} tone="light" />
        <h1 className="mt-6 !text-[3.5rem] !leading-[0.92]">Skip<br />the line.</h1>
        <p className="mt-4 flex items-center gap-2 text-lg font-bold">Career fair, without the wait <Eq className="text-pink-deep" /></p>
      </div>

      <div className="-mt-12 grid gap-2">
        {sp.deleted && <Notice tone="ok">Profile deleted.</Notice>}
        <Link href={candidate ? "/line" : "/signup"} className="btn btn-primary !min-h-14 !bg-ink !text-lg !text-white">{candidate ? "My line" : "Get started"}</Link>
        {view !== "student" && <Link href="/login" className="btn !min-h-12">Recruiter sign in</Link>}
        {!candidate && <Link href="/find" className="btn btn-quiet">I have a profile</Link>}
      </div>

      <ol className="mt-10 grid gap-5">
        {STEPS.map(([title, body], i) => (
          <li key={title} className="grid grid-cols-[3.5rem_1fr] items-center gap-3">
            <span className="numeral text-[3.25rem] text-accent-deep" aria-hidden="true">{i + 1}</span>
            <div><h2 className="text-2xl">{title}</h2><p className="font-semibold text-ink-2">{body}</p></div>
          </li>
        ))}
      </ol>
    </div>
  );
}
