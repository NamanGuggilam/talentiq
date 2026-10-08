import type { Metadata } from "next";
import { PasswordForm } from "./PasswordForm";
import { PageHead, Pill } from "@/components/ui";
import { requireRecruiter } from "@/lib/auth";

export const metadata: Metadata = { title: "Account" };

export default async function Account() {
  const me = await requireRecruiter();
  return (
    <div className="shell pb-10">
      <PageHead eyebrow="Account" title={me.name}>
        <p className="flex flex-wrap items-center gap-2">{me.email} <Pill plain>{me.role}</Pill></p>
      </PageHead>
      <section className="card card-pad" aria-labelledby="pw">
        <h2 id="pw" className="text-xl font-semibold">Change password</h2>
        <p className="hint mt-1">At least 12 characters. Changing it signs out your other devices.</p>
        <div className="mt-4"><PasswordForm /></div>
      </section>
    </div>
  );
}
