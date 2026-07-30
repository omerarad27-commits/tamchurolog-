import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicEnv } from "@/lib/env";
import { AUTH_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";

/** Routes that only make sense when signed out. */
const AUTH_ROUTES = ["/login", "/signup"];

/** Route prefixes that require a session. */
const PROTECTED_PREFIXES = ["/dashboard"];

/**
 * Refreshes the Supabase session cookie on every request and handles the
 * signed-in / signed-out redirects.
 *
 * This is a convenience layer, NOT the security boundary. Next.js routes Server
 * Actions as POSTs to the page they live on, so a matcher change could silently
 * drop coverage. Every Server Action re-checks the session, and Row Level
 * Security enforces tenancy in the database regardless of what happens here.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
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

  const { pathname } = request.nextUrl;

  if (!user && PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && AUTH_ROUTES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, image files, and the public quote page.
     *
     * /q is excluded deliberately. It is served to clients who have no account,
     * so refreshing a Supabase session there is pointless work on the critical
     * path of the one page that has to load fast on a phone. Nothing on /q
     * relies on the proxy for access control: the page is fetched server side
     * by exact token, and Phase 6's approve/decline actions are public by
     * design and validate the token themselves.
     */
    "/((?!q/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
