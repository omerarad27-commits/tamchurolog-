import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

/*
 * Response headers.
 *
 * All of these are static, which is why they live here rather than in proxy.ts:
 * next.config covers every route, and the proxy matcher deliberately excludes
 * /q/, the one page a client ever sees.
 *
 * On Content-Security-Policy, and why there isn't one yet: the only CSP worth
 * enforcing on a Next application is nonce based, because the framework emits
 * inline scripts for hydration and the RSC payload, and a static policy has to
 * allow 'unsafe-inline' to boot at all, which gives up most of what CSP is for.
 * A nonce has to be minted per request, which means the proxy, which does not
 * run on /q/. Covering /q/ is a deliberate reversal of a documented performance
 * decision, so it is its own piece of work rather than a line in this file. A
 * report-only policy full of 'unsafe-inline' was the other option and it would
 * have looked like protection while enforcing nothing.
 */
const securityHeaders = [
  // Stop a browser from second-guessing a declared Content-Type. Cheap, and the
  // logo bucket accepts SVG, which is the file type this matters most for.
  { key: "X-Content-Type-Options", value: "nosniff" },

  /*
   * Nothing here belongs in a frame. This one is not decoration: the public
   * quote page carries an approve button that forms a contract, and framing it
   * under a transparent overlay is the textbook way to harvest a click.
   */
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },

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
       * The quote link is a bearer token in a URL. strict-origin-when-cross-
       * origin would still send the full path to a same-origin destination, and
       * any outbound navigation from this page must not carry the token in a
       * Referer header at all.
       */
      {
        source: "/q/:public_token*",
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
