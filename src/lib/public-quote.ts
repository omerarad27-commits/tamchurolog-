import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { QuoteStatus } from "@/lib/types";

/*
 * Loading a quote for the public page.
 *
 * This is the only place in the app where the service_role key touches quote
 * data, and it does exactly one thing: an exact-match lookup on public_token.
 * There is no listing, no prefix match, no client-controlled filter. Every
 * field returned is chosen explicitly, so nothing about the owner or the
 * client leaks beyond what belongs on the document.
 */

/** Tokens are 32 lowercase hex chars. Anything else never reaches the database. */
const TOKEN_PATTERN = /^[0-9a-f]{32}$/;

export type PublicQuote = {
  id: string;
  quoteNumber: number;
  status: QuoteStatus;
  issuedAt: string;
  validUntil: string | null;
  notes: string | null;
  total: string;
  decisionName: string | null;
  decidedAt: string | null;
  business: {
    name: string;
    phone: string | null;
    logoUrl: string | null;
  };
  clientName: string;
  items: {
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
  }[];
};

export async function loadPublicQuote(
  token: string,
): Promise<PublicQuote | null> {
  if (!TOKEN_PATTERN.test(token)) return null;

  const supabase = createSupabaseAdminClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select(
      "id, business_id, client_id, quote_number, status, issued_at, valid_until, notes, total, decision_signature_name, decided_at",
    )
    .eq("public_token", token)
    .maybeSingle();

  if (!quote) return null;

  const [{ data: business }, { data: client }, { data: items }] =
    await Promise.all([
      supabase
        .from("businesses")
        .select("name, phone, logo_url")
        .eq("id", quote.business_id)
        .maybeSingle(),
      supabase
        .from("clients")
        .select("full_name")
        .eq("id", quote.client_id)
        .maybeSingle(),
      supabase
        .from("quote_line_items")
        .select("id, description, quantity, unit_price, line_total")
        .eq("quote_id", quote.id)
        .order("sort_order", { ascending: true }),
    ]);

  return {
    id: quote.id,
    quoteNumber: quote.quote_number,
    status: quote.status,
    issuedAt: quote.issued_at,
    validUntil: quote.valid_until,
    notes: quote.notes,
    total: quote.total,
    decisionName: quote.decision_signature_name,
    decidedAt: quote.decided_at,
    business: {
      name: business?.name ?? "",
      phone: business?.phone ?? null,
      logoUrl: business?.logo_url ?? null,
    },
    clientName: client?.full_name ?? "",
    items: (items ?? []).map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      lineTotal: item.line_total,
    })),
  };
}

/**
 * Records one view. Runs through a security-definer function so the insert and
 * the status transition happen together.
 */
export async function recordQuoteView(
  quoteId: string,
  ipAddress: string | null,
  userAgent: string | null,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase.rpc("record_quote_view", {
    p_quote_id: quoteId,
    p_ip_address: ipAddress,
    p_user_agent: userAgent?.slice(0, 500) ?? null,
  });
}
