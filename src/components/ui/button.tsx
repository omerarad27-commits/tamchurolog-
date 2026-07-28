import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-brand-foreground hover:bg-brand/90 active:bg-brand/80",
  secondary:
    "bg-surface text-foreground border border-border hover:bg-background active:bg-border/40",
  ghost: "text-brand hover:bg-brand-soft active:bg-brand-soft/70",
};

// h-12 keeps every tappable control at ~48px, comfortably above the 44px
// minimum touch target. These screens are used one-handed on a phone.
const BASE =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 " +
  "text-base font-semibold transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return (
    <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />
  );
}
