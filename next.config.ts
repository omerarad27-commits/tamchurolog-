import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

/*
 * Response headers that are the same for every request.
 *
 * Content-Security-Policy is deliberately NOT here any more. It carries a
 * per-request nonce, so it has to be built where the request is — proxy.ts,
 * which now matches /q as well precisely so the policy reaches every document.
 * Setting a second, weaker CSP here would not soften that one either: a browser
 * given two policies enforces both, and the result is their intersection.
 */
const securityHeaders = [
  // Stop a browser from second-guessing a declared Content-Type. Cheap, and the
  // logo bucket accepts SVG, which is the file type this matters most for.
  { key: "X-Content-Type-Options", value: "nosniff" },

  /*
   * Nothing here belongs in a frame. This one is not decoration: the public
   * quote page carries an approve button that forms a contract, and framing it
   * under a transparent overlay is the textbook way to harvest a click.
   *
   * Kept alongside the CSP's frame-ancestors, which supersedes it in every
   * current browser, because this header also covers the paths the proxy
   * matcher skips.
   */
  { key: "X-Frame-Options", value: "DENY" },

  /*
   * Severs window.opener for anything this site opens, and isolates the
   * browsing context group from cross-origin pages that try to reach into it.
   */
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },

  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  /*
   * X-Powered-By: Next.js tells a scanner which framework and therefore which
   * advisories to try. It buys nothing.
   */
  poweredByHeader: false,

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },

      /*
       * The quote link and the questionnaire link are both bearer tokens in a
       * URL. strict-origin-when-cross-origin would still send the full path to
       * a same-origin destination, and no outbound navigation from either page
       * may carry the token in a Referer header.
       */
      {
        source: "/q/:public_token*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      {
        source: "/f/:public_token*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },

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
