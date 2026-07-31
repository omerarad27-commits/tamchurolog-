import "server-only";

import {
  parseQuestions,
  type IntakeAnswers,
  type IntakeQuestion,
} from "@/lib/intake";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/*
 * Loading a questionnaire for the public page.
 *
 * The same shape as loadPublicQuote, for the same reasons: the service_role key
 * does exactly one thing here, an exact-match lookup on public_token. There is
 * no listing, no prefix match, no client-controlled filter, and every field
 * returned is chosen explicitly, so nothing about the owner or the client leaks
 * beyond what belongs on the page.
 *
 * The client's own name is deliberately NOT returned. The person holding the
 * link knows who they are, and a leaked link should confirm nothing about who
 * it was sent to.
 */

/** Tokens are 32 lowercase hex chars. Anything else never reaches the database. */
const TOKEN_PATTERN = /^[0-9a-f]{32}$/;

export type PublicIntake = {
  id: string;
  formName: string;
  businessName: string;
  questions: IntakeQuestion[];
  submittedAt: string | null;
};

export async function loadPublicIntake(
  token: string,
): Promise<PublicIntake | null> {
  if (!TOKEN_PATTERN.test(token)) return null;

  const supabase = createSupabaseAdminClient();

  const { data: request } = await supabase
    .from("intake_requests")
    .select("id, business_id, form_name, questions, submitted_at")
    .eq("public_token", token)
    .maybeSingle();

  if (!request) return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", request.business_id)
    .maybeSingle();

  return {
    id: request.id,
    formName: request.form_name,
    businessName: business?.name ?? "",
    questions: parseQuestions(request.questions),
    submittedAt: request.submitted_at,
  };
}

/**
 * Records the answers through a security definer function, so "already
 * answered" is decided by the same statement that writes.
 */
export async function submitIntake(
  token: string,
  answers: IntakeAnswers,
): Promise<"ok" | "unchanged" | "error"> {
  if (!TOKEN_PATTERN.test(token)) return "error";

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("submit_intake_request", {
    p_token: token,
    p_answers: answers,
  });

  if (error) return "error";
  return data === "ok" ? "ok" : "unchanged";
}
