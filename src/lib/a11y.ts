/**
 * Accessibility: the one file to edit.
 *
 * The statement page is a legal document under the Israeli equal-rights
 * regulations, and the two things in it that go stale — who to contact and
 * when it was last reviewed — live here rather than inside the page's prose,
 * so updating them is an edit to data and not to copy.
 */

export const A11Y_CONTACT = {
  name: "עומר ארד",
  email: "omerarad27@gmail.com",
  /* Kept as one string: it is displayed and dialled, never parsed. */
  phone: "054-3036810",
  phoneHref: "tel:+972543036810",
} as const;

/** Reviewed-on date shown at the foot of the statement. ISO, formatted on render. */
export const A11Y_STATEMENT_UPDATED = "2026-08-01";

/*
 * Versioned on purpose. If the shape of the settings ever changes, bumping the
 * key retires every stored value at once instead of leaving old browsers to
 * apply a half-understood object.
 */
export const A11Y_STORAGE_KEY = "tamchurolog:a11y:v1";

export type A11ySettings = {
  font: "normal" | "large" | "larger";
  contrast: "normal" | "high" | "dark";
  links: boolean;
  motion: boolean;
  readable: boolean;
  cursor: boolean;
};

/*
 * Every default is the "off" value, and that is what makes the whole feature
 * safe: applySettings writes no attribute for an off value, the CSS overrides
 * all hang off those attributes, and so a visitor who never opens the menu
 * gets a page with not one new rule matching anything on it.
 */
export const A11Y_DEFAULTS: A11ySettings = {
  font: "normal",
  contrast: "normal",
  links: false,
  motion: false,
  readable: false,
  cursor: false,
};

/**
 * Write the settings onto <html> as data-a11y-* attributes.
 *
 * Deliberately generic — it walks whatever keys it is given rather than
 * knowing the option list — because the pre-paint inline script in
 * settings-script.tsx is a minified copy of this logic, and a version that
 * enumerated options would have to be kept in step with it by hand.
 *
 * Browser only.
 */
export function applyA11ySettings(settings: Partial<A11ySettings>) {
  const root = document.documentElement;

  for (const [key, value] of Object.entries(settings)) {
    const attribute = `data-a11y-${key}`;

    if (!value || value === "normal") {
      root.removeAttribute(attribute);
    } else {
      root.setAttribute(attribute, value === true ? "on" : String(value));
    }
  }
}

/**
 * Read the stored settings, falling back to the defaults for anything missing
 * or unreadable.
 *
 * A display preference must never be able to break a page, so every failure
 * mode here — private browsing with localStorage disabled, corrupted JSON, a
 * value left over from a future version — lands on the defaults in silence.
 *
 * Browser only.
 */
export function readA11ySettings(): A11ySettings {
  try {
    const raw = window.localStorage.getItem(A11Y_STORAGE_KEY);
    if (!raw) return A11Y_DEFAULTS;

    const stored = JSON.parse(raw) as Partial<A11ySettings>;
    return { ...A11Y_DEFAULTS, ...stored };
  } catch {
    return A11Y_DEFAULTS;
  }
}

/** Persist the settings. Failure is not worth reporting to the visitor. */
export function storeA11ySettings(settings: A11ySettings) {
  try {
    window.localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* Private mode, or a full quota. The settings still apply for this page. */
  }
}
