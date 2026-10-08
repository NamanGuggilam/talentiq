import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { ProfileForm } from "@/components/ProfileForm";
import { PageHead } from "@/components/ui";
import { db, schema } from "@/db";
import { requireCandidate } from "@/lib/auth";

export const metadata: Metadata = { title: "Edit profile" };
export const maxDuration = 60;

export default async function EditProfile() {
  const me = await requireCandidate("/me/edit");
  const [resume] = await db.select({ fileName: schema.resumes.fileName }).from(schema.resumes).where(eq(schema.resumes.candidateId, me.id)).orderBy(desc(schema.resumes.uploadedAt)).limit(1);
  const files = (await db.select({ fileName: schema.documents.fileName }).from(schema.documents).where(eq(schema.documents.candidateId, me.id))).map((f) => f.fileName);
  const initial = { firstName: me.firstName, lastName: me.lastName, email: me.email, desiredFunction: me.desiredFunction ?? "", links: Object.values(me.links ?? {}).join("\n") };
  return (
    <div className="shell pb-10">
      <PageHead title="Edit" />
      <ProfileForm mode="edit" initial={initial} hasResume={resume?.fileName} hasFiles={files} consented={!!me.scrapeConsentAt} />
    </div>
  );
}
