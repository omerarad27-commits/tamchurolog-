import type { Metadata } from "next";
import Link from "next/link";

import { requireBusiness } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import {
  loadNotifications,
  notificationHref,
  notificationText,
} from "@/lib/notifications";

import { MarkNotificationsReadOnMount } from "./mark-read-on-mount";

export const metadata: Metadata = {
  title: "התראות | תמחורולוג",
};

export default async function NotificationsPage() {
  /*
   * Marking read happens client-side after mount (see
   * `MarkNotificationsReadOnMount`), so this render still shows which ones
   * were new. The next visit sees them all as read, which is the correct
   * answer: the owner has now looked at them.
   */
  const context = await requireBusiness();
  const notifications = await loadNotifications(context);

  return (
    <div className="flex flex-col gap-5">
      <MarkNotificationsReadOnMount />
      <h1 className="text-2xl font-bold">התראות</h1>

      {notifications.length === 0 ? (
        <p className="rounded-card border border-dashed border-border p-5 text-center text-sm text-muted">
          אין התראות חדשות.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((notification) => (
            <li key={notification.id}>
              <Link
                href={notificationHref(notification)}
                className={
                  "flex flex-col gap-0.5 rounded-card border p-4 transition-colors hover:bg-background " +
                  (notification.read_at
                    ? "border-border bg-surface"
                    : "border-brand/30 bg-brand-soft")
                }
              >
                <span className="font-medium">
                  {notificationText(notification)}
                </span>
                {/* Digits isolated so the line stays right-aligned. */}
                <span className="text-xs text-muted">
                  <span className="numeric">
                    {formatDateTime(notification.created_at)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
