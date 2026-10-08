import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { deleteMyData } from "@/app/actions/candidate";
import { ClaimPill, Notice, PageHead, Pill, displayName, fmtDate } from "@/components/ui";
import { Refresher } from "@/components/Refresher";
import { db, schema } from "@/db";
import { requireCandidate } from "@/lib/auth";
import { LINK_LABEL } from "@/lib/scrape/sources";

export const metadata: Metadata = { title: "My profile" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-line py-3">
      <dt className="eyebrow pt-0.5">{label}</dt>
      <dd className="min-w-0 break-words">{children || <span className="text-muted">Not provided</span>}</dd>
    </div>
  );
}
const chips = (list: string[] | null | undefined) => (list?.length ? <span className="flex flex-wrap gap-1.5">{list.map((s) => <span key={s} className="tag">{s}</span>)}</span> : null);

export default async function Me({ searchParams }: { searchParams: Promise<{ saved?: string; delete?: string }> }) {
  const me = await requireCandidate();
  const sp = await searchParams;
  const [resumes, shared, sources, claims] = await Promise.all([
    db.select({ id: schema.resumes.id, fileName: schema.resumes.fileName, uploadedAt: schema.resumes.uploadedAt }).from(schema.resumes).where(eq(schema.resumes.candidateId, me.id)).orderBy(desc(schema.resumes.uploadedAt)).limit(1),
    db.select({ id: schema.connections.id, recruiterId: schema.connections.recruiterId, at: schema.connections.consentedAt, name: schema.recruiters.name, title: schema.recruiters.title, event: schema.events.name, company: schema.events.company })
      .from(schema.connections).innerJoin(schema.recruiters, eq(schema.connections.recruiterId, schema.recruiters.id)).leftJoin(schema.events, eq(schema.connections.eventId, schema.events.id))
      .where(eq(schema.connections.candidateId, me.id)).orderBy(desc(schema.connections.consentedAt)),
    db.select().from(schema.evidenceSources).where(eq(schema.evidenceSources.candidateId, me.id)),
    db.select().from(schema.claims).where(eq(schema.claims.candidateId, me.id)).orderBy(schema.claims.position),
  ]);
  const resume = resumes[0];
  const links = Object.entries(me.links ?? {}) as [keyof typeof LINK_LABEL, string][];
  const checked = claims.filter((c) => c.kind === "resume_claim" && c.status !== "not_checked");

  return (
    <div className="shell pb-10">
      <PageHead eyebrow="My profile" title={displayName(me)} actions={<><Link href="/tap" className="btn btn-primary">Tap to share</Link><Link href="/me/edit" className="btn">Edit profile</Link></>}>
        <p>{[me.major, me.university, me.graduationDate && `graduating ${me.graduationDate}`].filter(Boolean).join(" · ") || "Add your details so recruiters have the full picture."}</p>
      </PageHead>

      <div className="grid gap-5">
        {sp.saved && <Notice tone="ok">Your changes are saved.</Notice>}
        {sp.delete && <Notice tone="warn" role="alert">Type DELETE in the box to confirm. Nothing has been removed.</Notice>}

        <section className="card card-pad" aria-labelledby="shared">
          <h2 id="shared" className="text-xl font-semibold">Who can see your profile</h2>
          {shared.length === 0 ? (
            <p className="mt-2 text-ink-2">No one yet. Scan a recruiter&apos;s badge to join their line, then tap phones at the booth to share.</p>
          ) : (
            <ul className="mt-3 divide-y divide-dashed divide-line">
              {shared.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span><span className="font-semibold">{s.name}</span><span className="text-muted">{s.title ? `, ${s.title}` : ""} · {s.company ?? "Recruiter"}</span></span>
                  <span className="flex items-center gap-3"><span className="eyebrow">Shared {fmtDate(s.at)}</span><a className="link text-sm" href={`/api/contact/${s.recruiterId}`} download>Save contact</a></span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card card-pad" aria-labelledby="details">
          <h2 id="details" className="text-xl font-semibold">Your details</h2>
          <dl className="mt-3">
            <Row label="Email">{me.email}</Row>
            <Row label="Phone">{me.phone}</Row>
            <Row label="Degree">{[me.degreeProgram, me.major].filter(Boolean).join(", ")}</Row>
            <Row label="University">{me.university}</Row>
            <Row label="Graduation">{me.graduationDate}</Row>
            <Row label="GPA">{me.gpa}</Row>
            <Row label="Looking for">{me.desiredFunction}</Row>
            <Row label="Interests">{chips(me.technicalInterests)}</Row>
            <Row label="Locations">{chips(me.preferredLocations)}</Row>
            <Row label="Work authorization">{me.workAuthorization}</Row>
            <Row label="Skills">{chips(me.skills)}</Row>
            <Row label="Coursework">{chips(me.coursework)}</Row>
            <Row label="Projects">{me.projects?.length ? <ul className="list-disc space-y-1 pl-5">{me.projects.map((p) => <li key={p}>{p}</li>)}</ul> : null}</Row>
            <Row label="Resume">{resume ? <a className="link" href={`/api/resume/${resume.id}`}>{resume.fileName}</a> : null}</Row>
          </dl>
        </section>

        <section className="card card-pad" aria-labelledby="links">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="links" className="text-xl font-semibold">Links and what we read</h2>
            {me.scrapeConsentAt ? <Pill tone="ok">Reading allowed</Pill> : <Pill tone="outline">Reading off</Pill>}
          </div>
          {links.length === 0 ? (
            <p className="mt-2 text-ink-2">You have not added any links. <Link className="link" href="/me/edit#github">Add a link</Link> to back up your resume with your own public work.</p>
          ) : (
            <ul className="mt-3 divide-y divide-dashed divide-line">
              {links.map(([kind, url]) => {
                const src = sources.find((s) => s.kind === kind);
                return (
                  <li key={kind} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span className="min-w-0"><span className="eyebrow mr-2">{LINK_LABEL[kind]}</span><a className="link break-all" href={url} rel="noreferrer noopener" target={url.startsWith("/") ? undefined : "_blank"}>{url.replace(/^https:\/\//, "")}</a></span>
                    {!me.scrapeConsentAt ? <Pill tone="outline">Not read</Pill> : !src ? <Pill tone="outline">Waiting</Pill> : src.fetchStatus === "ok" ? <Pill tone="ok">Read {fmtDate(src.fetchedAt)}</Pill> : <Pill tone="warn">{src.error ?? "Could not be read"}</Pill>}
                  </li>
                );
              })}
            </ul>
          )}
          {me.evidenceState === "running" && <p className="mt-3 flex items-center gap-2 text-sm text-muted"><span className="spinner" />Checking your resume against your links…<Refresher every={3000} /></p>}
          {checked.length > 0 && (
            <details className="mt-4 rounded-md border border-line bg-raised">
              <summary className="flex items-center justify-between gap-2 px-4 py-3 font-medium">What recruiters see from your links <span className="eyebrow">{checked.length} checked</span></summary>
              <ul className="divide-y divide-dashed divide-line border-t border-line px-4">
                {checked.map((c) => (
                  <li key={c.id} className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2"><p className="min-w-0 font-medium">{c.text}</p><ClaimPill status={c.status} /></div>
                    {c.explanation && <p className="mt-1 text-sm text-ink-2">{c.explanation}</p>}
                  </li>
                ))}
              </ul>
              <p className="border-t border-line px-4 py-3 text-sm text-muted">A difference is shown to the recruiter as a question to ask you, never as a reason to turn you down.</p>
            </details>
          )}
        </section>

        <section className="card card-pad border-bad/40" aria-labelledby="delete">
          <h2 id="delete" className="text-xl font-semibold">Delete my data</h2>
          <p className="mt-2 text-ink-2">This removes your profile, resume, links, and every recruiter&apos;s notes and summary about you. It cannot be undone.</p>
          <form action={deleteMyData} className="mt-4 flex flex-wrap items-end gap-3">
            <div className="field"><label htmlFor="confirm" className="label">Type DELETE to confirm</label><input id="confirm" name="confirm" autoComplete="off" className="input w-44 font-mono uppercase" /></div>
            <button className="btn btn-danger">Delete everything</button>
          </form>
        </section>
      </div>
    </div>
  );
}
