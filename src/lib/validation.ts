/**
 * Validation shared between Server Actions and the client forms that call them.
 *
 * Kept out of the "use server" files on purpose: those may only export async
 * functions, so constants and helpers live here and are imported by both sides.
 */

export type AuthFormState = { error: string | null };

/** Result of a form Server Action that stays on the same page. */
export type FormState = {
  error: string | null;
  success: string | null;
};

export const EMPTY_FORM_STATE: FormState = { error: null, success: null };

export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

/** Returns a Hebrew error message, or null when the credentials look usable. */
export function validateCredentials(
  email: string,
  password: string,
): string | null {
  if (!email) return "יש להזין כתובת אימייל.";
  if (!EMAIL_PATTERN.test(email)) return "כתובת האימייל אינה תקינה.";
  if (!password) return "יש להזין סיסמה.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים.`;
  }
  return null;
}
