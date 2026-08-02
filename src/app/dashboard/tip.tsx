import Link from "next/link";

import type { TipId } from "@/lib/tips";

import { dismissTipAction } from "./tip-actions";

/**
 * One tip, rendered next to the thing it is about.
 *
 * Everything here is a consequence of a rule in lib/tips.ts. It is a bordered
 * strip in the flow of the page rather than a floating card, so it pushes
 * nothing and covers nothing. It has no heading, because a heading on two
 * sentences is furniture. The close button is a real button with a real label,
 * at the end of the strip where the eye finishes reading.
 *
 * A server component: both controls are a link and a form, so there is no state
 * to hold and no JavaScript needed for either of them to work.
 */
export function Tip({
  id,
  children,
  action,
}: {
  id: TipId;
  /** One sentence. Two at the very most. */
  children: React.ReactNode;
  /** The one thing this tip is suggesting, where there is somewhere to go. */
  action?: { href: string; label: string };
}) {
  return (
    <aside className="flex flex-col gap-2.5 rounded-card border border-brand/20 bg-brand-soft p-4">
      <p className="text-sm leading-relaxed">{children}</p>

      <div className="flex flex-wrap items-center gap-2">
        {action ? (
          <Link
            href={action.href}
            className="inline-flex h-control-sm shrink-0 items-center justify-center rounded-control bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
          >
            {action.label}
          </Link>
        ) : null}

        <form action={dismissTipAction}>
          <input type="hidden" name="tip" value={id} />
          <button
            type="submit"
            className="inline-flex h-control-sm items-center justify-center rounded-control px-4 text-sm font-semibold text-muted transition-colors hover:bg-surface"
          >
            אל תציג שוב
          </button>
        </form>
      </div>
    </aside>
  );
}
