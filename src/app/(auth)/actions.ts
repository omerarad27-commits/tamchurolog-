"use server";

import type { AuthError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { toBusinessType } from "@/lib/business-type";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  MIN_PASSWORD_LENGTH,
  validateCredentials,
  type AuthFormState,
} from "@/lib/validation";

/** Supabase returns English error codes; the owner should never see them. */
function hebrewAuthError(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "אימייל או סיסמה שגויים.";
    case "user_already_exists":
    case "email_exists":
      return "כתובת האימייל הזו כבר רשומה במערכת. אפשר פשוט להתחבר.";
    case "weak_password":
      return `הסיסמה חלשה מדי. בחר סיסמה באורך ${MIN_PASSWORD_LENGTH} תווים לפחות.`;
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "יותר מדי ניסיונות. נסה שוב בעוד כמה דקות.";
    case "email_not_confirmed":
      return "החשבון עדיין לא אומת. בדוק את תיבת המייל שלך.";
    case "email_address_invalid":
    case "validation_failed":
      return "אחד הפרטים שהוזנו אינו תקין.";
    default:
      return "משהו השתבש בהתחברות. נסה שוב בעוד רגע.";
  }
}

export async function signUpAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const businessName = String(formData.get("businessName") ?? "").trim();

  if (!businessName) {
    return { error: "יש להזין את שם העסק." };
  }

  const validationError = validateCredentials(email, password);
  if (validationError) {
    return { error: validationError };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    // Read by the on_auth_user_created trigger to set up the business row.
    options: {
      data: {
        business_name: businessName,
        business_type: toBusinessType(formData.get("businessType")),
      },
    },
  });

  if (error) {
    return { error: hebrewAuthError(error) };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signInAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeRedirectPath(formData.get("next"));

  const validationError = validateCredentials(email, password);
  if (validationError) {
    return { error: validationError };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: hebrewAuthError(error) };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/login");
}
