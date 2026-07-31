/**
 * Teaches plain node the "@/" alias that tsconfig gives the app.
 *
 * Node can strip TypeScript types on its own now, which is what lets the small
 * pure functions in src/lib be unit tested without a test framework. What it
 * cannot do is resolve the path alias, so a module that imports "@/lib/phone"
 * fails before a single assertion runs.
 *
 * Used only by the verify:* scripts. The app itself never loads this.
 */
import { existsSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts"];

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith("@/")) return nextResolve(specifier, context);

  const base = resolvePath(ROOT, "src", specifier.slice(2));
  const found = EXTENSIONS.map((extension) => `${base}${extension}`).find(
    (candidate) => existsSync(candidate),
  );

  if (!found) {
    throw new Error(`Cannot resolve "${specifier}" under src/`);
  }

  return nextResolve(pathToFileURL(found).href, context);
}
