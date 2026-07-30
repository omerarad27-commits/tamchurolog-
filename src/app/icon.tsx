import { ImageResponse } from "next/og";

import { BRAND, SURFACE, loadOgFonts } from "@/lib/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/**
 * The brand mark, generated rather than committed as a binary.
 *
 * 512px so the one file serves both the browser tab and the manifest's large
 * icon. The letter is the same ת the app already draws as a fallback avatar,
 * which is why it needs a real Hebrew font rather than a shape.
 */
export default async function Icon() {
  const fonts = await loadOgFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND,
          color: SURFACE,
          fontFamily: "Alef",
          fontWeight: 700,
          fontSize: 340,
          // Nudged up: Hebrew letters sit on the baseline with no descender
          // here, so optical centring is a little above geometric centring.
          paddingBottom: 40,
        }}
      >
        ת
      </div>
    ),
    { ...size, fonts: [...fonts] },
  );
}
