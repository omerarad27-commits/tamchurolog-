/**
 * Logical order to visual order, for text handed to a renderer with no bidi.
 *
 * Browsers implement the Unicode bidirectional algorithm, so every Hebrew
 * string in this codebase is written in logical order and comes out right.
 * Satori — the engine behind next/og, and the only place we draw text
 * ourselves — does not. It lays glyphs left to right in the order given, which
 * renders Hebrew backwards and puts a quote number on the wrong side of the
 * words. Verified against a browser rendering the same string: no combination
 * of direction, textAlign or RLM marks changes it.
 *
 * So the reordering happens here, and the result is only ever fed to Satori.
 * Never apply this to anything a browser will lay out: it would reverse text
 * that was already going to be correct.
 *
 * This is not a full implementation of the bidi algorithm. It handles a single
 * paragraph of right-to-left text containing left-to-right islands — Hebrew
 * with numbers, prices and the occasional Latin brand name, which is the whole
 * of what these cards draw. It has no explicit embedding controls and no
 * nesting, and it does not need them.
 */

/** Hebrew, including presentation forms. The only strong RTL we can produce. */
const STRONG_RTL = /[֐-׿יִ-ﭏ]/;

/**
 * Characters that read left to right: digits, Latin letters, and the symbols
 * that belong to a number rather than to a sentence (#1042, 50%, 3.5, ₪2,400).
 */
const STRONG_LTR = /[0-9A-Za-zÀ-ɏ#$%&*+\-/<=>@\\^_|~₪€]/;

/**
 * Characters drawn as their mirror image in right-to-left text. A bracket
 * keeps its meaning and swaps its shape, which is why this maps the character
 * rather than merely moving it.
 */
const MIRRORED: Record<string, string> = {
  "(": ")",
  ")": "(",
  "[": "]",
  "]": "[",
  "{": "}",
  "}": "{",
  "<": ">",
  ">": "<",
  "«": "»",
  "»": "«",
};

type Direction = "ltr" | "rtl";

function classify(character: string): Direction | "neutral" {
  if (STRONG_RTL.test(character)) return "rtl";
  if (STRONG_LTR.test(character)) return "ltr";
  return "neutral";
}

/**
 * Rewrites a logically ordered string into the order it must be drawn in.
 *
 * Runs are emitted back to front, because the first logical character of
 * right-to-left text belongs at the right edge. Left-to-right islands keep
 * their internal order, which is what leaves "#1042" spelled forwards instead
 * of "2401#".
 */
export function toVisualOrder(text: string): string {
  const characters = [...text];

  /*
   * A string with no Hebrew in it is not right-to-left text, and reversing it
   * would be pure damage — a business named "ACME Plumbing" is the obvious
   * case. Base direction is decided by the first strong character, which is
   * how the algorithm proper decides it too.
   */
  if (!characters.some((character) => STRONG_RTL.test(character))) return text;

  const directions = characters.map(classify);

  /*
   * Resolve the neutrals: a space, comma or full stop takes the direction of
   * what surrounds it, and only counts as left-to-right when both sides are.
   * That single rule is what holds "2,400" and "ACME Plumbing" together while
   * still letting the space between a Hebrew word and a number belong to the
   * Hebrew.
   */
  for (let i = 0; i < directions.length; i += 1) {
    if (directions[i] !== "neutral") continue;

    let end = i;
    while (end < directions.length && directions[end] === "neutral") end += 1;

    const before = directions[i - 1];
    const after = directions[end];
    const resolved: Direction = before === "ltr" && after === "ltr" ? "ltr" : "rtl";

    for (let j = i; j < end; j += 1) directions[j] = resolved;
    i = end - 1;
  }

  // Group into runs of one direction.
  const runs: { direction: Direction; characters: string[] }[] = [];
  characters.forEach((character, i) => {
    const direction = directions[i] as Direction;
    const last = runs.at(-1);
    if (last && last.direction === direction) last.characters.push(character);
    else runs.push({ direction, characters: [character] });
  });

  return runs
    .reverse()
    .flatMap((run) =>
      run.direction === "ltr"
        ? run.characters
        : run.characters
            .slice()
            .reverse()
            .map((character) => MIRRORED[character] ?? character),
    )
    .join("");
}
