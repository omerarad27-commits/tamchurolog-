"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Bottom tab bar. Deliberately at the bottom of the screen rather than the top:
 * these screens are used one-handed on a phone, and the bottom third is the
 * only area a thumb reaches comfortably.
 */
const TABS = [
  { href: "/dashboard", label: "הצעות" },
  { href: "/dashboard/clients", label: "לקוחות" },
  { href: "/dashboard/stats", label: "סיכום" },
  { href: "/dashboard/settings", label: "הגדרות" },
] as const;

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="ניווט ראשי"
      className="sticky bottom-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex w-full max-w-2xl">
        {TABS.map((tab) => {
          const isActive =
            tab.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(tab.href);

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={
                  "flex h-14 items-center justify-center text-sm font-semibold transition-colors " +
                  (isActive
                    ? "text-brand"
                    : "text-muted hover:text-foreground")
                }
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
