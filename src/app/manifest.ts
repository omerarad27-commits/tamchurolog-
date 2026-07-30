import type { MetadataRoute } from "next";

import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

/**
 * Enough of a manifest for "add to home screen" to produce an app-like icon
 * and a chrome-less window, which is the whole claim the product makes about
 * working from a phone. Not a PWA: there is no service worker and nothing here
 * works offline, and pretending otherwise would be worse than not trying.
 *
 * The icons point at the generated /icon and /apple-icon routes rather than
 * committed PNGs, so there is one definition of the mark instead of three
 * copies that drift.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — הצעות מחיר לבעלי מקצוע`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f5f6f8",
    theme_color: "#1d4ed8",
    lang: "he",
    dir: "rtl",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
