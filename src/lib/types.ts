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
