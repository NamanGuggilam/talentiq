import { desc, eq } from "drizzle-orm";
import { db, dbReady, schema } from "@/db";
import type { LinkKind } from "@/db/schema";
import { textToLines } from "@/lib/scrape/sources";
import { checkClaims, extractClaims, findExtras, type EvidenceInput } from "@/lib/ai";
import { FetchBlocked } from "@/lib/scrape/safeFetch";
import { readLink } from "@/lib/scrape/sources";
import { track } from "@/lib/metrics";

/**
 * Rebuild a candidate's claims and evidence: pull checkable claims from the resume, read the pages they linked
 * (only with consent), then compare. Safe to re-run; it replaces the previous result.
 */
export async function runEvidencePipeline(candidateId: string): Promise<void> {
  await dbReady;
  const [c] = await db.select().from(schema.candidates).where(eq(schema.candidates.id, candidateId));
  if (!c) return;
  await db.update(schema.candidates).set({ evidenceState: "running" }).where(eq(schema.candidates.id, candidateId));
  try {
    const [resume] = await db.select().from(schema.resumes).where(eq(schema.resumes.candidateId, candidateId)).orderBy(desc(schema.resumes.uploadedAt)).limit(1);
    const resumeText = resume?.extractedText ?? "";
    const drafts = resumeText.trim() ? await extractClaims(resumeText) : [];

    await db.delete(schema.claims).where(eq(schema.claims.candidateId, candidateId));
    await db.delete(schema.evidenceSources).where(eq(schema.evidenceSources.candidateId, candidateId));

    const evidence: EvidenceInput[] = [];
    if (c.scrapeConsentAt) {
      for (const [kind, url] of Object.entries(c.links ?? {}) as [LinkKind, string][]) {
        if (!url) continue;
        try {
          const facts = await readLink(kind, url);
          const [row] = await db.insert(schema.evidenceSources).values({ candidateId, kind, url, fetchStatus: "ok", fetchedAt: new Date(), extracted: facts }).returning();
          evidence.push({ sourceId: row.id, kind, url, facts });
        } catch (e) {
          const blocked = e instanceof FetchBlocked;
          await db.insert(schema.evidenceSources).values({ candidateId, kind, url, fetchStatus: blocked ? "blocked" : "failed", fetchedAt: new Date(), error: blocked ? e.message : "The page could not be read." });
          if (!blocked) console.error("evidence fetch", kind, e);
        }
      }
    }

    // Files the student uploaded with their resume are read the same way as a linked page.
    for (const d of await db.select().from(schema.documents).where(eq(schema.documents.candidateId, candidateId))) {
      const facts = { title: d.fileName, lines: textToLines(d.extractedText) };
      const [row] = await db.insert(schema.evidenceSources).values({ candidateId, kind: "file", url: d.fileName, fetchStatus: facts.lines.length ? "ok" : "failed", fetchedAt: new Date(), extracted: facts, error: facts.lines.length ? null : "No readable text in that file." }).returning();
      if (facts.lines.length) evidence.push({ sourceId: row.id, kind: "file", url: d.fileName, facts });
    }

    const [checks, extras] = await Promise.all([checkClaims(drafts, evidence), findExtras(resumeText, evidence)]);
    const rows = [
      ...drafts.map((d, i) => ({
        candidateId, kind: "resume_claim" as const, type: d.type, text: d.text.slice(0, 400), resumeQuote: d.resumeQuote.slice(0, 400), position: i,
        status: checks[i].status, evidenceSourceId: checks[i].sourceId, evidenceQuote: checks[i].evidenceQuote?.slice(0, 400) ?? null,
        explanation: checks[i].explanation.slice(0, 400), suggestedQuestion: checks[i].suggestedQuestion?.slice(0, 300) ?? null,
      })),
      ...extras.map((x, i) => ({
        candidateId, kind: "found_not_on_resume" as const, type: x.type, text: x.text.slice(0, 200), resumeQuote: null, position: drafts.length + i,
        status: "verified" as const, evidenceSourceId: x.sourceId, evidenceQuote: x.evidenceQuote.slice(0, 400), explanation: "On a linked page, not on the resume.", suggestedQuestion: null,
      })),
    ];
    if (rows.length) await db.insert(schema.claims).values(rows);
    await db.update(schema.candidates).set({ evidenceState: "done" }).where(eq(schema.candidates.id, candidateId));
    await track("evidence_checked", { payload: { candidateId, claims: drafts.length, pages: evidence.length, extras: extras.length } });
  } catch (e) {
    console.error("evidence pipeline", e);
    await db.update(schema.candidates).set({ evidenceState: "failed" }).where(eq(schema.candidates.id, candidateId));
  }
}
