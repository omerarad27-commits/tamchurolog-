import Image from "next/image";

import { DashboardBackLink } from "@/components/dashboard-back-link";
import { requireBusiness } from "@/lib/auth";

import { DashboardNav } from "./nav";
import { NotificationBell } from "./notification-bell";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const { business, user } = await requireBusiness();
  const displayName = business.name.trim() || user.email || "העסק שלי";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {/*
        The skip link that used to live here now sits in the root layout: every
        public page needed one too, and one link before <body>'s content beats
        a copy per layout. The #main it targets is the <main> below.
      */}
      <header className="print-hide border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-app items-center gap-3 px-5 py-3">
          {business.logo_url ? (
            <Image
              src={business.logo_url}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-tile border border-border object-contain"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-tile bg-brand text-base font-bold text-brand-foreground"
            >
              ת
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{displayName}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>

          <NotificationBell businessId={business.id} />
          <SignOutButton />
        </div>
      </header>

      {/*
        One column on a phone, two from md up.

        Because the document is RTL, a flex row lays its children out right to
        left, so the sidebar needs no side-specific class at all: md:order-first
        puts it first in the visual order, which is the right edge. The same
        markup is a bottom bar on a phone and a right rail on a desktop.
      */}
      <div className="mx-auto flex w-full max-w-app flex-1 flex-col md:flex-row md:items-start md:gap-8 md:px-5">
        <main
          id="main"
          // Focusable only as a skip-link destination, never in the tab order.
          tabIndex={-1}
          className="flex w-full min-w-0 flex-1 flex-col px-5 py-6 md:px-0 md:py-8"
        >
          {/*
            Inside <main> rather than above it, so the skip link lands before
            it: someone jumping past the navigation still gets the way out of
            this screen as the first thing they meet.
          */}
          <DashboardBackLink />
          {children}
        </main>

        <DashboardNav />
      </div>
    </div>
  );
}
