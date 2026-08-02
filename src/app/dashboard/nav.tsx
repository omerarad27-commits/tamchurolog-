"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Primary navigation, in two shapes from one markup tree.
 *
 * On a phone it is a bottom tab bar, deliberately at the bottom rather than the
 * top: these screens are used one-handed, and the bottom third is the only area
 * a thumb reaches comfortably.
 *
 * From md up that reasoning stops applying. There is no thumb, the pointer is
 * already travelling, and a bar pinned across the foot of a 1440px window is
 * five links stranded in a lot of nothing. It becomes a rail on the right edge
 * instead, sticky so it survives a long list.
 *
 * Only classes change between the two. The tab list, the active-route test and
 * the links are the same objects in both.
 */
const TABS = [
  { href: "/dashboard", label: "הצעות" },
  { href: "/dashboard/clients", label: "לקוחות" },
  { href: "/dashboard/pricelist", label: "מחירון" },
  { href: "/dashboard/forms", label: "שאלונים" },
  { href: "/dashboard/stats", label: "סיכום" },
  { href: "/dashboard/settings", label: "הגדרות" },
] as const;

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="ניווט ראשי"
      className="print-hide sticky bottom-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:order-first md:top-8 md:bottom-auto md:w-44 md:shrink-0 md:self-start md:border-t-0 md:bg-transparent md:pt-8 md:pb-0 lg:w-56"
    >
      <ul className="mx-auto flex w-full max-w-2xl md:max-w-none md:flex-col md:gap-1">
        {TABS.map((tab) => {
          const isActive =
            tab.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(tab.href);

          return (
            <li key={tab.href} className="flex-1 md:flex-none">
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={
                  "flex h-14 items-center justify-center text-sm font-semibold transition-colors md:h-11 md:justify-start md:rounded-control md:px-4 md:text-base " +
                  (isActive
                    ? "text-brand md:bg-brand-soft"
                    : "text-muted hover:text-foreground md:hover:bg-surface")
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
