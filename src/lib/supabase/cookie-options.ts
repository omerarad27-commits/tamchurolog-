import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Flags applied to the Supabase auth cookies.
 *
 * @supabase/ssr ships `httpOnly: false` as a deliberate default, because its
 * browser client reads the session out of `document.cookie`. That default is
 * wrong for this app: `src/lib/supabase/client.ts` is imported by nothing, every
 * screen is a Server Component or a Server Action, and no browser code has ever
 * needed to see the token. Leaving it readable only means that any script that
 * ever manages to run on the page can take a signed-in session with it.
 *
 * `secure` is conditional. Over http://localhost the flag is accepted by some
 * browsers and quietly dropped by others, and a cookie that fails to set in
 * development is a debugging session nobody needs.
 *
 * These must stay identical in `server.ts` and `proxy.ts`. The proxy rewrites
 * the cookie on refresh, so if only one of the two carried the flags, every
 * request would hand the token straight back to the browser. Hence one export.
 */
export const AUTH_COOKIE_OPTIONS: CookieOptionsWithName = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};
