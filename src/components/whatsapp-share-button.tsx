"use client";

import { forwardRef, useTransition } from "react";

import { buttonClasses } from "@/components/ui/button";

/**
 * Opens WhatsApp with a pre-filled message, and reports the send to the server.
 *
 * Deliberately a real <a> rather than a button that calls window.open() after
 * an await: browsers block popups that are not opened directly inside the click
 * handler, and on a phone the anchor hands off to the WhatsApp app natively.
 * The server action runs alongside the navigation, not before it, so a slow
 * network never delays WhatsApp opening.
 *
 * Shared by the initial send and the Phase 7 reminder; only the label, the
 * message text and the onShare callback differ.
 *
 * The anchor is exposed through a ref so the quick-quote route can click it on
 * arrival. That is the one caller that cannot open WhatsApp inside the original
 * gesture, because the quote it links to did not exist yet when the tap
 * happened.
 */
export const WhatsAppShareButton = forwardRef<
  HTMLAnchorElement,
  {
    url: string;
    label: string;
    pendingLabel: string;
    hasRecipient: boolean;
    variant?: "primary" | "secondary";
    onShare?: () => Promise<void>;
  }
>(function WhatsAppShareButton(
  { url, label, pendingLabel, hasRecipient, variant = "primary", onShare },
  ref,
) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-1.5">
      <a
        ref={ref}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          if (onShare) startTransition(() => onShare());
        }}
        className={buttonClasses({ variant })}
      >
        {pending ? pendingLabel : label}
      </a>

      {!hasRecipient ? (
        <p className="text-xs text-warning">
          ללקוח הזה אין מספר טלפון שמור, לכן וואטסאפ יבקש לבחור נמען. אפשר להוסיף
          מספר במסך הלקוח.
        </p>
      ) : null}
    </div>
  );
});
