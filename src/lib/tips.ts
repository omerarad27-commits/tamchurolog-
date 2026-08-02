/**
 * In-app guidance.
 *
 * The owner will not find the price list on their own and will not read a
 * guide to learn why they want one. They also did not come here to be taught
 * anything — they came to send a quote. So there is no tour, no checklist and
 * no modal: one small sentence, next to the thing it is about, at the moment
 * the app can see it would help.
 *
 * The rules every tip obeys, enforced by this module and the component that
 * renders it:
 *
 *   one at a time      a screen with two suggestions on it is a screen the
 *                      owner learns to scroll past
 *   never blocking     no overlay, no dimmed background, nothing to close
 *                      before carrying on
 *   once, forever      dismissed is dismissed, on every device, which is why
 *                      that fact lives on the business row and not in the
 *                      browser
 *   earned             a tip only appears once the owner has done the thing
 *                      that makes it relevant. Three quotes typed by hand is
 *                      evidence; a fresh signup is not
 */

export const TIP_IDS = ["price_list", "duplicate", "search"] as const;

export type TipId = (typeof TIP_IDS)[number];

/**
 * The quotes an owner has to have written before the price list is worth
 * mentioning. Below this they have no repetition to notice yet, and the tip is
 * a stranger telling them how to do their job.
 */
export const PRICE_LIST_TIP_AFTER_QUOTES = 3;

/** Where a list stops being scannable and search starts being the fast path. */
export const SEARCH_TIP_AFTER_QUOTES = 20;

/**
 * Picks the one tip to show, in the caller's order of preference.
 *
 * Candidates are the tips whose conditions the screen has already found to
 * hold. This only enforces the two rules that are not about conditions: that a
 * dismissed tip never returns, and that two tips never appear together.
 */
export function pickTip(
  candidates: TipId[],
  dismissed: readonly string[] | null | undefined,
): TipId | null {
  const seen = new Set(dismissed ?? []);
  return candidates.find((tip) => !seen.has(tip)) ?? null;
}
