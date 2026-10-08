"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  people: <><circle cx="9" cy="8" r="3.25" /><path d="M2.75 19c.6-3.4 3.1-5.25 6.25-5.25S14.65 15.6 15.25 19" /><circle cx="17" cy="9" r="2.5" /><path d="M17.5 13.9c2 .3 3.3 1.7 3.75 4.1" /></>,
  review: <><rect x="3.5" y="4" width="17" height="16" rx="3.5" /><path d="M8 9.5h8M8 13h8M8 16.5h4.5" /></>,
  badge: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><path d="M13.5 13.5h3v3h-3zM20 13.5v6.5h-3.5" /></>,
  admin: <><path d="M5 7h14M5 12h14M5 17h14" /><circle cx="9" cy="7" r="2" fill="#fff" /><circle cx="15" cy="12" r="2" fill="#fff" /><circle cx="8" cy="17" r="2" fill="#fff" /></>,
  account: <><circle cx="12" cy="8.5" r="3.75" /><path d="M4.75 20c.9-3.9 3.7-6 7.25-6s6.35 2.1 7.25 6" /></>,
  line: <><circle cx="6" cy="7" r="2.25" /><circle cx="12" cy="7" r="2.25" /><circle cx="18" cy="7" r="2.25" /><path d="M4 18h16M4 14h10" /></>,
  tap: <><rect x="3.5" y="5" width="7" height="13" rx="2" /><rect x="13.5" y="6" width="7" height="13" rx="2" /><path d="M11.5 9.5c.7.8.7 2.2 0 3M12.5 12c-.7.8-.7 2.2 0 3" /></>,
  edit: <><path d="M5 19l1-4.25L16.25 4.5a1.75 1.75 0 0 1 2.5 0l.75.75a1.75 1.75 0 0 1 0 2.5L9.25 18z" /><path d="M14.5 6.25l3.25 3.25" /></>,
};

export type DockItem = { href: string; label: string; icon: keyof typeof ICONS; match?: string[] };

/** Floating bottom navigation, thumb-reachable on a phone. */
export function Dock({ items }: { items: DockItem[] }) {
  const path = usePathname();
  return (
    <nav className="dock glass no-print" aria-label="Main">
      {items.map((it) => {
        const active = path === it.href || (it.match ?? []).some((m) => path.startsWith(m));
        return (
          <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[it.icon]}</svg>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** The same destinations as the dock, laid out in the header for recruiters on a desktop. */
export function TopNav({ items }: { items: DockItem[] }) {
  const path = usePathname();
  return (
    <nav className="topnav ml-4 hidden items-center gap-1 desk:flex" aria-label="Main">
      {items.map((it) => {
        const active = path === it.href || (it.match ?? []).some((m) => path.startsWith(m));
        return <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined}>{it.label}</Link>;
      })}
    </nav>
  );
}
