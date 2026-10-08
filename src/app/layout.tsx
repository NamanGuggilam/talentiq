import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Zen_Kaku_Gothic_New } from "next/font/google";
import { AreaMarker } from "@/components/HeaderBar";
import { SiteHeader } from "@/components/SiteHeader";
import { getRecruiter } from "@/lib/auth";
import { getView } from "@/lib/view";
import "./globals.css";

// Chakra Petch: angular, cut terminals, made to lean. Zen Kaku Gothic New: a calm, slightly square body face.
const display = Chakra_Petch({ variable: "--font-display-face", subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"] });
const body = Zen_Kaku_Gothic_New({ variable: "--font-body", subsets: ["latin"], weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: { default: "TalentIQ", template: "%s · TalentIQ" },
  description: "Career-fair candidate capture with sourced summaries and human sign-off. A capstone prototype running on synthetic data.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "TalentIQ", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#39c5bb", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Signed-in recruiters get the desktop layout on wide screens; everyone else stays in the phone layout.
  const staff = (await getView()) === "auto" && !!(await getRecruiter());
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className={`flex min-h-full flex-col ${staff ? "is-staff" : ""}`}>
        <AreaMarker />
        <a href="#main" className="skip-link">Skip to content</a>
        <SiteHeader />
        <main id="main" className="flex-1 pb-28">{children}</main>
      </body>
    </html>
  );
}
