import type { Metadata } from "next";

import { requireBusiness } from "@/lib/auth";

export const metadata: Metadata = {
  title: "אזור אישי | תמחורולוג",
};

export default async function DashboardPage() {
  const { supabase, business } = await requireBusiness();

  // Counted through the anon key, so RLS decides what is visible — this number
  // can never include another business's clients.
  const { count, error } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">שלום{business.name ? `, ${business.name}` : ""}</h1>
        <p className="mt-1 text-sm text-muted">
          כאן ינוהלו הצעות המחיר שלך והמעקב אחריהן.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-muted">לקוחות</h2>
        <p className="numeric mt-1 text-3xl font-bold">
          {error ? "—" : (count ?? 0)}
        </p>
        <p className="mt-1 text-sm text-muted">
          ניהול הלקוחות ייפתח בשלב הבא.
        </p>
      </section>

      <section className="rounded-2xl border border-dashed border-border p-5">
        <h2 className="font-semibold">הצעות מחיר</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          עדיין אין כאן הצעות מחיר. בניית הצעות, שליחה בוואטסאפ ומעקב אחרי צפיות
          יתווספו בשלבים הבאים.
        </p>
      </section>
    </div>
  );
}
