"use client";

import { useEffect } from "react";

import { markNotificationsReadAction } from "./actions";

/**
 * Fires once per visit to the notifications page.
 *
 * The layout that renders the bell persists across client-side navigation, so
 * marking notifications read during this page's own render never reaches it -
 * only a Server Action can `revalidatePath` the layout. This component exists
 * solely to trigger that action after mount.
 */
export function MarkNotificationsReadOnMount() {
  useEffect(() => {
    markNotificationsReadAction();
  }, []);

  return null;
}
