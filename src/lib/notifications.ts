import "server-only";

import { requireBusiness } from "@/lib/auth";

export type NotificationKind = "intake_submitted" | "quote_approved";

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

  if (notification.kind === "quote_approved") {
    const number = notification.quote_number;
    return number === null
      ? `${who} אישר את ההצעה`
      : `${who} אישר את הצעה מספר ${number}`;
  }

  return `${who} מילא את השאלון`;
}

/** Where tapping it goes. Falls back to the list when the target is gone. */
export function notificationHref(notification: Notification): string {
  if (notification.kind === "quote_approved" && notification.quote_id) {
    return `/dashboard/quotes/${notification.quote_id}`;
  }
  return "/dashboard/notifications";
}

export async function unreadNotificationCount(): Promise<number> {
  const { supabase, business } = await requireBusiness();

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id)
    .is("read_at", null);

  return count ?? 0;
}

export async function loadNotifications(): Promise<Notification[]> {
  const { supabase, business } = await requireBusiness();

  const { data } = await supabase
    .from("notifications")
    .select(COLUMNS)
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (data ?? []) as Notification[];
}

/**
 * One update for everything currently unread.
 *
 * There is no per-item read control on purpose: the owner opened the list to
 * look at them, and a list that has to be dismissed one row at a time is a
 * chore rather than a feature.
 */
export async function markAllNotificationsRead(): Promise<void> {
  const { supabase, business } = await requireBusiness();

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("business_id", business.id)
    .is("read_at", null);
}
