import Link from "next/link";
import type { ComponentProps } from "react";

/**
 * Single source of truth for anything that looks like a button.
 *
 * Some of these are <button> (submit, delete) and some are <Link> (navigate).
 * They must look identical, so the class string lives in one function and both
 * wrappers use it. Reach for `buttonClasses` directly only when you need to
 * style an element neither wrapper covers.
 */

type Variant = "primary" | "secondary" | "danger" | "dashed" | "ghost";
type Size = "md" | "sm";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-brand-foreground hover:bg-brand/90 active:bg-brand/80",
  secondary:
    "border border-border bg-surface text-foreground hover:bg-background active:bg-border/40",
  danger:
    "border border-danger/30 text-danger hover:bg-danger-soft active:bg-danger-soft/70",
  dashed:
    "border border-dashed border-border text-brand hover:bg-brand-soft active:bg-brand-soft/70",
  ghost: "text-brand hover:bg-brand-soft active:bg-brand-soft/70",
};

const SIZES: Record<Size, string> = {
  md: "h-control w-full px-4 text-base",
  sm: "h-control-sm shrink-0 px-4 text-sm",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold " +
  "transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export function buttonClasses({
  variant = "primary",
  size = "md",
  className = "",
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}) {
  return `${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`.trim();
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClasses({ variant, size, className })} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClasses({ variant, size, className })} {...props} />;
}
