import Image from "next/image";

import { requireBusiness } from "@/lib/auth";

import { DashboardNav } from "./nav";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const { business, user } = await requireBusiness();
  const displayName = business.name.trim() || user.email || "העסק שלי";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-surface">
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
        <main className="w-full min-w-0 flex-1 px-5 py-6 md:px-0 md:py-8">
          {children}
        </main>

        <DashboardNav />
      </div>
    </div>
  );
}
