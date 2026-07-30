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
import { loadPublicQuote } from "@/lib/public-quote";

export const alt = "הצעת מחיר";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * The card a client sees in WhatsApp before deciding whether to tap.
 *
 * Deliberately without the amount. The page's description has always left the
 * price out on the grounds that these links get pasted into group chats and the
 * number should only appear once the quote is actually opened; putting it on a
 * 1200x630 image that renders itself in the chat list would undo that decision
 * far more thoroughly than a description ever could.
 *
 * The business name and the quote number are enough to do the job the card has
 * to do: prove the link came from a real tradesperson rather than a stranger,
 * so it gets opened at all.
 *
 * On direction: Satori has no bidi algorithm at all. It ignores `direction`,
 * `textAlign` and RLM marks, and lays glyphs out in the order given, which
 * draws Hebrew backwards. So RTL here is built rather than declared, in two
 * halves: row-reverse and flex-end put the boxes in the right places, and
 * toVisualOrder reorders the characters inside each one.
 *
 * Every string Satori draws goes through toVisualOrder. Nothing a browser
 * lays out ever does — the meta tags above are written in logical order and
 * left alone, because WhatsApp reorders those itself.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ public_token: string }>;
}) {
  const { public_token } = await params;
  const quote = await loadPublicQuote(public_token);
  const fonts = await loadOgFonts();

  // A revoked or mistyped token still has to produce a valid image: returning
  // nothing here would leave WhatsApp rendering a broken-image placeholder next
  // to a link the client was told to trust.
  const businessName = quote?.business.name ?? "תמחורולוג";
  const quoteNumber = quote?.quoteNumber ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "space-between",
          textAlign: "right",
          background: BACKDROP,
          padding: 72,
          fontFamily: "Alef",
          color: INK,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row-reverse",
            alignItems: "center",
            gap: 28,
            maxWidth: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 108,
              height: 108,
              borderRadius: 28,
              background: BRAND,
              color: SURFACE,
              fontSize: 60,
              fontWeight: 700,
            }}
          >
            {businessName.trim().charAt(0) || "ת"}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 60,
              fontWeight: 700,
              // A long business name must not push the logo off the canvas.
              overflow: "hidden",
            }}
          >
            {toVisualOrder(businessName)}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row-reverse",
              alignItems: "baseline",
              gap: 24,
              fontSize: 96,
              fontWeight: 700,
            }}
          >
            <div style={{ display: "flex" }}>{toVisualOrder("הצעת מחיר")}</div>
            {quoteNumber ? (
              <div style={{ display: "flex", color: MUTED }}>
                {`#${quoteNumber}`}
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", fontSize: 40, color: MUTED }}>
            {toVisualOrder("לחצו לצפייה בפירוט המלא ולאישור ההצעה")}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "row-reverse",
            alignItems: "center",
            gap: 16,
            fontSize: 30,
            color: MUTED,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 14,
              height: 14,
              borderRadius: 7,
              background: BRAND,
            }}
          />
          {toVisualOrder("נשלח באמצעות תמחורולוג")}
        </div>
      </div>
    ),
    { ...size, fonts: [...fonts] },
  );
}
