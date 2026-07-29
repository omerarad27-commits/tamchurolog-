"use client";

import { Button } from "@/components/ui/button";

import { deleteClientAction } from "./actions";

/**
 * Deletion is irreversible and the button sits right under the save button on a
 * small screen, so it asks first.
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
      <Button type="submit" variant="danger">
        מחיקת הלקוח
      </Button>
    </form>
  );
}
