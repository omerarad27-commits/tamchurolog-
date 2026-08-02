"use client";

import { useId } from "react";

import { inputClasses } from "@/components/ui/text-field";

/**
 * The search box above a list.
 *
 * type="search" rather than type="text": on a phone it puts a clear button
 * inside the field and a "search" key on the keyboard, both of which the owner
 * already knows how to use.
 *
 * There is no submit button and no form around it, because there is nothing to
 * submit — filtering happens as the letters arrive. That also means the Enter
 * key must not reload anything, which a bare input outside a form guarantees.
 */
export function SearchField({
  label,
  placeholder,
  value,
  onValueChange,
  resultCount,
}: {
  label: string;
  placeholder: string;
  value: string;
  onValueChange: (next: string) => void;
  /** Announced to screen readers while typing, which see no visual list shrink. */
  resultCount: number;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        inputMode="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        aria-describedby={`${id}-count`}
        className={inputClasses}
      />
      <p id={`${id}-count`} role="status" aria-live="polite" className="sr-only">
        {value.trim() === ""
          ? ""
          : `${resultCount} תוצאות`}
      </p>
    </div>
  );
}

/**
 * Case- and whitespace-insensitive substring match across several fields.
 *
 * Split on spaces so "דנה אמבטיה" finds the bathroom quote for Dana without the
 * owner having to remember which order the two words appear in — on a phone,
 * typing the exact string is the part that fails.
 */
export function matchesSearch(query: string, fields: (string | null)[]): boolean {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const haystack = fields
    .filter((field): field is string => Boolean(field))
    .join(" ")
    .toLocaleLowerCase();

  return terms.every((term) => haystack.includes(term));
}
