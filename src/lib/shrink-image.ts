/*
 * Shrinks a logo in the browser before it is uploaded.
 *
 * Why this exists: a tradesperson photographs the sign above their shop and
 * gets an 8MB file. That is larger than Vercel will even accept as a request
 * body, and it would sit there uploading for half a minute on a weak signal.
 * The logo is displayed at 56px in the header and around 100px on the public
 * quote page, so none of those bytes were ever going to be seen.
 *
 * This runs on the client and is therefore advisory only. The server re-checks
 * type and size regardless, and Supabase enforces its own bucket limits.
 */

/** Generous next to the ~100px it is displayed at, so it stays crisp on a 3x screen. */
const MAX_DIMENSION = 512;
const QUALITY = 0.9;

export type ShrinkResult = {
  file: File;
  originalBytes: number;
  shrunk: boolean;
};

/**
 * Returns a smaller file when it can, and the original otherwise. Never throws:
 * an unsupported browser or an unreadable image just means we upload what the
 * owner picked and let the server decide.
 */
export async function shrinkImage(file: File): Promise<ShrinkResult> {
  const unchanged: ShrinkResult = {
    file,
    originalBytes: file.size,
    shrunk: false,
  };

  // SVG is vector: rasterising it would make it worse, and it is already tiny.
  if (file.type === "image/svg+xml") return unchanged;

  if (typeof createImageBitmap !== "function") return unchanged;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return unchanged;
  }

  try {
    const scale = Math.min(
      1,
      MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return unchanged;

    context.drawImage(bitmap, 0, 0, width, height);

    // WebP keeps transparency, which a logo usually needs, and is accepted by
    // the storage bucket.
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", QUALITY);
    });

    if (!blob) return unchanged;

    // Re-encoding can make an already-optimised file bigger. Only take the win.
    if (blob.size >= file.size) return unchanged;

    return {
      file: new File([blob], "logo.webp", { type: "image/webp" }),
      originalBytes: file.size,
      shrunk: true,
    };
  } finally {
    bitmap.close();
  }
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}
