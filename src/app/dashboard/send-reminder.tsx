"use client";

import { WhatsAppShareButton } from "@/components/whatsapp-share-button";

import { markQuoteRemindedAction } from "./quotes/actions";

/**
 * Same share mechanism as the initial send (Phase 5), different message and a
 * different side effect: this one restarts the follow-up clock instead of
 * marking the quote as sent.
 */
export function SendReminder({
  quoteId,
  url,
  hasRecipient,
}: {
  quoteId: string;
  url: string;
  hasRecipient: boolean;
}) {
  return (
    <WhatsAppShareButton
      url={url}
      hasRecipient={hasRecipient}
      label="שליחת תזכורת"
      pendingLabel="פותח וואטסאפ…"
      onShare={() => markQuoteRemindedAction(quoteId)}
    />
  );
}
