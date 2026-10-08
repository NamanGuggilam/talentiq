import type { Metadata } from "next";
import Link from "next/link";
import { ProfileForm } from "@/components/ProfileForm";
import { PageHead } from "@/components/ui";
import { getCandidate, safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Create your profile" };
export const maxDuration = 60;

export default async function Signup({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next, "/line");
  // No redirect when a profile already exists: right after signup this page re-renders, and the form must stay
  // mounted so the one-time recovery code remains on screen.
  const existing = !!(await getCandidate());
  return (
    <div className="shell pb-10">
      <PageHead eyebrow="Students · about two minutes" title="Create your profile">
        <p>Start with your resume and we fill in the form. You can edit everything before saving. Already have one? <Link className="link" href={`/find?next=${encodeURIComponent(next)}`}>Find my profile</Link>.</p>
      </PageHead>
      <ProfileForm mode="create" next={next} existing={existing} />
    </div>
  );
}
