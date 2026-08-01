"use server";

import { requireBusiness } from "@/lib/auth";
import {
  type IntakeSendState,
  parseQuestions,
  validateQuestions,
} from "@/lib/intake";

/**
 * Creates one sent copy of a saved questionnaire.
 *
 * The questions and the form name are COPIED onto the request here. From this
 * point the saved form can be edited or deleted without touching the link now
 * in the client's hands, and the answers stay attached to what was actually
 * asked.
 */
export async function createIntakeRequestAction(
  _previousState: IntakeSendState,
  formData: FormData,
): Promise<IntakeSendState> {
  const { supabase, business } = await requireBusiness();

  const clientId = String(formData.get("clientId") ?? "");
  const formId = String(formData.get("formId") ?? "");
  if (!clientId || !formId) {
    return { error: "יש לבחור שאלון.", token: null, formId: null };
  }

  const { data: form } = await supabase
    .from("intake_forms")
    .select("id, name, questions")
    .eq("id", formId)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!form) return { error: "השאלון לא נמצא.", token: null, formId: null };

  const questions = parseQuestions(form.questions);
  const problem = validateQuestions(questions);
  if (problem) {
    return {
      error: "השאלון אינו תקין. פתח אותו ותקן לפני השליחה.",
      token: null,
      formId: null,
    };
  }

  // The client is re-read under RLS rather than trusted from the URL: this
  // action is reachable by POST like any other.
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!client) return { error: "הלקוח לא נמצא.", token: null, formId: null };

  const { data: created, error } = await supabase
    .from("intake_requests")
    .insert({
      business_id: business.id,
      form_id: form.id,
      client_id: client.id,
      form_name: form.name,
      questions,
    })
    .select("public_token")
    .single();

  if (error || !created) {
    return { error: "יצירת הקישור נכשלה. נסה שוב.", token: null, formId: null };
  }

  /*
   * Deliberately NO revalidatePath here, and this is not an oversight.
   *
   * It used to call revalidatePath on this client's page. That re-renders the
   * route and ships a fresh RSC payload, which remounts this client component
   * and wipes the useActionState value we are about to return -- the token the
   * WhatsApp button is built from. Measured: with the call, the button failed
   * to appear on 3 of 6 runs even though the row was created every time. The
   * owner tapped "prepare a link", the row landed, and nothing happened on
   * screen.
   *
   * The token is returned to the caller instead, which is immune to it. The
   * request's own card on this page picks the row up on the next load, and
   * that card carries its own WhatsApp link, so the link is never lost - it
   * just is not painted twice during the same interaction.
   */
  return { error: null, token: created.public_token, formId: form.id };
}
