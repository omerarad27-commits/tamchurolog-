/** Shapes of the database rows, kept in sync with supabase/migrations by hand. */

export type Business = {
  id: string;
  owner_user_id: string;
  name: string;
  phone: string | null;
  logo_url: string | null;
  default_terms: string | null;
  currency: string;
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
  status: QuoteStatus;
  issued_at: string;
  sent_at: string | null;
  valid_until: string | null;
  notes: string | null;
  /** Postgres numeric arrives as a string over PostgREST; parse before doing maths. */
  subtotal: string;
  tax_amount: string | null;
  total: string;
  public_token: string;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  decision_signature_name: string | null;
  decided_at: string | null;
  decision_ip: string | null;
  decision_reason: string | null;
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

/** A quote joined with the client it belongs to, as shown in lists. */
export type QuoteWithClient = Quote & {
  clients: Pick<Client, "id" | "full_name" | "phone"> | null;
};
