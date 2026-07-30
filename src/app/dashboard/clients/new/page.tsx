import type { Metadata } from "next";
import Link from "next/link";

import { ClientForm } from "../client-form";

export const metadata: Metadata = {
  title: "לקוח חדש | תמחורולוג",
};

export default function NewClientPage() {
  return (
    <div className="flex w-full max-w-form flex-col gap-5">
      <div>
        <Link
          href="/dashboard/clients"
          className="text-sm font-medium text-muted hover:text-foreground"
        >
          <span aria-hidden="true">›</span> חזרה ללקוחות
        </Link>
        <h1 className="mt-2 text-2xl font-bold">לקוח חדש</h1>
      </div>

      <div className="rounded-card border border-border bg-surface p-5 shadow-sm">
        <ClientForm />
      </div>
    </div>
  );
}
