import Link from "next/link";

import { unreadNotificationCount } from "@/lib/notifications";

export async function NotificationBell({
  businessId,
}: {
  businessId: string;
}) {
  const unread = await unreadNotificationCount(businessId);

  return (
    <Link
      href="/dashboard/notifications"
      aria-label={
        unread > 0 ? `התראות, ${unread} חדשות` : "התראות"
      }
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-background hover:text-foreground"
    >
      <span aria-hidden="true" className="text-xl">
        🔔
      </span>
      {unread > 0 ? (
        // aria-hidden because the count is already in the link's label; a
        // screen reader should hear it once, not twice.
        <span
          aria-hidden="true"
          className="numeric absolute top-1 left-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs font-bold text-white"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
