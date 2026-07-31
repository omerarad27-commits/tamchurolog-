import type { Metadata } from "next";
import Link from "next/link";

import { requireBusiness } from "@/lib/auth";
import { defaultChargesVat, toBusinessType } from "@/lib/business-type";
import type { Client } from "@/lib/types";

import { QuoteBuilder } from "../quote-builder";

export const metadata: Metadata = {
  title: "הצעה חדשה | תמחורולוג",
};

/** Quotes default to two weeks of validity; the owner can change it per quote. */
const DEFAULT_VALIDITY_DAYS = 14;

export default async function NewQuotePage({
  searchParams,
}: PageProps<"/dashboard/quotes/new">) {
  const { supabase, business } = await requireBusiness();

  const { data } = await supabase
    .from("clients")
    .select("id, business_id, full_name, phone, email, notes, created_at")
    .eq("business_id", business.id)
    .order("full_name", { ascending: true });

  const clients = (data ?? []) as Client[];

  /*
   * Arriving from a client's page with that client already chosen.
   *
   * The id is untrusted, but the list above is already scoped to this
   * business, so membership in it is the entire check. An id that is not in it
   * opens the builder with nothing selected rather than raising anything: the
   * owner is one dropdown away from carrying on, and an error page here would
   * be louder than the problem.
   */
  const { clientId } = await searchParams;
  const requested = typeof clientId === "string" ? clientId : undefined;
  const initialClientId = clients.some((client) => client.id === requested)
    ? requested
    : undefined;

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + DEFAULT_VALIDITY_DAYS);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-muted hover:text-foreground"
        >
          <span aria-hidden="true">›</span> חזרה להצעות
        </Link>
        <h1 className="mt-2 text-2xl font-bold">הצעה חדשה</h1>
      </div>

      <QuoteBuilder
        clients={clients}
        initialClientId={initialClientId}
        defaultValidUntil={validUntil.toISOString().slice(0, 10)}
        defaultNotes={business.default_terms ?? ""}
        businessType={toBusinessType(business.business_type)}
        defaultWithVat={defaultChargesVat(toBusinessType(business.business_type))}
      />
    </div>
  );
}
