"use server";

import { revalidatePath } from "next/cache";

import { requireBusiness } from "@/lib/auth";
import { normalizeIsraeliPhone } from "@/lib/phone";
import type { FormState } from "@/lib/validation";

const LOGO_MAX_BYTES = 2 * 1024 * 1024;

const LOGO_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

const LOGOS_PUBLIC_PREFIX = "/storage/v1/object/public/logos/";

/** Turns a public logo URL back into its storage path, for deleting the old file. */
function storagePathFromPublicUrl(url: string): string | null {
  const index = url.indexOf(LOGOS_PUBLIC_PREFIX);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + LOGOS_PUBLIC_PREFIX.length));
}

export async function updateBusinessAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  // Re-checked here rather than trusting proxy.ts to have run.
  const { supabase, business } = await requireBusiness();

  const name = String(formData.get("name") ?? "").trim();
  const phoneInput = String(formData.get("phone") ?? "").trim();
  const defaultTerms = String(formData.get("defaultTerms") ?? "").trim();
  const removeLogo = formData.get("removeLogo") === "on";
  const logo = formData.get("logo");

  if (!name) {
    return { error: "יש להזין את שם העסק.", success: null };
  }
  if (name.length > 80) {
    return { error: "שם העסק ארוך מדי (עד 80 תווים).", success: null };
  }

  let phone: string | null = null;
  if (phoneInput) {
    const normalized = normalizeIsraeliPhone(phoneInput);
    if (!normalized) {
      return {
        error: "מספר הטלפון אינו תקין. לדוגמה: 054-1234567 או 03-1234567.",
        success: null,
      };
    }
    phone = normalized.e164;
  }

  let logoUrl: string | null = business.logo_url;
  let previousLogoPath: string | null = null;

  const hasNewLogo = logo instanceof File && logo.size > 0;

  if (hasNewLogo) {
    const extension = LOGO_EXTENSIONS[logo.type];
    if (!extension) {
      return {
        error: "סוג הקובץ אינו נתמך. אפשר להעלות PNG, JPG, WEBP או SVG.",
        success: null,
      };
    }
    if (logo.size > LOGO_MAX_BYTES) {
      return { error: "הקובץ גדול מדי. הגודל המרבי הוא 2MB.", success: null };
    }

    // Timestamped filename so a replaced logo is never served from cache.
    const path = `${business.id}/logo-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(path, logo, { contentType: logo.type, upsert: false });

    if (uploadError) {
      return { error: "העלאת הלוגו נכשלה. נסה שוב.", success: null };
    }

    previousLogoPath = business.logo_url
      ? storagePathFromPublicUrl(business.logo_url)
      : null;

    logoUrl = supabase.storage.from("logos").getPublicUrl(path).data.publicUrl;
  } else if (removeLogo) {
    previousLogoPath = business.logo_url
      ? storagePathFromPublicUrl(business.logo_url)
      : null;
    logoUrl = null;
  }

  const { error } = await supabase
    .from("businesses")
    .update({
      name,
      phone,
      default_terms: defaultTerms || null,
      logo_url: logoUrl,
    })
    .eq("id", business.id);

  if (error) {
    return { error: "שמירת הפרטים נכשלה. נסה שוב.", success: null };
  }

  // Only after the row is saved, so a failed update never orphans the logo.
  if (previousLogoPath) {
    await supabase.storage.from("logos").remove([previousLogoPath]);
  }

  revalidatePath("/dashboard", "layout");

  return { error: null, success: "הפרטים נשמרו." };
}
