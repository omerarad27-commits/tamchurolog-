import type { Metadata } from "next";

import { requireBusiness } from "@/lib/auth";
import type { PriceListItem } from "@/lib/types";

import { PriceListManager } from "./price-list-manager";

export const metadata: Metadata = {
  title: "מחירון | תמחורולוג",
};

export default async function PriceListPage() {
  const { supabase, business } = await requireBusiness();

  const { data, error } = await supabase
    .from("price_list_items")
    .select("id, business_id, name, unit_price, sort_order, created_at")
    .eq("business_id", business.id)
    /* The owner's order, with created_at only as a tiebreak, so a list nobody
       has rearranged still comes back the same way twice. */
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const items = (data ?? []) as PriceListItem[];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1>מחירון</h1>
        <p className="mt-1 text-sm text-muted">
          העבודות שאתה עושה שוב ושוב, עם המחיר שאתה לוקח עליהן. בבניית הצעה תבחר
          מהרשימה במקום להקליד.
        </p>
      </div>

      {error ? (
        <p className="rounded-tile border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
          טעינת המחירון נכשלה. רענן את הדף ונסה שוב.
        </p>
      ) : null}

      {/* The empty state sits above the form rather than replacing it: there is
          nothing to explain that the form does not already show, and hiding the
          form behind a "start here" button would be one tap for nothing. */}
      {items.length === 0 && !error ? (
        <div className="rounded-card border border-dashed border-border p-6 text-center">
          <p className="font-semibold">המחירון עדיין ריק</p>
          <p className="mt-1 text-sm text-muted">
            הוסף את העבודה שאתה עושה הכי הרבה. בהצעה הבאה היא תיכנס בלחיצה אחת,
            עם השם והמחיר.
          </p>
        </div>
      ) : null}

      <PriceListManager items={items} />
    </div>
  );
}
