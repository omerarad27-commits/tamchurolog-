import { ImageResponse } from "next/og";

import { BRAND, SURFACE, loadOgFonts } from "@/lib/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * What iOS puts on the home screen.
 *
 * This is the one the product promise depends on: "everything from the phone"
 * is undercut when a tradesperson adds the site to their home screen and gets a
 * blurred screenshot of the page instead of a mark. iOS applies its own
 * rounding and gloss, so this is drawn as a full square.
 */
export default async function AppleIcon() {
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
          fontSize: 120,
          paddingBottom: 14,
        }}
      >
        ת
      </div>
    ),
    { ...size, fonts: [...fonts] },
  );
}
