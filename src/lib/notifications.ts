import "server-only";

import { requireBusiness } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type NotificationKind =
  | "intake_submitted"
  | "quote_approved"
  | "quote_declined";

export type Notification = {
  id: string;
  kind: NotificationKind;
  subject_name: string | null;
  quote_number: number | null;
  intake_request_id: string | null;
  quote_id: string | null;
  read_at: string | null;
  created_at: string;
};

/**
 * A notification with its client resolved, for the link only.
 *
 * `notifications` carries `intake_request_id`, not a client id, so the client
 * behind an `intake_submitted` row is looked up separately in
 * `loadNotifications` - one `.in(...)` query for the whole page, not one per
 * row. `clientId` is null when the request or its client no longer exists,
 * and `notificationHref` falls back to the list in that case rather than
 * building a broken link. This is deliberately not part of `Notification`
 * itself: `notificationText` stays a pure function of the database row, so
 * its wording never depends on something that can disappear.
 */
export type NotificationWithClient = Notification & {
  clientId: string | null;
};

const COLUMNS =
  "id, kind, subject_name, quote_number, intake_request_id, quote_id, read_at, created_at";

/**
 * The Hebrew sentence, composed here rather than stored.
 *
 * The row snapshots the name and the number, so a client deleted next month
 * does not blank last month's notification, but the wording lives in the
 * codebase where changing it costs nothing.
 */
export function notificationText(notification: Notification): string {
  const who = notification.subject_name?.trim() || "לקוח";

  /*
   * Phrased so the verb never agrees with the client's gender.
   *
   * "דנה לוי מילא את השאלון" was the first draft, and it is wrong for roughly
   * half of every client list: Hebrew verbs are gendered and a name does not
   * tell us which form to use. Guessing from the name is worse than not
   * guessing. Passive and prepositional forms sidestep it entirely, and read
   * no less naturally.
   */
  if (
    notification.kind === "quote_approved" ||
    notification.kind === "quote_declined"
  ) {
    /*
     * The verb agrees with "הצעה", which is feminine and always will be, so
     * this stays gender-safe for the same reason the approval wording does.
     */
    const verb = notification.kind === "quote_approved" ? "אושרה" : "נדחתה";
    const number = notification.quote_number;
    return number === null
      ? `ההצעה ${verb} על ידי ${who}`
      : `הצעה מספר ${number} ${verb} על ידי ${who}`;
  }

  return `התקבלו תשובות לשאלון מ${who}`;
}

/** Where tapping it goes. Falls back to the list when the target is gone. */
export function notificationHref(notification: NotificationWithClient): string {
  if (
    (notification.kind === "quote_approved" ||
      notification.kind === "quote_declined") &&
    notification.quote_id
  ) {
    return `/dashboard/quotes/${notification.quote_id}`;
  }
  if (notification.kind === "intake_submitted" && notification.clientId) {
    return `/dashboard/clients/${notification.clientId}`;
  }
  return "/dashboard/notifications";
}

/**
 * Takes the business id rather than calling `requireBusiness` itself.
 *
 * `requireBusiness` is not memoised, so every call is an auth round trip plus
 * a `businesses` select. `<NotificationBell>` renders on every dashboard page
 * next to a layout that already called `requireBusiness` once; having the
 * bell call it again doubled that cost on every single page load. The caller
 * is trusted to have already authenticated - RLS still scopes the query to
 * whatever business the signed-in session actually owns.
 */
export async function unreadNotificationCount(
  businessId: string,
): Promise<number> {
  const supabase = await createSupabaseServerClient();

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .is("read_at", null);

  return count ?? 0;
}

/**
 * Takes an already-authenticated context instead of calling `requireBusiness`
 * itself, so a page that also calls `markAllNotificationsRead` pays for the
 * auth round trip once rather than twice for the same render.
 */
export async function loadNotifications(
  context: Awaited<ReturnType<typeof requireBusiness>>,
): Promise<NotificationWithClient[]> {
  const { supabase, business } = context;

  const { data } = await supabase
    .from("notifications")
    .select(COLUMNS)
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const notifications = (data ?? []) as Notification[];

  // One extra query for the whole page, never one per row: collect every
  // intake_request_id the loaded rows reference and resolve them all at once.
  const requestIds = [
    ...new Set(
      notifications
        .filter((n) => n.kind === "intake_submitted" && n.intake_request_id)
        .map((n) => n.intake_request_id as string),
    ),
  ];

  const clientByRequest = new Map<string, string>();
  if (requestIds.length > 0) {
    const { data: requests } = await supabase
      .from("intake_requests")
      .select("id, client_id")
      .eq("business_id", business.id)
      .in("id", requestIds);

    for (const request of requests ?? []) {
      clientByRequest.set(request.id, request.client_id);
    }
  }

  return notifications.map((notification) => ({
    ...notification,
    clientId:
      notification.intake_request_id !== null
        ? (clientByRequest.get(notification.intake_request_id) ?? null)
        : null,
  }));
}

/**
 * One update for everything currently unread.
 *
 * There is no per-item read control on purpose: the owner opened the list to
 * look at them, and a list that has to be dismissed one row at a time is a
 * chore rather than a feature.
 */
export async function markAllNotificationsRead(
  context: Awaited<ReturnType<typeof requireBusiness>>,
): Promise<void> {
  const { supabase, business } = context;

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("business_id", business.id)
    .is("read_at", null);
}
