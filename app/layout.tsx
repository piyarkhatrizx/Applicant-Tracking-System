import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-nav";

/**
 * One family, three weights — exactly what the type scale uses.
 * Drawn for technical interfaces: real tabular figures and letterforms that
 * stay distinct at 13px, which is the size the lead queue runs at.
 */
const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Korosha",
  description: "Applicant tracking for a caregiver recruiting team. Speed to first contact.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${plex.variable}`}>
      <body className="flex min-h-full flex-col">
        <a href="#main" className="k-skip-link">Skip to content</a>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
