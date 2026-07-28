import "server-only";

import { connection } from "next/server";

import { missingPublicEnvVars, publicEnv } from "@/lib/env";

export type SupabaseHealth =
  | { status: "ok"; detail: string }
  | { status: "missing-env"; missing: string[] }
  | { status: "error"; detail: string };

/**
 * Trivial connectivity check used by the home page.
 *
 * Hits GoTrue's /auth/v1/settings with the anon key. A 200 proves both the project
 * URL and the anon key are valid; an invalid key returns 401. Chosen because it
 * depends on no table existing yet.
 *
 * Note: the PostgREST root (/rest/v1/) is NOT usable for this — current Supabase
 * projects return 401 there regardless of key validity.
 */
export async function checkSupabaseHealth(): Promise<SupabaseHealth> {
  // Opt out of prerendering: the result must reflect the live environment on every
  // request, not whatever the env vars happened to be at build time.
  await connection();

  const missing = missingPublicEnvVars();
  if (missing.length > 0) {
    return { status: "missing-env", missing };
  }

  try {
    const response = await fetch(`${publicEnv.supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: publicEnv.supabaseAnonKey },
      cache: "no-store",
    });

    if (response.status === 401) {
      return {
        status: "error",
        detail: "מפתח ה-anon נדחה. בדוק את NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      };
    }

    if (!response.ok) {
      return {
        status: "error",
        detail: `השרת החזיר סטטוס ${response.status}. בדוק שכתובת הפרויקט נכונה.`,
      };
    }

    const host = new URL(publicEnv.supabaseUrl).host;
    return { status: "ok", detail: host };
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאה לא ידועה";
    return { status: "error", detail: message };
  }
}
