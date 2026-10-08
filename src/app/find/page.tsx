import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FindForm } from "./FindForm";
import { PageHead } from "@/components/ui";
import { getCandidate, safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Find my profile" };

export default async function Find({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next, "/me");
  if (await getCandidate()) redirect(next);
  return (
    <div className="shell pb-10">
      <PageHead eyebrow="Students" title="Find my profile">
        <p>Use the recovery code you saved when you created your profile.</p>
      </PageHead>
      <FindForm next={next} />
      <p className="mt-6 text-sm text-muted">No profile yet? <Link className="link" href={`/signup?next=${encodeURIComponent(next)}`}>Create one</Link>. Lost your code? Create a new profile with a different email.</p>
    </div>
  );
}
