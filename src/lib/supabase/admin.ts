import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client using the service_role key.
 *
 * DANGER: this key bypasses Row Level Security entirely. Never import this module
 * from a Client Component, and never expose the key through a NEXT_PUBLIC_ variable.
 * The `server-only` import above turns any accidental client import into a build error.
 *
 * Intended use: the public quote page (Phase 4), which must read a single quote by its
 * public token without an authenticated session. Every call must filter by that token.
 */
export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "Add them to .env.local locally and to Vercel Project Settings > Environment Variables.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
