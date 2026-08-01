"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  A11Y_DEFAULTS,
  applyA11ySettings,
  readA11ySettings,
  storeA11ySettings,
  type A11ySettings,
} from "@/lib/a11y";

/*
 * The accessibility menu.
 *
 * It changes nothing but six data attributes on <html>. Every visual effect
 * lives in globals.css as an override of a token the site already paints
 * through, which is why turning on high contrast reaches a page this component
 * has never heard of, and why the default state cannot affect anything at all.
 */

type Choice<T extends string> = { value: T; label: string };

const FONT_CHOICES: Choice<A11ySettings["font"]>[] = [
  { value: "normal", label: "רגיל" },
  { value: "large", label: "גדול" },
  { value: "larger", label: "גדול מאוד" },
];

const CONTRAST_CHOICES: Choice<A11ySettings["contrast"]>[] = [
  { value: "normal", label: "רגיל" },
  { value: "high", label: "ניגודיות גבוהה" },
  { value: "dark", label: "כהה" },
];

/** The settings that are a plain on/off, as opposed to the two that pick a value. */
type ToggleKey = {
  [K in keyof A11ySettings]: A11ySettings[K] extends boolean ? K : never;
}[keyof A11ySettings];

const TOGGLES: { key: ToggleKey; label: string }[] = [
  { key: "links", label: "הדגשת קישורים" },
  { key: "motion", label: "עצירת אנימציות" },
  { key: "readable", label: "פונט קריא" },
  { key: "cursor", label: "סמן עכבר גדול" },
];

export function AccessibilityWidget() {
  /*
   * Starts at the defaults so the server and the first client render agree.
   * The stored settings are already on <html> by now — the inline script put
   * them there before paint — so this is only about which controls read as
   * selected, inside a dialog that is closed.
   */
  const [settings, setSettings] = useState<A11ySettings>(A11Y_DEFAULTS);
  const [open, setOpen] = useState(false);

  const dialogRef = useRef<HTMLDialogElement>(null);

  /*
   * The stored settings are read when the menu opens, not on mount. They are
   * already applied to the page by then — the inline script did that before
   * paint — so the only thing that needs them is the controls, and nothing can
   * see the controls until this runs.
   */
  function openMenu() {
    setSettings(readA11ySettings());
    setOpen(true);
  }

  /*
   * showModal() rather than the open attribute: it is what makes the browser
   * trap focus, mark the rest of the page inert, and close on Escape. Doing
   * those three by hand is where custom menus usually go wrong.
   */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function update(patch: Partial<A11ySettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    applyA11ySettings(next);
    storeA11ySettings(next);
  }

  function reset() {
    setSettings(A11Y_DEFAULTS);
    applyA11ySettings(A11Y_DEFAULTS);
    storeA11ySettings(A11Y_DEFAULTS);
  }

  return (
    /* print-hide: a floating button is meaningless on paper. */
    <div className="print-hide">
      <button
        type="button"
        onClick={openMenu}
        aria-haspopup="dialog"
        aria-label="פתיחת תפריט נגישות"
        /*
          Bottom left — the far side from where the eye starts a line of
          Hebrew, so it never lands on top of the text being read. Fixed at the
          same 48px as every other touch target in the app.
        */
        className="fixed bottom-4 left-4 z-50 flex h-control w-control items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg transition-colors hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <AccessibilityIcon />
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        aria-labelledby="a11y-menu-title"
        /*
          The dialog is positioned rather than centred: it belongs next to the
          button that opened it, and on a phone it fills the width with a
          margin. backdrop styling is in globals.css, which is the only place
          ::backdrop can be reached from.
        */
        className="fixed inset-auto bottom-4 left-4 m-0 max-h-[85dvh] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-card border border-border bg-surface p-5 text-foreground shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="a11y-menu-title" className="text-lg font-bold">
            הגדרות נגישות
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="סגירת תפריט הנגישות"
            className="-m-2 shrink-0 rounded-control p-2 text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-5">
          <ChoiceGroup
            legend="גודל טקסט"
            name="a11y-font"
            choices={FONT_CHOICES}
            value={settings.font}
            onChange={(font) => update({ font })}
          />

          <ChoiceGroup
            legend="ניגודיות"
            name="a11y-contrast"
            choices={CONTRAST_CHOICES}
            value={settings.contrast}
            onChange={(contrast) => update({ contrast })}
          />

          <fieldset className="flex flex-col gap-1">
            <legend className="mb-2 text-sm font-semibold">התאמות נוספות</legend>
            {TOGGLES.map(({ key, label }) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-3 rounded-control px-1 py-2 hover:bg-background"
              >
                <input
                  type="checkbox"
                  checked={settings[key] === true}
                  onChange={(event) =>
                    /*
                     * The assertion is only about the computed key: TypeScript
                     * widens { [key]: boolean } to a string index signature and
                     * loses the fact that ToggleKey is exactly the boolean
                     * fields. ToggleKey is derived from A11ySettings, so this
                     * cannot name a field that is not one.
                     */
                    update({ [key]: event.target.checked } as Pick<
                      A11ySettings,
                      ToggleKey
                    >)
                  }
                  className="h-5 w-5 shrink-0 accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <Button type="button" variant="secondary" size="sm" onClick={reset}>
              איפוס ההגדרות
            </Button>

            <Link
              href="/accessibility"
              onClick={() => setOpen(false)}
              className="text-center text-sm font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              הצהרת הנגישות של האתר
            </Link>
          </div>
        </div>
      </dialog>
    </div>
  );
}

/**
 * A radio group styled as a segmented control.
 *
 * Radios rather than buttons with aria-pressed: the choices are exclusive, and
 * a real radio group gets arrow-key navigation and the "2 of 3" announcement
 * from the browser instead of from us.
 */
function ChoiceGroup<T extends string>({
  legend,
  name,
  choices,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <div className="flex gap-2">
        {choices.map((choice) => {
          const selected = choice.value === value;

          return (
            <label
              key={choice.value}
              className={`flex flex-1 cursor-pointer items-center justify-center rounded-control border px-2 py-2 text-center text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${
                selected
                  ? "border-brand bg-brand-soft font-semibold text-brand"
                  : "border-border hover:bg-background"
              }`}
            >
              <input
                type="radio"
                name={name}
                checked={selected}
                onChange={() => onChange(choice.value)}
                className="sr-only"
              />
              {choice.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/* The international symbol of access. Decorative — the button carries the name. */
function AccessibilityIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-6 w-6"
    >
      <circle cx="12" cy="4" r="2" />
      <path d="M20 7.5c0 .7-.6 1.2-1.3 1.3L15 9.3v3.1l2.3 7.2a1.3 1.3 0 0 1-2.4.8L12.6 14h-1.2l-2.3 6.4a1.3 1.3 0 0 1-2.4-.8L9 12.4V9.3L5.3 8.8A1.3 1.3 0 0 1 5.5 6.3l4.9.7c1 .1 2.2.1 3.2 0l4.9-.7c.8-.1 1.5.4 1.5 1.2Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="h-5 w-5"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
