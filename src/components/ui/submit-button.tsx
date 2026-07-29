"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

/**
 * Submit button that disables itself while its form is pending.
 *
 * This is what stops a second tap on a slow connection from producing a
 * duplicate signup, a duplicate client, or a second approval attempt. Every
 * form in the app submits through this.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "danger";
  size?: "md" | "sm";
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
