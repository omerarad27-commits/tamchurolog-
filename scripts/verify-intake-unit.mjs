/**
 * Unit tests for the intake question and answer rules.
 *
 * These run without a browser or a database because they are pure functions,
 * and because every one of them is a rule that protects the database from
 * something a client typed.
 *
 * Run:  npm run verify:intake-unit
 *
 * English output on purpose - Windows terminals mangle Hebrew.
 */

import {
  MAX_ANSWER_LENGTH,
  parseAnswers,
  parseQuestions,
  validateAnswers,
  validateQuestions,
} from "../src/lib/intake.ts";

let passed = 0;
let failed = 0;

function check(name, ok, detail = "") {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` - ${detail}` : ""}`);
}

const choice = {
  id: "floor_elevator",
  kind: "choice",
  prompt: "קומה?",
  options: ["לא", "1", "2"],
};
const text = { id: "text-1", kind: "text", prompt: "פרטים" };

console.log("\nIntake validation\n");

/* ------------------------------------------------------- questions */
check("a form with no questions is rejected", validateQuestions([]) !== null);
check("a valid form is accepted", validateQuestions([choice, text]) === null);
check(
  "an empty prompt is rejected",
  validateQuestions([{ ...text, prompt: "  " }]) !== null,
);
check(
  "duplicate ids are rejected",
  validateQuestions([text, { ...text }]) !== null,
);
check(
  "a choice question with fewer than two options is rejected",
  validateQuestions([{ ...choice, options: ["לא"] }]) !== null,
);

/* --------------------------------------------------------- answers */
check(
  "a complete answer set is accepted",
  validateAnswers([choice, text], { floor_elevator: "1", "text-1": "כן" }) === null,
);
check(
  "an unanswered question is rejected",
  validateAnswers([choice, text], { floor_elevator: "1" }) !== null,
);
check(
  "a choice value outside the options is rejected",
  validateAnswers([choice], { floor_elevator: "17" }) !== null,
);
check(
  "an over-long free text answer is rejected",
  validateAnswers([text], { "text-1": "x".repeat(MAX_ANSWER_LENGTH + 1) }) !== null,
);
check(
  "an answer to a question that was not asked is rejected",
  validateAnswers([text], { "text-1": "כן", ghost: "?" }) !== null,
);

/* ---------------------------------------------------------- parsing */
check("parseQuestions survives junk", parseQuestions("nonsense").length === 0);
check("parseQuestions drops malformed entries", parseQuestions([{ id: 1 }]).length === 0);
check(
  "parseQuestions keeps well-formed entries",
  parseQuestions([choice]).length === 1,
);
check("parseAnswers survives null", Object.keys(parseAnswers(null)).length === 0);
check(
  "parseAnswers drops non-string values",
  parseAnswers({ a: "ok", b: 5 }).b === undefined,
);

console.log(`\n${passed}/${passed + failed} checks passed.`);
process.exit(failed === 0 ? 0 : 1);
