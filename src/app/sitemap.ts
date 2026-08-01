import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/**
 * The landing page and the accessibility statement, and nothing else.
 *
 * Every other route is either behind a login or is somebody's private quote.
 * This file must never learn how to enumerate /q: a sitemap is a published
 * list, and publishing quote tokens would hand out the bearer tokens the whole
 * scheme depends on staying unguessable.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      /* The statement is meant to be findable, including from off the site. */
      url: `${SITE_URL}/accessibility`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
