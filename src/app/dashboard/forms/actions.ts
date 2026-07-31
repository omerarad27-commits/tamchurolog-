"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireBusiness } from "@/lib/auth";
import {
  MAX_FORM_NAME_LENGTH,
  parseQuestions,
  validateQuestions,
  type IntakeQuestion,
} from "@/lib/intake";
import type { FormState } from "@/lib/validation";

/**
 * Reads the name and the questions out of the form.
 *
 * The questions arrive as one JSON string in a hidden field, the same way the
 * quote builder ships its line items. Everything in it is re-validated here:
 * the browser is where it was assembled, so nothing it says is trusted.
 */
function readForm(
  formData: FormData,
): { name: string; questions: IntakeQuestion[] } | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "יש לתת שם לשאלון." };
  if (name.length > MAX_FORM_NAME_LENGTH) {
    return { error: `שם השאלון ארוך מדי (עד ${MAX_FORM_NAME_LENGTH} תווים).` };
  }

  let raw: unknown = null;
  try {
    raw = JSON.parse(String(formData.get("questions") ?? "[]"));
  } catch {
    return { error: "שמירת השאלון נכשלה. נסה שוב." };
  }

  const questions = parseQuestions(raw);
  const problem = validateQuestions(questions);
  if (problem) return { error: problem };

  return { name, questions };
}

export async function createFormAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, business } = await requireBusiness();

  const parsed = readForm(formData);
  if ("error" in parsed) return { error: parsed.error, success: null };

  const { error } = await supabase.from("intake_forms").insert({
    business_id: business.id,
    name: parsed.name,
    questions: parsed.questions,
  });

  if (error) return { error: "שמירת השאלון נכשלה. נסה שוב.", success: null };

  revalidatePath("/dashboard/forms");
  redirect("/dashboard/forms");
}

export async function updateFormAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, business } = await requireBusiness();

  const id = String(formData.get("formId") ?? "");
  if (!id) return { error: "השאלון לא נמצא.", success: null };

  const parsed = readForm(formData);
  if ("error" in parsed) return { error: parsed.error, success: null };

  // business_id is matched as well as id. RLS already blocks other tenants;
  // this keeps the intent visible at the call site.
  const { error } = await supabase
    .from("intake_forms")
    .update({
      name: parsed.name,
      questions: parsed.questions,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("business_id", business.id);

  if (error) return { error: "עדכון השאלון נכשל. נסה שוב.", success: null };

  revalidatePath("/dashboard/forms");
  redirect("/dashboard/forms");
}

export async function deleteFormAction(formData: FormData): Promise<void> {
  const { supabase, business } = await requireBusiness();

  const id = String(formData.get("formId") ?? "");
  if (!id) redirect("/dashboard/forms");

  /*
   * Requests already sent survive this: intake_requests.form_id is
   * "on delete set null", and every request carries its own copy of the
   * questions and the form name. Deleting a form retires it from the library
   * without erasing what a client already answered.
   */
  await supabase
    .from("intake_forms")
    .delete()
    .eq("id", id)
    .eq("business_id", business.id);

  revalidatePath("/dashboard/forms");
  redirect("/dashboard/forms");
}
