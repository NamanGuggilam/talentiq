import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { TapShare } from "./TapShare";
import { PageHead } from "@/components/ui";
import { db, schema } from "@/db";
import { requireCandidate } from "@/lib/auth";
import { placesFor } from "@/lib/line";

export const metadata: Metadata = { title: "Tap to share" };

export default async function Tap() {
  const me = await requireCandidate("/tap");
  const [resume] = await db.select({ fileName: schema.resumes.fileName }).from(schema.resumes).where(eq(schema.resumes.candidateId, me.id)).orderBy(desc(schema.resumes.uploadedAt)).limit(1);
  const called = (await placesFor(me.id)).find((p) => p.status === "called");
  return (
    <div className="shell pb-10">
      <PageHead title="Tap to share" />
      <TapShare resumeName={resume?.fileName ?? null} linkCount={Object.keys(me.links ?? {}).length} calledBy={called?.recruiterName} />
    </div>
  );
}
