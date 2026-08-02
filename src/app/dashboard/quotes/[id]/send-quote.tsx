"use client";

import { useEffect, useRef } from "react";

import { WhatsAppShareButton } from "@/components/whatsapp-share-button";

import { markQuoteSentAction } from "../actions";

export function SendQuote({
  quoteId,
  url,
  hasRecipient,
  alreadySent,
  awaitingSend = false,
}: {
  quoteId: string;
  url: string;
  hasRecipient: boolean;
  alreadySent: boolean;
  /**
   * True when the owner arrived from the quick screen, having just tapped
   * "send on WhatsApp" for a quote that did not exist yet.
   *
   * This used to click the link for them from an effect. It did not work, and
   * it failed in the worst available way: a browser blocks a target="_blank"
   * navigation that no gesture started, so WhatsApp never opened — but the
   * synthetic click still ran the onClick, so the quote was marked as sent.
   * The owner was told the client had it, and the client had nothing.
   *
   * The gap it was papering over is real and cannot be closed. The message
   * carries the quote's link, the link needs a token, and the token does not
   * exist until the row does; one server round trip has to happen between the
   * tap and the URL, and no browser will hold a window open across it.
   *
   * So the second tap is admitted rather than faked — the same conclusion the
   * questionnaire send reached, for the same reason. All this flag does now is
   * put the cursor on the button and say what is left to do, neither of which
   * needs a gesture and neither of which claims anything untrue.
   */
  awaitingSend?: boolean;
}) {
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!awaitingSend) return;
    /* Focusing scrolls it into view as well, and leaves Enter as the next
       thing that happens for anyone not on a touchscreen. */
    linkRef.current?.focus();
  }, [awaitingSend]);

  return (
    <div className="flex flex-col gap-2">
      {awaitingSend ? (
        <p
          role="status"
          className="rounded-tile bg-brand-soft px-4 py-3 text-sm font-medium text-brand"
        >
          ההצעה נשמרה. נשאר רק לשלוח אותה ללקוח.
        </p>
      ) : null}

      <WhatsAppShareButton
        ref={linkRef}
        url={url}
        hasRecipient={hasRecipient}
        label={alreadySent ? "שליחה שוב בוואטסאפ" : "שליחה בוואטסאפ"}
        pendingLabel="פותח וואטסאפ…"
        variant={alreadySent ? "secondary" : "primary"}
        onShare={() => markQuoteSentAction(quoteId)}
      />
    </div>
  );
}
