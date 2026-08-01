import { forwardRef } from "react";

const TONES = {
  error: "border-danger/30 bg-danger-soft text-danger",
  success: "border-success/30 bg-success-soft text-success",
  warning: "border-warning/30 bg-warning-soft text-warning",
  info: "border-border bg-brand-soft text-brand",
} as const;

/*
 * A ref-forwarding component, not a plain function, so a caller that needs to
 * scroll or focus the alert when it appears - the intake form's off-screen
 * error is the first case - can get at the underlying element. Every other
 * caller is unaffected: a ref nobody attaches is simply unused.
 */
export const Alert = forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<"p"> & { tone?: keyof typeof TONES }
>(function Alert({ tone = "error", className = "", children, ...rest }, ref) {
  return (
    <p
      ref={ref}
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-tile border px-3 py-2.5 text-sm ${TONES[tone]} ${className}`}
      {...rest}
    >
      {children}
    </p>
  );
});
