import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";

import { AccessibilityWidget } from "@/components/a11y/accessibility-widget";
import { A11ySettingsScript } from "@/components/a11y/settings-script";

import "./globals.css";

/*
 * Rubik carries the Hebrew and the Latin on one variable file, so a price in
 * digits and the word next to it are the same typeface rather than a fallback
 * seam. Weights are pinned to the three the scale actually uses; loading the
 * full axis would ship weights nothing renders.
 */
const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const SITE_NAME = "תמחורולוג";
const SITE_DESCRIPTION =
  "הצעות מחיר לבעלי מקצוע — שליחה בוואטסאפ, מעקב אחרי צפיות וסגירת עסקאות.";

export const metadata: Metadata = {
  /*
   * Everything metadata resolves — og:url, canonical, the generated image URLs
   * — is absolute, and without a base Next has to guess the origin. Vercel
   * gives every deployment its own hostname, so the guess would pin cards and
   * canonicals to whichever preview build happened to render them.
   */
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://tamchurolog.vercel.app",
  ),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "he_IL",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  /*
   * One value painted the phone's address bar brand blue in both schemes, which
   * on a dark home screen reads as a bright band the OS did not ask for. The
   * dark entry matches the surface a dark-mode browser draws around the page.
   *
   * The site itself is still light-only by design; this is about the browser
   * chrome above it, not the page.
   */
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1d4ed8" },
    { media: "(prefers-color-scheme: dark)", color: "#101828" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${rubik.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/*
          Before anything renders: a visitor who chose high contrast should
          never see a frame of the ordinary page first.
        */}
        <A11ySettingsScript />

        {/*
          The skip link, first in the tab order of every page in the app.
          Hidden until focused, which is the only moment it has anything to
          say. Fixed rather than absolute so it lands in the same corner
          whatever the page's own positioning happens to be.
        */}
        <a
          href="#main"
          className="sr-only rounded-control bg-brand px-4 py-2 font-semibold text-brand-foreground focus:not-sr-only focus:fixed focus:top-3 focus:right-3 focus:z-50"
        >
          דילוג לתוכן
        </a>

        {children}

        {/*
          Last in the DOM, so the menu is the final thing a screen reader
          reaches rather than an interruption before the page itself.
        */}
        <AccessibilityWidget />
      </body>
    </html>
  );
}
