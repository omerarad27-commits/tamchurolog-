import type { Metadata } from "next";

import { requireBusiness } from "@/lib/auth";
import { defaultChargesVat, toBusinessType } from "@/lib/business-type";
import type { Client, PriceListItem } from "@/lib/types";
import type { VatMode } from "@/lib/vat";

import { QuickQuoteForm } from "./quick-quote-form";

export const metadata: Metadata = {
  title: "הצעה מהירה | תמחורולוג",
};

export default async function QuickQuotePage() {
  const { supabase, business } = await requireBusiness();

  /* Both lists in one round trip: this screen exists to be fast, and two
     awaits in sequence would spend a second trip on it for nothing. */
  const [{ data: clientRows }, { data: priceRows }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, business_id, full_name, phone, email, notes, created_at")
      .eq("business_id", business.id)
      .order("full_name", { ascending: true }),
    supabase
      .from("price_list_items")
      .select("id, business_id, name, unit_price, sort_order, created_at")
      .eq("business_id", business.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  const clients = (clientRows ?? []) as Client[];
  const priceList = (priceRows ?? []) as PriceListItem[];

  /*
   * The business type picks where the toggle starts, and nothing more. It used
   * to decide the answer outright: the amount was always treated as including
   * VAT, which is right for the tradesperson quoting "four hundred, all in"
   * and wrong for the one who works in pre-VAT figures and watched this screen
   * quietly shave 18% off every quote.
   */
  const defaultVatMode: VatMode = defaultChargesVat(
    toBusinessType(business.business_type),
  )
    ? "inclusive"
    : "none";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="mt-2 text-2xl font-bold">הצעה מהירה</h1>
        <p className="mt-1 text-sm text-muted">
          שלוש שאלות ושליחה. התוקף והתנאים נלקחים מההגדרות, ואפשר לערוך את ההצעה
          אחר כך כמו כל הצעה אחרת.
        </p>
      </div>

      <QuickQuoteForm
        clients={clients}
        priceList={priceList}
        defaultVatMode={defaultVatMode}
      />
    </div>
  );
}
