"use client";

/*
 * ⚠️ NOT IN USE, AND IT MUST STAY THAT WAY WITHOUT A DELIBERATE DECISION.
 *
 * Nothing imports this. Every screen is a Server Component or a Server Action,
 * and the auth cookie is now httpOnly, which this client cannot read. Importing
 * it would produce a client that believes it is signed out on every page load,
 * and the fix would look like an auth bug rather than a cookie flag.
 *
 * If browser-side Supabase access is ever genuinely needed, that is a decision
 * about `AUTH_COOKIE_OPTIONS`, not about this file.
 */
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
