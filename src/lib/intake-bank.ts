/**
 * The built-in questions.
 *
 * Constants rather than database rows: these are part of the product, not user
 * data, so a third question later is a code change with no migration and no
 * backfill.
 *
 * The wording is COPIED into a form when it is built, never referenced. Editing
 * this file therefore never rewrites questionnaires that already exist — the
 * same rule that governs everything else in this feature.
 */
export type BankQuestion = {
  /** Becomes the question id inside a form, so it is stable and readable. */
  key: string;
  prompt: string;
  options: string[];
};

export const INTAKE_BANK: readonly BankQuestion[] = [
  {
    key: "floor_elevator",
    prompt: "האם מדובר בבניין ללא מעלית, ואם כן באיזו קומה?",
    options: ["לא", "1", "2", "3", "4"],
  },
  {
    key: "parking",
    prompt: "האם יש חנייה זמינה ליד המבנה או אזור פריקה נוח?",
    options: ["חנייה חופשית", "בעייתי מאוד לחנות", "חניה קצת רחוקה מהמבנה"],
  },
] as const;

export const BANK_KEYS = new Set(INTAKE_BANK.map((q) => q.key));
