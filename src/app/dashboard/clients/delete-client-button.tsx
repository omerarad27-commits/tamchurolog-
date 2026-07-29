"use client";

import { SubmitButton } from "@/components/ui/submit-button";

import { deleteClientAction } from "./actions";

/**
 * Deletion is irreversible and the button sits right under the save button on a
 * small screen, so it asks first. Once confirmed it goes through SubmitButton,
 * which disables itself so an impatient second tap cannot fire another delete.
 */
export function DeleteClientButton({
  id,
  fullName,
}: {
  id: string;
  fullName: string;
}) {
  return (
    <form
      action={deleteClientAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `למחוק את ${fullName}? הפעולה אינה הפיכה.`,
        );
        if (!confirmed) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="danger" pendingLabel="מוחק…">
        מחיקת הלקוח
      </SubmitButton>
    </form>
  );
}
