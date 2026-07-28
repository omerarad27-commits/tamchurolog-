/**
 * Centralized access to public (browser-exposed) environment variables.
 *
 * SECURITY: SUPABASE_SERVICE_ROLE_KEY is deliberately absent from this module.
 * It is read only inside `src/lib/supabase/admin.ts`, which is marked server-only.
 */

const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;

export type PublicEnv = typeof publicEnv;

/** Names of the required public env vars that are currently unset. */
export function missingPublicEnvVars(): string[] {
  const missing: string[] = [];
  if (!publicEnv.supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!publicEnv.supabaseAnonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return missing;
}

/** Returns the public env, throwing a readable error if anything required is missing. */
export function requirePublicEnv(): PublicEnv {
  const missing = missingPublicEnvVars();
  if (missing.length > 0) {
    throw new Error(
      `Missing environment variables: ${missing.join(", ")}. ` +
        "Add them to .env.local locally and to Vercel Project Settings > Environment Variables.",
    );
  }
  return publicEnv;
}

export { publicEnv };
