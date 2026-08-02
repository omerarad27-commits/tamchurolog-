"use server";

import { revalidatePath } from "next/cache";

import { requireBusiness } from "@/lib/auth";
import { TIP_IDS, type TipId } from "@/lib/tips";

/**
 * Closes a tip, permanently.
 *
 * Appended rather than assigned, so two tabs closing two different tips cannot
 * overwrite each other's answer — and so a tip that has been retired from the
 * code stays recorded, which matters if it ever comes back.
 *
 * The id is checked against the known list because it arrives from the browser.
 * Nothing bad would come of storing an arbitrary short string in this column,
 * but a typo silently doing nothing is easier to debug than a typo silently
 * being saved.
 */
export async function dismissTipAction(formData: FormData): Promise<void> {
  const submitted = String(formData.get("tip") ?? "");
  if (!TIP_IDS.includes(submitted as TipId)) return;

  const { supabase, business } = await requireBusiness();

  if (business.dismissed_tips?.includes(submitted)) return;

  await supabase
    .from("businesses")
    .update({ dismissed_tips: [...(business.dismissed_tips ?? []), submitted] })
    .eq("id", business.id);

  /* Every screen that can show a tip, because the owner is about to navigate
     and the closed one must not reappear on the way. */
  revalidatePath("/dashboard", "layout");
}
