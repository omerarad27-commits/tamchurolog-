import type { ComponentProps } from "react";

/**
 * Shared look for every single-line control: inputs, selects, and the bare
 * inputs inside the quote builder. Exported so those stay in sync with the
 * fields rendered by <TextField>.
 */
export const inputClasses =
  "h-control w-full rounded-control border border-border bg-surface px-3 text-base " +
  "placeholder:text-muted/70 " +
  "focus:border-brand focus:outline-2 focus:outline-offset-0 focus:outline-brand";

type TextFieldProps = ComponentProps<"input"> & {
  label: string;
  name: string;
  hint?: string;
};

export function TextField({
  label,
  name,
  hint,
  className = "",
  ...props
}: TextFieldProps) {
  const hintId = hint ? `${name}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-describedby={hintId}
        className={`${inputClasses} ${className}`}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
