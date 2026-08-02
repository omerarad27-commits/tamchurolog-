/**
 * Where "back" goes from any screen in the dashboard.
 *
 * Up-navigation rather than history.back(). Two reasons. The owner reaches a
 * quote from the home list, from a client's card, or from a notification, and
 * a button whose destination depends on which of those happened cannot be
 * given an honest label. And a link that was opened in a new tab has no
 * history to go back through, which is exactly when someone needs the button
 * most. The phone's own back gesture still does what it always did.
 *
 * A plain function over a pathname, so the rules are readable in one place
 * rather than spread across six pages that each wrote their own link.
 */

export type BackTarget = { href: string; label: string };

const HOME: BackTarget = { href: "/dashboard", label: "חזרה להצעות" };
const CLIENTS: BackTarget = { href: "/dashboard/clients", label: "חזרה ללקוחות" };
const FORMS: BackTarget = { href: "/dashboard/forms", label: "חזרה לשאלונים" };

export function dashboardBackTarget(pathname: string): BackTarget | null {
  /* The dashboard home is the top of the tree; there is nowhere above it. */
  if (pathname === "/dashboard") return null;

  /* Editing a quote returns to that quote, not past it: the owner came to
     change something and wants to see the result. */
  const editing = pathname.match(/^\/dashboard\/quotes\/([^/]+)\/(edit|print)$/);
  if (editing) {
    return { href: `/dashboard/quotes/${editing[1]}`, label: "חזרה להצעה" };
  }

  /* There is no /dashboard/quotes list page — the quotes are the dashboard
     home — so this cannot be a generic "drop the last segment". */
  if (pathname.startsWith("/dashboard/quotes/")) return HOME;

  if (pathname.startsWith("/dashboard/clients/")) return CLIENTS;
  if (pathname.startsWith("/dashboard/forms/")) return FORMS;

  /* Everything else — the client list, the form list, settings, stats,
     notifications — sits one level under the home screen. */
  return HOME;
}
