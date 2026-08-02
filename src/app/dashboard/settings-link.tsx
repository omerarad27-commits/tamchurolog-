"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Settings, in the header beside the business name and the email.
 *
 * It used to be the sixth tab in the bottom bar, sharing a phone's width with
 * five things an owner touches many times a day. Settings is not one of those:
 * it is filled in once and revisited rarely, and it belongs next to the
 * identity it describes rather than in the row for daily work. Moving it also
 * gives the five remaining tabs a fifth of the bar each instead of a sixth.
 *
 * A client component only for the active state, matching how the nav decides
 * its own.
 */
export function SettingsLink() {
  const isActive = usePathname().startsWith("/dashboard/settings");

  return (
    <Link
      href="/dashboard/settings"
      aria-label="הגדרות"
      aria-current={isActive ? "page" : undefined}
      className={
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-control transition-colors hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand " +
        (isActive ? "bg-brand-soft text-brand" : "text-muted")
      }
    >
      {/* Decorative: the link is named by aria-label, which a screen reader
          reads instead of trying to describe a cog. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
    </Link>
  );
}
