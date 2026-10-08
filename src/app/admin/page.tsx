import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq, isNull, or, sql } from "drizzle-orm";
import { EventForm, NewRecruiterForm, RecruiterRow, TagForm } from "./AdminForms";
import { removeTag } from "@/app/actions/admin";
import { PageHead } from "@/components/ui";
import { db, schema } from "@/db";
import { requireCoordinator } from "@/lib/auth";

export const metadata: Metadata = { title: "Admin" };

export default async function Admin() {
  const me = await requireCoordinator();
  const [events, people, tags, met] = await Promise.all([
    db.select().from(schema.events).orderBy(asc(schema.events.createdAt)),
    db.select().from(schema.recruiters).where(me.eventId ? or(eq(schema.recruiters.eventId, me.eventId), isNull(schema.recruiters.eventId)) : isNull(schema.recruiters.eventId)).orderBy(asc(schema.recruiters.name)),
    me.eventId ? db.select().from(schema.tags).where(eq(schema.tags.eventId, me.eventId)).orderBy(asc(schema.tags.position)) : [],
    db.select({ id: schema.connections.recruiterId, n: sql<number>`count(*)::int` }).from(schema.connections).groupBy(schema.connections.recruiterId),
  ]);
  const count = new Map(met.map((m) => [m.id, m.n]));
  const event = events.find((e) => e.id === me.eventId);

  return (
    <div className="shell pb-12">
      <PageHead eyebrow={event ? `${event.name} · ${event.company}` : "No event selected"} title="Admin" actions={<Link href="/admin/study" className="btn btn-primary">Study and measures</Link>}>
        <p>Set up the people, the tag list and the event before the fair opens.</p>
      </PageHead>

      <div className="grid gap-5">
        <section className="card card-pad" aria-labelledby="people">
          <h2 id="people" className="text-xl font-semibold">Recruiters and coordinators</h2>
          <ul className="mt-2 divide-y divide-dashed divide-line">
            {people.map((r) => <RecruiterRow key={r.id} self={r.id === me.id} events={events.map((e) => ({ id: e.id, name: e.name }))} r={{ id: r.id, name: r.name, title: r.title, email: r.email, role: r.role, disabled: !!r.disabledAt, met: count.get(r.id) ?? 0, eventId: r.eventId }} />)}
          </ul>
          <hr className="rule my-5" />
          <h3 className="font-display text-lg font-semibold">Add someone</h3>
          <p className="hint mb-3">They get a temporary password, shown to you once. Passwords are stored only as a salted hash.</p>
          <NewRecruiterForm />
        </section>

        <section className="card card-pad" aria-labelledby="tags">
          <h2 id="tags" className="text-xl font-semibold">Booth tags</h2>
          <p className="hint mt-1">One-tap labels recruiters use during a conversation. Keep them factual: topics, role types and logistics.</p>
          <ul className="my-4 flex flex-wrap gap-2">
            {tags.map((t) => (
              <li key={t.id}>
                <form action={removeTag} className="inline-flex items-center overflow-hidden rounded-full border border-line-strong bg-raised">
                  <input type="hidden" name="id" value={t.id} />
                  <span className="py-1 pl-3 pr-1 text-sm font-medium">{t.label}</span>
                  <button className="grid h-8 w-8 place-items-center text-muted hover:bg-bad-bg hover:text-bad" aria-label={`Remove tag ${t.label}`}><svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></button>
                </form>
              </li>
            ))}
            {tags.length === 0 && <li className="text-muted">No tags yet.</li>}
          </ul>
          <TagForm />
        </section>

        <section className="card card-pad" aria-labelledby="events">
          <h2 id="events" className="text-xl font-semibold">Events</h2>
          <ul className="my-3 divide-y divide-dashed divide-line">
            {events.map((e) => <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5"><span><span className="font-medium">{e.name}</span><span className="text-muted"> · {e.company}</span></span>{e.id === me.eventId && <span className="pill" data-tone="accent">Your event</span>}</li>)}
          </ul>
          <EventForm />
        </section>
      </div>
    </div>
  );
}
