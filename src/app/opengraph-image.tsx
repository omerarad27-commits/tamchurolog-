import { ImageResponse } from "next/og";

import { toVisualOrder } from "@/lib/bidi";
import {
  BACKDROP,
  BRAND,
  INK,
  MUTED,
  OG_CONTENT_TYPE,
  OG_SIZE,
  SURFACE,
  loadOgFonts,
} from "@/lib/og";

export const alt = "תמחורולוג — הצעות מחיר לבעלי מקצוע";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * The card for the landing page itself, which had no share image at all.
 *
 * Every string drawn here goes through toVisualOrder: Satori has no bidi
 * algorithm, so Hebrew handed to it in logical order comes out backwards.
 */
export default async function Image() {
  const fonts = await loadOgFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "center",
          textAlign: "right",
          gap: 24,
          background: BACKDROP,
          padding: 88,
          fontFamily: "Alef",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row-reverse",
            alignItems: "center",
            gap: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 96,
              height: 96,
              borderRadius: 24,
              background: BRAND,
              color: SURFACE,
              fontSize: 54,
              fontWeight: 700,
            }}
          >
            ת
          </div>
          <div style={{ display: "flex", fontSize: 54, fontWeight: 700, color: INK }}>
            {toVisualOrder("תמחורולוג")}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "flex-end",
            fontSize: 76,
            fontWeight: 700,
            color: INK,
          }}
        >
          {toVisualOrder("הצעות מחיר לבעלי מקצוע")}
        </div>

        <div
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "flex-end",
            whiteSpace: "nowrap",
            fontSize: 38,
            color: MUTED,
          }}
        >
          {toVisualOrder("שליחה בוואטסאפ, מעקב אחרי צפיות וסגירת עסקאות")}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [...fonts],
    },
  );
}
