"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { clientIpFromHeaders } from "@/lib/bots";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/*
 * Public actions. There is no session here by design: whoever holds the link is
 * the client, and asking them to create an account to approve a quote would
 * defeat the whole point.
 *
 * What keeps this safe:
 *   - the token is validated for shape before it ever reaches the database
 *   - the database function only acts on a quote that is still open, so a
 *     replayed or double-tapped request cannot overwrite an earlier decision
 *   - nothing here reads or returns any data; it only reports what happened
 */

const TOKEN_PATTERN = /^[0-9a-f]{32}$/;
const MAX_NAME_LENGTH = 80;

export type DecisionState = {
  error: string | null;
  done: boolean;
};

async function submitDecision(
  token: string,
  decision: "approved" | "declined",
  signatureName: string,
  reason: string,
): Promise<DecisionState> {
  if (!TOKEN_PATTERN.test(token)) {
    return { error: "הקישור אינו תקין.", done: false };
  }

  const requestHeaders = await headers();
  const ip = clientIpFromHeaders(requestHeaders);

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("record_quote_decision", {
    p_token: token,
    p_decision: decision,
    p_signature_name: signatureName.slice(0, MAX_NAME_LENGTH),
    p_ip: ip,
    p_reason: reason.slice(0, 200),
  });

  if (error) {
    return { error: "משהו השתבש. נסו שוב בעוד רגע.", done: false };
  }

  if (data === "missing_name") {
    return { error: "יש להזין שם מלא כדי לאשר.", done: false };
  }

  if (data === "unchanged") {
    // Already decided. Re-render so the page shows the final state.
    revalidatePath(`/q/${token}`);
    return { error: null, done: true };
  }

  if (data !== "ok") {
    return { error: "משהו השתבש. נסו שוב בעוד רגע.", done: false };
  }

  revalidatePath(`/q/${token}`);
  return { error: null, done: true };
}

export async function approveQuoteAction(
  _previousState: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  const token = String(formData.get("token") ?? "");
  const name = String(formData.get("signatureName") ?? "").trim();

  if (!name) {
    return { error: "יש להזין שם מלא כדי לאשר.", done: false };
  }
  if (name.length < 2) {
    return { error: "השם קצר מדי.", done: false };
  }

  return submitDecision(token, "approved", name, "");
}

export async function declineQuoteAction(
  _previousState: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  const token = String(formData.get("token") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  return submitDecision(token, "declined", "", reason);
}
