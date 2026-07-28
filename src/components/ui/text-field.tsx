import type { ComponentProps } from "react";

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
        className={
          "h-12 w-full rounded-xl border border-border bg-surface px-3 text-base " +
          "placeholder:text-muted/70 " +
          "focus:border-brand focus:outline-2 focus:outline-offset-0 focus:outline-brand " +
          className
        }
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
