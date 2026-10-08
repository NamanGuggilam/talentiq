import type { Metadata } from "next";
import QRCode from "qrcode";
import { eq } from "drizzle-orm";
import { CopyButton, NfcWriteButton, PrintButton } from "./BadgeButtons";
import { TapReceiver } from "./TapReceiver";
import { Mark } from "@/components/Logo";
import { LivePulse } from "@/components/LivePulse";
import { PageHead } from "@/components/ui";
import { db, schema } from "@/db";
import { requireRecruiter } from "@/lib/auth";
import { appOrigin } from "@/lib/origin";

export const metadata: Metadata = { title: "My badge" };

export default async function Badge() {
  const me = await requireRecruiter();
  const origin = await appOrigin();
  const link = `${origin}/c/${me.connectToken}`;
  const [event] = me.eventId ? await db.select().from(schema.events).where(eq(schema.events.id, me.eventId)) : [];
  const [{ count }] = [{ count: (await db.select({ id: schema.connections.id }).from(schema.connections).where(eq(schema.connections.recruiterId, me.id))).length }];
  // Quartile error correction leaves room for the mark in the middle and survives a scuffed badge.
  const svg = await QRCode.toString(link, { type: "svg", errorCorrectionLevel: "Q", margin: 1, color: { dark: "#0d2b33", light: "#ffffff" } });

  return (
    <div className="shell pb-10">
      <div className="no-print">
        <PageHead title="My badge" actions={<><LivePulse initialCount={count} /><PrintButton /></>}>
        </PageHead>
      </div>

      <div className="grid items-start gap-6 desk:grid-cols-[26rem_minmax(0,1fr)]">
        <article className="card mx-auto w-full overflow-hidden !bg-white" aria-label="Badge">
          <div className="flex items-center justify-between gap-3 bg-accent px-5 py-3 text-accent-ink">
            <span className="flex items-center gap-2 text-lg font-bold">TalentIQ</span>
            <span className="text-sm font-semibold">{event?.company ?? "Recruiter"}</span>
          </div>
          <div className="px-6 pb-2 pt-6">
            <div className="relative mx-auto aspect-square w-full max-w-[19rem]">
              <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" role="img" aria-label={`QR code that opens the share page for ${me.name}`} dangerouslySetInnerHTML={{ __html: svg }} />
              <span className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white shadow-[0_0_0_4px_#fff]" aria-hidden="true"><Mark size={40} /></span>
            </div>
          </div>
          <div className="border-t border-line px-6 py-5 text-center">
            <p className="text-2xl font-bold leading-tight">{me.name}</p>
            <p className="mt-0.5 text-sm text-muted">{me.title ?? "Recruiter"}</p>
            <p className="mt-3 text-sm font-semibold text-accent-text">Scan to share your profile</p>
          </div>
        </article>

        <div className="no-print grid gap-4">
          {/* Tap to share is a phone feature: it is left out of the desktop layout. */}
          <div className="desk:hidden"><TapReceiver initialCount={count} /></div>
          <section className="card card-pad" aria-labelledby="nfc">
            <h2 id="nfc" className="text-xl font-semibold">NFC tag link</h2>
            
            <p className="mt-3 break-all rounded-md border border-line-strong bg-raised px-3 py-2 font-mono text-sm">{link}?m=nfc</p>
            <div className="mt-3 flex flex-wrap gap-2"><CopyButton text={`${link}?m=nfc`} /><NfcWriteButton url={`${link}?m=nfc`} /></div>
          </section>

        </div>
      </div>
    </div>
  );
}
