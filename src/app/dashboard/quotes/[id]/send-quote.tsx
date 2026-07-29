"use client";

import { WhatsAppShareButton } from "@/components/whatsapp-share-button";

import { markQuoteSentAction } from "../actions";

export function SendQuote({
  quoteId,
  url,
  hasRecipient,
  alreadySent,
}: {
  quoteId: string;
  url: string;
  hasRecipient: boolean;
  alreadySent: boolean;
}) {
  return (
    <WhatsAppShareButton
      url={url}
      hasRecipient={hasRecipient}
      label={alreadySent ? "שליחה שוב בוואטסאפ" : "שליחה בוואטסאפ"}
      pendingLabel="פותח וואטסאפ…"
      variant={alreadySent ? "secondary" : "primary"}
      onShare={() => markQuoteSentAction(quoteId)}
    />
  );
}
