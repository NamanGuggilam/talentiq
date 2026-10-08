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
  const initial = {
    firstName: me.firstName, lastName: me.lastName, preferredName: me.preferredName ?? "", email: me.email, phone: me.phone ?? "", university: me.university ?? "",
    degreeProgram: me.degreeProgram ?? "", major: me.major ?? "", graduationDate: me.graduationDate ?? "", gpa: me.gpa ?? "", workAuthorization: me.workAuthorization ?? "",
    desiredFunction: me.desiredFunction ?? "", technicalInterests: (me.technicalInterests ?? []).join(", "), preferredLocations: (me.preferredLocations ?? []).join(", "),
    skills: (me.skills ?? []).join(", "), coursework: (me.coursework ?? []).join(", "), projects: (me.projects ?? []).join("\n"),
    github: me.links?.github ?? "", devpost: me.links?.devpost ?? "", credly: me.links?.credly ?? "", site: me.links?.site ?? "",
  };
  return (
    <div className="shell pb-10">
      <PageHead eyebrow="My profile" title="Edit profile" />
      <ProfileForm mode="edit" initial={initial} hasResume={resume?.fileName} consented={!!me.scrapeConsentAt} />
    </div>
  );
}
