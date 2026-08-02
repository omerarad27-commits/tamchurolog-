import { formatDate } from "@/lib/format";
import type { QuoteStatus } from "@/lib/types";

/**
 * The shape of one row in the quotes list, and the function that produces it.
 *
 * These live here, and not next to the component that renders them, for a
 * reason worth stating plainly: quote-list.tsx carries "use client", and every
 * export from such a module becomes a client reference — a plain helper
 * included. The list page is a server component and maps its rows through this
 * function, so having it there meant the server calling into the client, which
 * fails at render time with "attempted to call toQuoteListRow() from the
 * server".
 *
 * Nothing in the type system catches that: TypeScript does not model the
 * server/client boundary and the build compiles it happily. The rule to carry
 * forward is that a "use client" module exports components and nothing else.
 */
export type QuoteListRow = {
  id: string;
  clientName: string;
  title: string | null;
  quoteNumber: number;
  status: QuoteStatus;
  /** Already formatted; the row shows it verbatim. */
  dateLabel: string;
  total: number;
};

/**
 * Reduces a quote row to what the list actually draws.
 *
 * The full rows carry public tokens, decision IPs and view timestamps that the
 * list never shows. Narrowing here means none of that crosses to the browser to
 * be filtered.
 */
export function toQuoteListRow(quote: {
  id: string;
  title: string | null;
  quote_number: number;
  status: QuoteStatus;
  sent_at: string | null;
  issued_at: string;
  total: string;
  clients: { full_name: string } | null;
}): QuoteListRow {
  return {
    id: quote.id,
    clientName: quote.clients?.full_name ?? "לקוח שנמחק",
    title: quote.title,
    quoteNumber: quote.quote_number,
    status: quote.status,
    dateLabel: formatDate(quote.sent_at ?? quote.issued_at),
    total: Number(quote.total),
  };
}
