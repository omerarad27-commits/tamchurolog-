"use server";

import { revalidatePath } from "next/cache";

import { requireBusiness } from "@/lib/auth";
import type { FormState } from "@/lib/validation";

const MAX_NAME_LENGTH = 120;
const MAX_PRICE = 9_999_999;

/*
 * Every action here revalidates the quote builder as well as the list.
 *
 * The builder receives the price list as a prop from the server, so an item
 * added on this screen would otherwise stay invisible in the picker until
 * something else happened to invalidate that page.
 */
function revalidatePriceList(): void {
  revalidatePath("/dashboard/pricelist");
  revalidatePath("/dashboard/quotes/new");
}

/** Accepts "450", "450.5" and "450,5", because owners type on phones. */
function parsePrice(value: unknown): number | null {
  const cleaned = String(value ?? "").trim().replace(",", ".");
  if (cleaned === "") return null;

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_PRICE) return null;

  return Math.round(parsed * 100) / 100;
}

function readFields(
  formData: FormData,
): { name: string; unit_price: number } | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "יש להזין שם לפריט." };
  if (name.length > MAX_NAME_LENGTH) {
    return { error: `שם הפריט ארוך מדי (עד ${MAX_NAME_LENGTH} תווים).` };
  }

  const price = parsePrice(formData.get("unitPrice"));
  if (price === null) {
    return { error: "יש להזין מחיר תקין לפריט." };
  }

  return { name, unit_price: price };
}

export async function createPriceItemAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, business } = await requireBusiness();

  const parsed = readFields(formData);
  if ("error" in parsed) return { error: parsed.error, success: null };

  /*
   * New items land at the bottom, where the owner expects what they just typed
   * to appear. Reading the current maximum rather than counting rows: a list
   * that has had items deleted has gaps, and count() would collide with an
   * existing sort_order and make the arrows appear to do nothing.
   */
  const { data: last } = await supabase
    .from("price_list_items")
    .select("sort_order")
    .eq("business_id", business.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("price_list_items").insert({
    business_id: business.id,
    name: parsed.name,
    unit_price: parsed.unit_price,
    sort_order: (last?.sort_order ?? 0) + 1,
  });

  if (error) {
    return { error: "שמירת הפריט נכשלה. נסה שוב.", success: null };
  }

  revalidatePriceList();
  return { error: null, success: `"${parsed.name}" נוסף למחירון.` };
}

export async function updatePriceItemAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, business } = await requireBusiness();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "הפריט לא נמצא.", success: null };

  const parsed = readFields(formData);
  if ("error" in parsed) return { error: parsed.error, success: null };

  const { error } = await supabase
    .from("price_list_items")
    .update({ name: parsed.name, unit_price: parsed.unit_price })
    .eq("id", id)
    .eq("business_id", business.id);

  if (error) {
    return { error: "עדכון הפריט נכשל. נסה שוב.", success: null };
  }

  revalidatePriceList();
  return { error: null, success: "הפריט עודכן." };
}

export async function deletePriceItemAction(formData: FormData): Promise<void> {
  const { supabase, business } = await requireBusiness();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase
    .from("price_list_items")
    .delete()
    .eq("id", id)
    .eq("business_id", business.id);

  revalidatePriceList();
}

/**
 * Moves an item one place up or down.
 *
 * The neighbour is resolved here rather than passed in, so a stale page cannot
 * ask to swap two items that are no longer adjacent. The swap itself happens in
 * one database function, which locks both rows.
 */
export async function movePriceItemAction(formData: FormData): Promise<void> {
  const { supabase, business } = await requireBusiness();

  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id || (direction !== "up" && direction !== "down")) return;

  const { data: items } = await supabase
    .from("price_list_items")
    .select("id")
    .eq("business_id", business.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const ordered = items ?? [];
  const index = ordered.findIndex((item) => item.id === id);
  if (index === -1) return;

  const neighbour = ordered[index + (direction === "up" ? -1 : 1)];
  if (!neighbour) return;

  await supabase.rpc("swap_price_list_order", {
    p_first: id,
    p_second: neighbour.id,
  });

  revalidatePriceList();
}

/**
 * Saves a line the owner typed by hand into the price list.
 *
 * Called from the quote builder's "save this for next time?" offer, which is
 * why it takes plain values rather than a form: at that point the line already
 * exists on screen and there is nothing to submit.
 *
 * Silently does nothing on a duplicate name. The offer is a convenience, and
 * an error toast about it while someone is mid-quote would be worse than the
 * duplicate.
 */
export async function rememberPriceItemAction(
  name: string,
  unitPrice: number,
): Promise<void> {
  const { supabase, business } = await requireBusiness();

  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  if (!trimmed) return;
  if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > MAX_PRICE) {
    return;
  }

  const { data: existing } = await supabase
    .from("price_list_items")
    .select("id")
    .eq("business_id", business.id)
    .ilike("name", trimmed)
    .maybeSingle();

  if (existing) return;

  const { data: last } = await supabase
    .from("price_list_items")
    .select("sort_order")
    .eq("business_id", business.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("price_list_items").insert({
    business_id: business.id,
    name: trimmed,
    unit_price: Math.round(unitPrice * 100) / 100,
    sort_order: (last?.sort_order ?? 0) + 1,
  });

  /*
   * Only the price list screen. Deliberately not the quote builder, which is the
   * page the owner is standing on when this runs: revalidating it would re-render
   * the form they are halfway through filling in, to add an item to a picker they
   * are not currently looking at. The builder picks it up on its next load.
   */
  revalidatePath("/dashboard/pricelist");
}
