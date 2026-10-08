import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";
import { Mark } from "@/components/Logo";
import { getRecruiter, safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Recruiter sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next, "/recruiter");
  if (await getRecruiter()) redirect(next);
  return (
    <div className="flex min-h-[70vh] items-center py-12">
      <div className="shell">
        <div className="card card-pad rise">
          <Mark size={44} live />
          <p className="eyebrow mt-5">Recruiters and coordinators</p>
          <h1 className="mt-2 text-3xl font-bold">Sign in</h1>
          <p className="mt-2 text-ink-2">Accounts are created by your recruiting coordinator.</p>
          <div className="mt-6"><LoginForm next={next} /></div>
        </div>
      </div>
    </div>
  );
}
