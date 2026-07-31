"use server";

import { revalidatePath } from "next/cache";

import { requireBusiness } from "@/lib/auth";
import { parseQuestions, validateQuestions } from "@/lib/intake";

export type IntakeSendState = {
  error: string | null;
  /** The token of the request just created, used to build the WhatsApp link. */
  token: string | null;
};

export const EMPTY_INTAKE_SEND_STATE: IntakeSendState = {
  error: null,
  token: null,
};

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
    return { error: "יש לבחור שאלון.", token: null };
  }

  const { data: form } = await supabase
    .from("intake_forms")
    .select("id, name, questions")
    .eq("id", formId)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!form) return { error: "השאלון לא נמצא.", token: null };

  const questions = parseQuestions(form.questions);
  const problem = validateQuestions(questions);
  if (problem) {
    return { error: "השאלון אינו תקין. פתח אותו ותקן לפני השליחה.", token: null };
  }

  // The client is re-read under RLS rather than trusted from the URL: this
  // action is reachable by POST like any other.
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!client) return { error: "הלקוח לא נמצא.", token: null };

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
    return { error: "יצירת הקישור נכשלה. נסה שוב.", token: null };
  }

  revalidatePath(`/dashboard/clients/${clientId}`);
  return { error: null, token: created.public_token };
}
