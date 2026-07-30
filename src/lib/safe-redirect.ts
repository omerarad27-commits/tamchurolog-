/**
 * Where a signed-in user is allowed to land.
 *
 * Lives here rather than beside the auth actions because a "use server" module
 * may only export async functions, and both the sign-in action and the proxy
 * need this exact rule. Two copies of a security check drift apart, and the
 * copy that drifts is the one nobody is looking at.
 */

/** Where everyone ends up when the requested destination is not usable. */
export const DEFAULT_SIGNED_IN_PATH = "/dashboard";

/**
 * Narrows an untrusted ?next= to a same-origin path.
 *
 * Requiring a leading "/" already rejects "https://evil.example" and
 * "javascript:alert(1)", and the second check rejects the protocol-relative
 * "//evil.example". The backslash is the same attack wearing a different hat:
 * browsers normalise "\" to "/" inside a URL, so "/\evil.example" passes a
 * naive startsWith("//") test and still arrives at the browser as
 * "//evil.example" — an off-site redirect at the exact moment the user has
 * just typed a password and is least likely to check the address bar.
 */
export function safeRedirectPath(value: unknown): string {
  const path = typeof value === "string" ? value : "";
  if (!path.startsWith("/")) return DEFAULT_SIGNED_IN_PATH;
  if (path.startsWith("//") || path.startsWith("/\\")) {
    return DEFAULT_SIGNED_IN_PATH;
  }
  return path;
}
