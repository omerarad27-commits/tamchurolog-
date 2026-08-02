"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { dashboardBackTarget } from "@/lib/dashboard-back";

/**
 * The back link, rendered once by the dashboard layout for every screen under
 * it.
 *
 * It used to be written by hand on six pages and missing from four others. A
 * client component only because it needs the pathname; it renders a real
 * anchor, so it is still a link a keyboard, a screen reader and a middle click
 * all understand.
 */
export function DashboardBackLink() {
  const target = dashboardBackTarget(usePathname());

  if (!target) return null;

  return (
    <Link
      href={target.href}
      className="print-hide -m-2 mb-2 inline-flex items-center gap-1 self-start rounded-control p-2 text-sm font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {/*
        The chevron points right because the page does: in RTL, back is
        rightwards. Decorative — the label already says where this goes.
      */}
      <span aria-hidden="true">›</span>
      {target.label}
    </Link>
  );
}
