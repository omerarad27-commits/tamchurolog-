import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicEnv } from "@/lib/env";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { AUTH_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";

/** Routes that only make sense when signed out. */
const AUTH_ROUTES = ["/login", "/signup"];

/** Route prefixes that require a session. */
const PROTECTED_PREFIXES = ["/dashboard"];

/**
 * Where the logos come from. Derived rather than hardcoded so staging and
 * production projects both work without editing this file.
 */
const SUPABASE_ORIGIN = new URL(publicEnv.supabaseUrl).origin;

/**
 * Builds the Content-Security-Policy for one request.
 *
 * The nonce is the point of the whole exercise. Next emits inline scripts for
 * hydration and the RSC payload, so the only two options were 'unsafe-inline',
 * which permits exactly the injection CSP exists to stop, or a per-request
 * nonce. Next reads the nonce back out of this header during rendering and
 * stamps it onto every script tag it emits, so nothing here needs maintaining
 * as the bundle changes.
 *
 * 'strict-dynamic' means 'self' is ignored for scripts: a tag is trusted
 * because it carries the nonce, not because of where it came from. That is what
 * makes an injected <script src="/uploads/evil.js"> fail even though it is
 * same-origin.
 *
 * style-src keeps 'unsafe-inline' on purpose. React writes real style
 * attributes — next/image sets one on every image, and the close-rate bar on
 * the stats page is another — and style-src covers attributes as well as
 * elements, so a nonce-only policy would blank out images across the app. CSS
 * injection is a defacement risk, script injection is an account-takeover risk,
 * and paying for the second with the first is not a trade worth making.
 */
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";

  return [
    "default-src 'self'",
    // 'unsafe-eval' in development only: React rebuilds server error stacks
    // with eval to make them readable in the browser. Production needs none.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // Optimised images are served from /_next/image, so 'self' covers the
    // common path; the bucket origin is listed for any image that bypasses it.
    `img-src 'self' data: blob: ${SUPABASE_ORIGIN}`,
    // next/font self-hosts at build time, so there is no font CDN to allow.
    "font-src 'self'",
    // Every Supabase call happens on the server. The browser talks to this
    // origin and nowhere else. ws: is the Turbopack dev socket.
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "object-src 'none'",
    // Stricter than the 'self' the docs suggest: nothing here sets a <base>,
    // and an injected one rewrites every relative URL on the page.
    "base-uri 'none'",
    // Server Actions post back to this origin, so a form aiming anywhere else
    // is a credential-harvesting form someone injected.
    "form-action 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

/** Request headers carrying the nonce through to the renderer. */
function headersWithNonce(
  request: NextRequest,
  nonce: string,
  csp: string,
): Headers {
  // Rebuilt from request.headers each time it is needed rather than captured
  // once: the Supabase callback below writes refreshed cookies onto the
  // request, and those live in the cookie header.
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  return headers;
}

/**
 * Refreshes the Supabase session cookie on every request, handles the
 * signed-in / signed-out redirects, and mints the CSP nonce.
 *
 * This is a convenience layer, NOT the security boundary. Next.js routes Server
 * Actions as POSTs to the page they live on, so a matcher change could silently
 * drop coverage. Every Server Action re-checks the session, and Row Level
 * Security enforces tenancy in the database regardless of what happens here.
 */
export async function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const csp = buildCsp(nonce);
  const { pathname } = request.nextUrl;

  /*
   * The public quote page runs the nonce path and nothing else.
   *
   * /q used to be excluded from the matcher entirely, because refreshing a
   * Supabase session for a client who has no account is pointless work on the
   * critical path of the one page that has to load fast on a phone. That
   * reasoning still holds and is why the early return is here: what /q now
   * costs is one edge invocation that generates a nonce, not the network
   * round trip to Supabase. Nothing on /q relies on the proxy for access
   * control — the page is fetched server side by exact token, and the
   * approve/decline actions are public by design and validate the token
   * themselves.
   */
  if (pathname.startsWith("/q/")) {
    const response = NextResponse.next({
      request: { headers: headersWithNonce(request, nonce, csp) },
    });
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  let response = NextResponse.next({
    request: { headers: headersWithNonce(request, nonce, csp) },
  });

  const supabase = createServerClient(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      // Must match server.ts. This is the path that rewrites the cookie on
      // every refresh, so flags set only there would be undone here.
      cookieOptions: AUTH_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({
            request: { headers: headersWithNonce(request, nonce, csp) },
          });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() revalidates the token against Supabase. Do not swap this for
  // getSession(), which trusts whatever the cookie claims.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.headers.set("Content-Security-Policy", csp);
    return redirectResponse;
  }

  if (user && AUTH_ROUTES.includes(pathname)) {
    /*
     * Honour the destination the user was already asking for.
     *
     * This used to send every signed-in visitor to the dashboard and drop
     * ?next= on the floor, so following a deep link to a quote while already
     * signed in landed on the dashboard and left the user to find it again.
     * The value is still untrusted — it came from the query string — so it goes
     * through the same check the sign-in action uses.
     */
    // Resolved against our own origin rather than assigned to .pathname, so a
    // destination that carries its own query string survives intact instead of
    // having its "?" percent-encoded into the path.
    const target = safeRedirectPath(request.nextUrl.searchParams.get("next"));
    const url = new URL(target, request.nextUrl.origin);
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.headers.set("Content-Security-Policy", csp);
    return redirectResponse;
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Every HTML document, and nothing else.
     *
     * Static assets and image files are excluded because they are
     * subresources: a nonce means nothing to them, and the policy that matters
     * is the one on the document that pulls them in. /q IS matched now, unlike
     * before, so that the quote page gets a nonce too — see the early return
     * above for what it is spared.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
