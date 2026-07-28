"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireBusiness } from "@/lib/auth";
import { normalizeIsraeliPhone } from "@/lib/phone";
import { isValidEmail, type FormState } from "@/lib/validation";

type ClientFields = {
  full_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

/** Shared validation, returning either the row values or a Hebrew error. */
function readClientFields(
  formData: FormData,
): { fields: ClientFields } | { error: string } {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phoneInput = String(formData.get("phone") ?? "").trim();
  const emailInput = String(formData.get("email") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!fullName) return { error: "יש להזין את שם הלקוח." };
  if (fullName.length > 80) {
    return { error: "שם הלקוח ארוך מדי (עד 80 תווים)." };
  }

  let phone: string | null = null;
  if (phoneInput) {
    const normalized = normalizeIsraeliPhone(phoneInput);
    if (!normalized) {
      return { error: "מספר הטלפון אינו תקין. לדוגמה: 054-1234567." };
    }
    phone = normalized.e164;
  }

  if (emailInput && !isValidEmail(emailInput)) {
    return { error: "כתובת האימייל אינה תקינה." };
  }

  return {
    fields: {
      full_name: fullName,
      phone,
      email: emailInput.toLowerCase() || null,
      notes: notes || null,
    },
  };
}

export async function createClientAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, business } = await requireBusiness();

  const parsed = readClientFields(formData);
  if ("error" in parsed) return { error: parsed.error, success: null };

  const { error } = await supabase
    .from("clients")
    .insert({ ...parsed.fields, business_id: business.id });

  if (error) {
    return { error: "שמירת הלקוח נכשלה. נסה שוב.", success: null };
  }

  revalidatePath("/dashboard/clients");
  redirect("/dashboard/clients");
}

export async function updateClientAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, business } = await requireBusiness();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "לקוח לא נמצא.", success: null };

  const parsed = readClientFields(formData);
  if ("error" in parsed) return { error: parsed.error, success: null };

  // business_id is matched as well as id: RLS already blocks other tenants, but
  // this keeps the intent explicit at the call site.
  const { error } = await supabase
    .from("clients")
    .update(parsed.fields)
    .eq("id", id)
    .eq("business_id", business.id);

  if (error) {
    return { error: "עדכון הלקוח נכשל. נסה שוב.", success: null };
  }

  revalidatePath("/dashboard/clients");
  redirect("/dashboard/clients");
}

export async function deleteClientAction(formData: FormData): Promise<void> {
  const { supabase, business } = await requireBusiness();

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/dashboard/clients");

  await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .eq("business_id", business.id);

  revalidatePath("/dashboard/clients");
  redirect("/dashboard/clients");
}
