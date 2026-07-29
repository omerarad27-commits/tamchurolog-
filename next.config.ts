import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  images: {
    // Business logos are served from the public Supabase Storage bucket.
    // Derived from the env var so staging and production projects both work
    // without editing this file.
    remotePatterns: supabaseUrl
      ? [new URL(`${supabaseUrl}/storage/v1/object/public/**`)]
      : [],
  },

  experimental: {
    serverActions: {
      /*
       * Server Actions default to a 1MB request body. The logo upload allows
       * files up to 2MB, so anything between the two was rejected by the
       * framework before our own validation could run, and the owner saw a
       * generic failure instead of a useful message.
       *
       * Set above the 3.5MB we accept on purpose: the limit counts the raw
       * multipart body, including boundaries and part headers, so a file of
       * exactly 3.5MB arrives slightly larger. The headroom means our Hebrew
       * "file too big" message is what an oversized upload actually hits.
       *
       * Do not raise this much further. Vercel rejects any request body over
       * 4.5MB with a 413 before our code ever runs.
       */
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
