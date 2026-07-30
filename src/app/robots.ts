import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/**
 * There is exactly one page on this site that belongs in a search index.
 *
 * /q carries noindex in its own metadata already, and that remains the real
 * guarantee: robots.txt is a request, not an access control, and a disallow
 * here would actually stop a crawler from ever seeing the noindex tag. Both are
 * listed because they fail in different directions — the tag stops indexing by
 * a crawler that reads the page, this stops a well-behaved crawler reaching it
 * at all — and a quote leaking into search results is the worst outcome this
 * codebase has.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/q/", "/dashboard/", "/login", "/signup"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
