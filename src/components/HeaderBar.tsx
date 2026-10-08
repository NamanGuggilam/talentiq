"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dock, TopNav, type DockItem } from "./Dock";
import { Wordmark } from "./Logo";

const STUDENT_PATHS = ["/signup", "/find", "/me", "/line", "/tap", "/c/", "/mock/"];
/** Student screens are always the student app, whoever else is signed in on this browser. */
export const isStudentPath = (path: string) => path === "/" || STUDENT_PATHS.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`));

/**
 * Marks the page as a student screen so the recruiter desktop layout never applies to it,
 * even when a recruiter is signed in on the same browser.
 */
export function AreaMarker({ forceStudent }: { forceStudent?: boolean }) {
  const path = usePathname();
  return forceStudent || isStudentPath(path) ? <span data-student hidden /> : null;
}

type Props = {
  view: "auto" | "recruiter-phone" | "student";
  recruiterItems: DockItem[] | null;
  candidateItems: DockItem[] | null;
  logout: () => Promise<void>;
  candidateSignOut: () => Promise<void>;
};

/** Header and tab bar. Which set of navigation shows depends on the screen being viewed, not on who signed in last. */
export function HeaderBar({ view, recruiterItems, candidateItems, logout, candidateSignOut }: Props) {
  const path = usePathname();
  const student = view === "student" || (view === "auto" && isStudentPath(path));
  const items = student ? candidateItems : recruiterItems;
  const home = student ? (candidateItems ? "/me" : "/") : recruiterItems ? "/recruiter" : "/";
  return (
    <>
      <header className="glass no-print sticky top-0 z-40 border-b-[3px] border-ink">
        <div className="shell flex min-h-13 items-center gap-3 py-2">
          <Link href={home} className="rounded-md py-1" aria-label="TalentIQ home"><Wordmark size={24} /></Link>
          {!student && recruiterItems && <TopNav items={recruiterItems} />}
          <span className="pill ml-auto" title="Every candidate in this prototype is made up">Demo</span>
          {items ? (
            <form action={student ? candidateSignOut : logout}><button className="btn btn-quiet btn-sm">Sign out</button></form>
          ) : (
            <Link href={student && view === "student" ? "/find" : student ? "/find" : "/login"} className="btn btn-sm">{student ? "Find my profile" : "Sign in"}</Link>
          )}
        </div>
      </header>
      {items && <Dock items={items.filter((d) => d.href !== "/account")} />}
    </>
  );
}
