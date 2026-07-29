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
  disabled = false,
  disabledLabel,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "danger";
  size?: "md" | "sm";
  /** For work that must finish before submitting, e.g. resizing an image. */
  disabled?: boolean;
  disabledLabel?: string;
}) {
  const { pending } = useFormStatus();
  const busy = pending || disabled;

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={busy}
      aria-busy={busy}
    >
      {pending ? pendingLabel : disabled ? (disabledLabel ?? pendingLabel) : children}
    </Button>
  );
}
