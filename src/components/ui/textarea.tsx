import type { ComponentProps } from "react";

type TextAreaProps = ComponentProps<"textarea"> & {
  label: string;
  name: string;
  hint?: string;
};

export function TextArea({
  label,
  name,
  hint,
  rows = 4,
  className = "",
  ...props
}: TextAreaProps) {
  const hintId = hint ? `${name}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        aria-describedby={hintId}
        className={
          "w-full rounded-control border border-border bg-surface px-3 py-2.5 text-base leading-relaxed " +
          /* Matches text-field.tsx: the faded muted fell under 4.5:1. */
          "placeholder:text-muted " +
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
