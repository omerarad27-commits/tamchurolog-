import type { Metadata } from "next";

import { requireBusiness } from "@/lib/auth";

import { SettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "הגדרות העסק | תמחורולוג",
};

export default async function SettingsPage() {
  const { business } = await requireBusiness();

  return (
    <div className="flex w-full max-w-form flex-col gap-5">
      <div>
        <h1>הגדרות העסק</h1>
        <p className="mt-1 text-sm text-muted">
          הפרטים האלה מופיעים ללקוחות שלך בכל הצעת מחיר.
        </p>
      </div>

      <div className="rounded-card border border-border bg-surface p-5 shadow-sm">
        <SettingsForm business={business} />
      </div>
    </div>
  );
}
