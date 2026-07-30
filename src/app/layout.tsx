import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";

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
  themeColor: "#1d4ed8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${rubik.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
