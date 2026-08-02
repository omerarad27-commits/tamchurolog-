"use client";

import { useEffect, useRef } from "react";

import { WhatsAppShareButton } from "@/components/whatsapp-share-button";

import { markQuoteSentAction } from "../actions";

export function SendQuote({
  quoteId,
  url,
  hasRecipient,
  alreadySent,
  autoOpen = false,
}: {
  quoteId: string;
  url: string;
  hasRecipient: boolean;
  alreadySent: boolean;
  /**
   * Opens WhatsApp on arrival, for the quick route.
   *
   * The quick screen promises one button, and the quote it creates only exists
   * after a server round trip, so the WhatsApp URL cannot be known while the
   * owner's tap is still in hand. This closes that gap: the action redirects
   * here with ?send=1 and the link follows itself.
   *
   * If the browser declines — some block a navigation not started by a
   * gesture — nothing is lost. The button is right there, already the biggest
   * thing on the screen, and the quote is saved either way.
   */
  autoOpen?: boolean;
}) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (!autoOpen || fired.current) return;
    // Once per mount, and never again: a re-render must not reopen WhatsApp on
    // someone who has already come back to this page.
    fired.current = true;
    linkRef.current?.click();
  }, [autoOpen]);

  return (
    <WhatsAppShareButton
      ref={linkRef}
      url={url}
      hasRecipient={hasRecipient}
      label={alreadySent ? "שליחה שוב בוואטסאפ" : "שליחה בוואטסאפ"}
      pendingLabel="פותח וואטסאפ…"
      variant={alreadySent ? "secondary" : "primary"}
      onShare={() => markQuoteSentAction(quoteId)}
    />
  );
}
