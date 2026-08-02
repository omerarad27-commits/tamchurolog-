import { forwardRef, type ComponentProps } from "react";

/**
 * Shared look for every single-line control: inputs, selects, and the bare
 * inputs inside the quote builder. Exported so those stay in sync with the
 * fields rendered by <TextField>.
 */
export const inputClasses =
  "h-control w-full rounded-control border border-border bg-surface px-3 text-base " +
  /* Full --muted, not muted/70: the faded version came out at about 3.2:1
     against the field, under the 4.5 that placeholder text has to clear. */
  "placeholder:text-muted " +
  "focus:border-brand focus:outline-2 focus:outline-offset-0 focus:outline-brand";

type TextFieldProps = ComponentProps<"input"> & {
  label: string;
  name: string;
  hint?: string;
};

/*
 * Ref-forwarding, so a caller that needs the element itself can have it. The
 * price list uses it to put the cursor back on the name field after each add,
 * which is the difference between typing a list of eight items and reaching for
 * the field eight times.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField({ label, name, hint, id, className = "", ...props }, ref) {
  /*
   * The field name doubles as the element id, which is right almost everywhere:
   * one form per screen, one field per name. Where that does not hold — two
   * copies of the same form on one page, such as the price list's add form and
   * an open row editor — the caller passes an id and the label follows it.
   * Without that, two elements share an id and the label points at whichever
   * one the browser happens to find first.
   */
  const fieldId = id ?? name;
  const hintId = hint ? `${fieldId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        ref={ref}
        id={fieldId}
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
  },
);
