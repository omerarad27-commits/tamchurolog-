/**
 * Unit checks for the logical-to-visual reordering used by the OG cards.
 *
 * These assert the properties that can be reasoned about without reading
 * Hebrew in an image - which is the trap that made this bug survive a review.
 * Digits are the reliable witness: their position and their spelling are
 * unambiguous no matter which way the letters run.
 *
 * The visual proof that the whole card is right lives in verify:og-visual.
 *
 * Run:  npm run verify:bidi
 */

import { toVisualOrder } from "../src/lib/bidi.ts";

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed });
  console.log(`  [${passed ? "PASS" : "FAIL"}] ${name}${detail ? ` - ${detail}` : ""}`);
}

const eq = (name, input, expected) =>
  check(name, toVisualOrder(input) === expected, `got "${toVisualOrder(input)}"`);

console.log("\nLogical to visual order\n");

// Pure Hebrew simply reverses.
eq("pure Hebrew reverses", "אבגד", "דגבא");
eq("words reverse as one run", "הצעת מחיר", "ריחמ תעצה");

// The number keeps its spelling and moves to the other end.
eq("a number stays forwards", "אבגד 1042", "1042 דגבא");
eq("a leading number moves right", "1042 אבגד", "דגבא 1042");
eq("hash binds to its number", "#1042", "#1042");
eq("hash and Hebrew together", "הצעה #1042", "#1042 העצה");

// Prices and percentages are single left-to-right islands.
eq("a price keeps its shape", "₪2,400", "₪2,400");
eq("a decimal survives", "3.5", "3.5");

// Latin islands read forwards.
eq("a Latin word stays forwards", "חברת ACME", "ACME תרבח");

// Brackets swap shape, not meaning.
eq("brackets mirror", "(שלום)", "(םולש)");

// Applying it twice must return the original: the transform is its own
// inverse, which is what makes an accidental double application detectable.
const samples = ["הצעת מחיר #1042", "אבגד 1042", "חברת ACME", "(שלום)"];
check(
  "the transform is its own inverse",
  samples.every((s) => toVisualOrder(toVisualOrder(s)) === s),
  samples.find((s) => toVisualOrder(toVisualOrder(s)) !== s) ?? "all round-trip",
);

// Nothing may be lost or invented.
check(
  "no characters are added or dropped",
  samples.every((s) => [...toVisualOrder(s)].length === [...s].length),
);

// Latin-only text must come out untouched, since these cards can carry a
// business name with no Hebrew in it at all.
check(
  "a Latin-only string is unchanged",
  toVisualOrder("ACME Plumbing 24") === "ACME Plumbing 24",
  toVisualOrder("ACME Plumbing 24"),
);

const failed = results.filter((r) => !r.passed).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed === 0 ? 0 : 1);
