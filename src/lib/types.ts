/** Shapes of the database rows, kept in sync with supabase/migrations by hand. */

export type Business = {
  id: string;
  owner_user_id: string;
  name: string;
  /** "exempt" | "licensed" | "company" — see lib/business-type.ts */
  business_type: string;
  phone: string | null;
  logo_url: string | null;
  default_terms: string | null;
  currency: string;
  /**
   * Ids of the in-app tips this owner has closed. See lib/tips.ts.
   *
   * On the business rather than in the browser, because "dismissed" has to mean
   * dismissed on the laptop too.
   */
  dismissed_tips: string[];
  created_at: string;
};

export type Client = {
  id: string;
  business_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
};

/**
 * One line of the owner's own price list: what they call the job, and what they
 * usually charge for it.
 *
 * Copied into a quote by value, never referenced. See the migration for why.
 */
export type PriceListItem = {
  id: string;
  business_id: string;
  name: string;
  /** Postgres numeric arrives as a string over PostgREST. */
  unit_price: string;
  sort_order: number;
  created_at: string;
};

export type QuoteStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "approved"
  | "declined"
  | "expired";

export type Quote = {
  id: string;
  business_id: string;
  client_id: string;
  quote_number: number;
  /**
   * What the work is, in the owner's words: "shiputs hadar ambatya".
   *
   * Null on every quote written before the field existed, and on any the owner
   * chose to leave blank, so every reader has to have a fallback.
   */
  title: string | null;
  status: QuoteStatus;
  issued_at: string;
  sent_at: string | null;
  valid_until: string | null;
  notes: string | null;
  /** Postgres numeric arrives as a string over PostgREST; parse before doing maths. */
  subtotal: string;
  tax_amount: string | null;
  total: string;
  /**
   * The VAT rate this quote was created with, e.g. "0.1800". Zero means the
   * quote was issued without VAT. Stored per quote rather than read from a
   * constant, so a change in the law never rewrites an old document.
   */
  vat_rate: string;
  /** Raw sum of the line items, i.e. exactly what the owner typed. */
  lines_total: string;
  /** True when the entered prices already contain VAT and it is extracted. */
  prices_include_vat: boolean;
  public_token: string;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  decision_signature_name: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  /*
   * decision_ip exists in the database and is deliberately absent here.
   *
   * It is captured because it strengthens the record of who accepted a quote,
   * but the owner has no use for it: an IP address identifies nobody and helps
   * close no deal. Showing a client's IP to the tradesperson is an exposure of
   * personal data with no purpose behind it, so it is never selected and never
   * rendered. Leaving it out of this type makes the compiler enforce that
   * rather than relying on whoever edits the page next.
   *
   * If a real dispute ever needs it, it is one query away in the database.
   */
  reminded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type QuoteLineItem = {
  id: string;
  quote_id: string;
  description: string;
  quantity: string;
  unit_price: string;
  line_total: string;
  sort_order: number;
};

/**
 * A quote can be edited until the client decides. After that its contents are
 * frozen: the approval refers to specific numbers, and changing them
 * afterwards would rewrite what someone agreed to.
 */
export function isQuoteEditable(status: QuoteStatus): boolean {
  return status !== "approved" && status !== "declined";
}

/** A quote joined with the client it belongs to, as shown in lists. */
export type QuoteWithClient = Quote & {
  clients: Pick<Client, "id" | "full_name" | "phone"> | null;
};
