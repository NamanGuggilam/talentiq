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
      <PageHead eyebrow="2 minutes" title="Your profile">
        <p>Have one already? <Link className="link" href={`/find?next=${encodeURIComponent(next)}`}>Find my profile</Link>.</p>
      </PageHead>
      <ProfileForm mode="create" next={next} existing={existing} />
    </div>
  );
}
