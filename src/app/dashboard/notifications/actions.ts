"use server";

import { revalidatePath } from "next/cache";

import { requireBusiness } from "@/lib/auth";
import { markAllNotificationsRead } from "@/lib/notifications";

/**
 * Runs after the page has already rendered (see `MarkNotificationsReadOnMount`),
 * not during it: `revalidatePath` throws when called mid-render, so the bell's
 * cached unread count can only be invalidated from a Server Action.
 */
export async function markNotificationsReadAction(): Promise<void> {
  const context = await requireBusiness();
  await markAllNotificationsRead(context);
  revalidatePath("/dashboard", "layout");
}
