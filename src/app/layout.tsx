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

export const metadata: Metadata = {
  title: "תמחורולוג",
  description: "הצעות מחיר לבעלי מקצוע — שליחה בוואטסאפ, מעקב אחרי צפיות וסגירת עסקאות.",
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
