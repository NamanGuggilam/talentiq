import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, dbReady, schema } from "@/db";
import { LINK_KINDS, type LinkKind } from "@/db/schema";
import { LINK_LABEL } from "@/lib/scrape/sources";

export const metadata: Metadata = { title: "Demo profile page", robots: { index: false } };

/** A stand-in public profile for a synthetic candidate, so the link reader has a page to read in the demo. */
export default async function MockProfile({ params }: { params: Promise<{ kind: string; handle: string }> }) {
  const { kind, handle } = await params;
  if (!(LINK_KINDS as readonly string[]).includes(kind) || !/^[a-z0-9-]{1,39}$/.test(handle)) notFound();
  await dbReady;
  const [p] = await db.select().from(schema.mockProfiles).where(and(eq(schema.mockProfiles.kind, kind as LinkKind), eq(schema.mockProfiles.handle, handle)));
  if (!p) notFound();
  const f = p.facts;
  return (
    <div className="shell pb-12 pt-8">
      <p className="notice mb-6" data-tone="warn" role="note">Demo page. This stands in for a public {LINK_LABEL[p.kind]} profile of a made-up student. It is not a real site.</p>
      <p className="eyebrow">{LINK_LABEL[p.kind]} · /{handle}</p>
      <h1 className="mt-2 text-3xl font-bold">{p.displayName}</h1>

      {!!f.languages?.length && <p className="mt-3 flex flex-wrap gap-1.5">{f.languages.map((l) => <span key={l} className="tag">{l}</span>)}</p>}

      {!!f.repos?.length && (
        <section className="mt-8" aria-labelledby="repos"><h2 id="repos" className="text-xl font-semibold">Repositories</h2>
          <ul className="mt-3 grid gap-3">{f.repos.map((r) => <li key={r.name} className="card p-4"><p className="font-mono font-semibold">{r.name}</p><p className="mt-1 text-sm text-ink-2">{r.description}</p><p className="eyebrow mt-3">{[r.language, r.created && `created ${r.created}`, r.stars && `${r.stars} stars`].filter(Boolean).join(" · ")}</p></li>)}</ul>
        </section>
      )}
      {!!f.projects?.length && (
        <section className="mt-8" aria-labelledby="projects"><h2 id="projects" className="text-xl font-semibold">Projects</h2>
          <ul className="mt-3 grid gap-3">{f.projects.map((r) => <li key={r.title} className="card p-4"><p className="font-display text-lg font-semibold">{r.title}</p><p className="mt-1 text-sm text-ink-2">{[r.event, r.prize, r.teamSize && `team of ${r.teamSize}`].filter(Boolean).join(" · ")}</p></li>)}</ul>
        </section>
      )}
      {!!f.badges?.length && (
        <section className="mt-8" aria-labelledby="badges"><h2 id="badges" className="text-xl font-semibold">Badges</h2>
          <ul className="mt-3 grid gap-3">{f.badges.map((r) => <li key={r.name} className="card p-4"><p className="font-display text-lg font-semibold">{r.name}</p><p className="mt-1 text-sm text-ink-2">{[r.issuer, r.issued && `issued ${r.issued}`, r.expires && `expires ${r.expires}`].filter(Boolean).join(" · ")}</p></li>)}</ul>
        </section>
      )}

      <section className="mt-8" aria-labelledby="lines"><h2 id="lines" className="text-xl font-semibold">Page text</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-ink-2">{f.lines.map((l) => <li key={l}>{l}</li>)}</ul>
      </section>
    </div>
  );
}
