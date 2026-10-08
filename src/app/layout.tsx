import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { getRecruiter } from "@/lib/auth";
import { getView } from "@/lib/view";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "TalentIQ", template: "%s · TalentIQ" },
  description: "Career-fair candidate capture with sourced summaries and human sign-off. A capstone prototype running on synthetic data.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "TalentIQ", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#f3f7f7", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Signed-in recruiters get the desktop layout on wide screens; everyone else stays in the phone layout.
  const staff = (await getView()) === "auto" && !!(await getRecruiter());
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className={`flex min-h-full flex-col ${staff ? "is-staff" : ""}`}>
        <a href="#main" className="skip-link">Skip to content</a>
        <SiteHeader />
        <main id="main" className="flex-1 pb-28">{children}</main>
        <footer className="no-print pb-28">
          <p className="shell text-center text-xs text-muted">TalentIQ organises information. People make every hiring decision.</p>
        </footer>
      </body>
    </html>
  );
}
