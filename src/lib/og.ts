import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Shared pieces for the generated share cards.
 *
 * Every quote is delivered as a WhatsApp link, so the preview card is the
 * product's actual front door — it is seen far more often than any page.
 */

/** Facebook's and WhatsApp's preferred aspect; also what X reads as a large card. */
export const OG_SIZE = { width: 1200, height: 630 } as const;

export const OG_CONTENT_TYPE = "image/png";

/**
 * Alef, a Hebrew face with real static weights.
 *
 * Not Rubik, which the site itself uses, and the reason is mechanical rather
 * than aesthetic: Google ships Rubik only as a variable font now, and Satori
 * fails outright trying to read one — the build died on a TypeError inside its
 * font parser until this was swapped. Alef ships genuine Regular and Bold
 * files, is a quarter of the size, and was drawn for Hebrew.
 *
 * Satori also cannot read the woff2 that next/font emits, which is why these
 * are committed under assets/ and read from disk rather than shared with the
 * site's own font pipeline. Read once per process, not once per request.
 */
const fontCache = new Map<string, Promise<Buffer>>();

function loadFont(file: string): Promise<Buffer> {
  let pending = fontCache.get(file);
  if (!pending) {
    pending = readFile(join(process.cwd(), "assets", file));
    fontCache.set(file, pending);
  }
  return pending;
}

/** Regular and Bold, in the shape ImageResponse wants. */
export async function loadOgFonts() {
  const [regular, bold] = await Promise.all([
    loadFont("Alef-Regular.ttf"),
    loadFont("Alef-Bold.ttf"),
  ]);

  return [
    { name: "Alef", data: regular, style: "normal", weight: 400 },
    { name: "Alef", data: bold, style: "normal", weight: 700 },
  ] as const;
}

export const BRAND = "#1d4ed8";
export const INK = "#101828";
export const MUTED = "#667085";
export const SURFACE = "#ffffff";
export const BACKDROP = "#f5f6f8";
