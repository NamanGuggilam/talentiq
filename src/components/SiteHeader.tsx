import Link from "next/link";
import { candidateSignOut, logout } from "@/app/actions/auth";
import { getCandidate, getRecruiter } from "@/lib/auth";
import { Dock, TopNav, type DockItem } from "./Dock";
import { Wordmark } from "./Logo";
import { getView } from "@/lib/view";

export async function SiteHeader() {
  const [r, c, view] = await Promise.all([getRecruiter(), getCandidate(), getView()]);
  // On the student-only address the recruiter session is ignored for navigation, and the reverse on the recruiter phone address.
  const recruiter = view === "student" ? null : r;
  const candidate = view === "recruiter-phone" ? null : c;
  const home = recruiter ? "/recruiter" : candidate ? "/me" : "/";
  const dock: DockItem[] = recruiter
    ? [
        { href: "/recruiter", label: "People", icon: "people", match: ["/recruiter/c/"] },
        { href: "/dashboard", label: "Review", icon: "review", match: ["/compare"] },
        { href: "/recruiter/badge", label: "Badge", icon: "badge" },
        ...(recruiter.role === "coordinator" ? [{ href: "/admin", label: "Admin", icon: "admin" as const, match: ["/admin/"] }] : []),
        { href: "/account", label: "Account", icon: "account" },
      ]
    : candidate
      ? [{ href: "/me", label: "Profile", icon: "account" }, { href: "/line", label: "Line", icon: "line" }, { href: "/tap", label: "Tap", icon: "tap" }, { href: "/me/edit", label: "Edit", icon: "edit" }]
      : [];
  return (
    <>
      <header className="glass no-print sticky top-0 z-40 !border-x-0 !border-t-0">
        <div className="shell flex min-h-13 items-center gap-3 py-2">
          <Link href={home} className="rounded-md py-1" aria-label="TalentIQ home"><Wordmark size={24} /></Link>
          {recruiter && <TopNav items={dock} />}
          <span className="pill ml-auto" title="Every candidate in this prototype is made up">Demo data</span>
          {recruiter ? (
            <form action={logout}><button className="btn btn-quiet btn-sm">Sign out</button></form>
          ) : candidate ? (
            <form action={candidateSignOut}><button className="btn btn-quiet btn-sm">Sign out</button></form>
          ) : (
            <Link href={view === "student" ? "/find" : "/login"} className="btn btn-sm">{view === "student" ? "Find my profile" : "Sign in"}</Link>
          )}
        </div>
      </header>
      {dock.length > 0 && <Dock items={dock} />}
    </>
  );
}
