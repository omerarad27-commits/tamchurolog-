"use client";

import { createBrowserClient } from "@supabase/ssr";

import { requirePublicEnv } from "@/lib/env";

/**
 * Supabase client for Client Components.
 * Uses the anon key only — every query it makes is subject to Row Level Security.
 */
export function createSupabaseBrowserClient() {
  const { supabaseUrl, supabaseAnonKey } = requirePublicEnv();
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
