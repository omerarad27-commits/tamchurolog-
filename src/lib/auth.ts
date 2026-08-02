import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Business } from "@/lib/types";

/** The signed-in user, or null. Safe to call on public routes. */
export async function getUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Guard for authenticated pages and Server Actions.
 *
 * Called inside every Server Action too, not just in pages — proxy.ts alone is
 * not a sufficient guarantee (see the note in that file).
 */
export async function requireAuth() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return { supabase, user };
}

/**
 * The signed-in user's business. Created by a database trigger at signup, so in
 * practice this always exists; the redirect is a defensive fallback.
 */
export async function requireBusiness() {
  const { supabase, user } = await requireAuth();

  const { data, error } = await supabase
    .from("businesses")
    .select(
      "id, owner_user_id, name, business_type, phone, logo_url, default_terms, currency, dismissed_tips, created_at",
    )
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load business: ${error.message}`);
  }

  if (!data) {
    redirect("/login");
  }

  return { supabase, user, business: data as Business };
}
