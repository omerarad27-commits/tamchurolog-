/**
 * The site's own address.
 *
 * Vercel gives every deployment a unique hostname, so anything that has to be
 * absolute — canonical tags, sitemap entries, the og:image URL — has to be told
 * where "here" really is, or it pins itself to whichever preview build happened
 * to render it.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://tamchurolog.vercel.app";

export const SITE_NAME = "תמחורולוג";

export const SITE_DESCRIPTION =
  "הצעות מחיר לבעלי מקצוע — שליחה בוואטסאפ, מעקב אחרי צפיות וסגירת עסקאות.";
