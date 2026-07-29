"use client";

import { useState } from "react";

import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_LABELS,
  type BusinessType,
} from "@/lib/business-type";

/**
 * Radio cards rather than a dropdown.
 *
 * The choice decides whether quotes charge VAT, so it should not be something
 * the owner scrolls past without reading. Three visible options with their
 * consequence written underneath make the wrong pick harder to make by
 * accident than a closed select would.
 */
export function BusinessTypePicker({
  name = "businessType",
  defaultValue = "licensed",
  label = "סוג העסק",
}: {
  name?: string;
  defaultValue?: BusinessType;
  label?: string;
}) {
  const [selected, setSelected] = useState<BusinessType>(defaultValue);

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium text-foreground">
        {label}
      </legend>

      <div className="flex flex-col gap-2">
        {BUSINESS_TYPES.map((type) => {
          const { label: typeLabel, hint } = BUSINESS_TYPE_LABELS[type];
          const isSelected = selected === type;

          return (
            <label
              key={type}
              className={
                "flex cursor-pointer items-center gap-3 rounded-tile border px-3 py-3 transition-colors " +
                (isSelected
                  ? "border-brand bg-brand-soft"
                  : "border-border bg-surface hover:bg-background")
              }
            >
              <input
                type="radio"
                name={name}
                value={type}
                checked={isSelected}
                onChange={() => setSelected(type)}
                className="h-4 w-4 shrink-0 accent-[color:var(--brand)]"
              />
              <span className="min-w-0">
                <span className="block font-medium">{typeLabel}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
