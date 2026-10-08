import { candidateSignOut, logout } from "@/app/actions/auth";
import { getCandidate, getRecruiter } from "@/lib/auth";
import { getView } from "@/lib/view";
import type { DockItem } from "./Dock";
import { HeaderBar } from "./HeaderBar";

export async function SiteHeader() {
  const [recruiter, candidate, view] = await Promise.all([getRecruiter(), getCandidate(), getView()]);
  // Both sets are prepared; the header picks one by the screen being viewed. A browser can hold a recruiter
  // session and a student session at once (for example when demoing both sides on one laptop).
  const recruiterItems: DockItem[] | null = recruiter && view !== "student"
    ? [
        { href: "/recruiter", label: "People", icon: "people", match: ["/recruiter/c/"] },
        { href: "/dashboard", label: "Review", icon: "review", match: ["/compare"] },
        { href: "/recruiter/badge", label: "Badge", icon: "badge" },
        ...(recruiter.role === "coordinator" ? [{ href: "/admin", label: "Admin", icon: "admin" as const, match: ["/admin/"] }] : []),
        { href: "/account", label: "Account", icon: "account" },
      ]
    : null;
  const candidateItems: DockItem[] | null = candidate && view !== "recruiter-phone"
    ? [{ href: "/me", label: "Profile", icon: "account" }, { href: "/line", label: "Line", icon: "line" }, { href: "/tap", label: "Tap", icon: "tap" }, { href: "/me/edit", label: "Edit", icon: "edit" }]
    : null;
  return <HeaderBar view={view} recruiterItems={recruiterItems} candidateItems={candidateItems} logout={logout} candidateSignOut={candidateSignOut} />;
}
