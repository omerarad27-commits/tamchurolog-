"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

import { deleteFormAction } from "./actions";

export function DeleteFormButton({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="danger" onClick={() => setConfirming(true)}>
        מחיקת השאלון
      </Button>
    );
  }

  return (
    <form action={deleteFormAction} className="flex flex-col gap-2">
      <input type="hidden" name="formId" value={id} />
      <p className="text-sm text-muted">
        למחוק את &quot;{name}&quot;? שאלונים שכבר נשלחו והתשובות עליהם יישמרו.
      </p>
      <div className="flex gap-2">
        <SubmitButton variant="danger" pendingLabel="מוחק…">
          כן, למחוק
        </SubmitButton>
        <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
          ביטול
        </Button>
      </div>
    </form>
  );
}
