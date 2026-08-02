"use client";

import Link from "next/link";
import { useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import { matchesSearch, SearchField } from "@/components/ui/search-field";
import { formatILS } from "@/lib/format";
import type { QuoteListRow } from "@/lib/quote-list-row";

/**
 * The quote list, with the search box that sits above it.
 *
 * The row shape and the function that builds it live in lib/quote-list-row.ts,
 * not here. This module is "use client", which turns every one of its exports
 * into a client reference — so a helper exported from here could not be called
 * by the server page that needs it. Components only.
 */

/*
 * The threshold for showing the box at all.
 *
 * Search earns its place on a list you cannot take in at a glance. Above a
 * handful of quotes it is the fastest way to a specific one; below that it is a
 * field asking to be filled in above a list that already fits on the screen.
 */
const SEARCH_FROM = 8;

export function QuoteList({
  rows,
  totalCount,
}: {
  rows: QuoteListRow[];
  /*
   * Every quote the owner has, not just the ones the active status filter let
   * through. Whether search is worth offering is a fact about the collection,
   * and deciding it from the filtered rows made the box vanish the moment
   * someone narrowed to a status with six quotes in it.
   */
  totalCount: number;
}) {
  const [query, setQuery] = useState("");

  const visible = rows.filter((row) =>
    matchesSearch(query, [
      row.clientName,
      row.title,
      /* Both forms, so "#14" and "14" find quote fourteen. */
      String(row.quoteNumber),
      `#${row.quoteNumber}`,
    ]),
  );

  return (
    <div className="flex flex-col gap-3">
      {totalCount >= SEARCH_FROM ? (
        <SearchField
          label="חיפוש הצעות"
          placeholder="חיפוש לפי שם לקוח, נושא או מספר הצעה"
          value={query}
          onValueChange={setQuery}
          resultCount={visible.length}
        />
      ) : null}

      {visible.length === 0 ? (
        <p className="rounded-card border border-dashed border-border p-6 text-center text-sm text-muted">
          {query.trim() === ""
            ? "אין הצעות בסטטוס הזה."
            : `לא נמצאה הצעה שמתאימה ל"${query.trim()}".`}
        </p>
      ) : (
        /* One column on a phone, two once the shell is wide enough that a
           single row would be a name at one edge and a price at the other
           with 700px of nothing between them. */
        <ul className="grid gap-2 lg:grid-cols-2">
          {visible.map((row) => (
            <li key={row.id}>
              <Link
                href={`/dashboard/quotes/${row.id}`}
                className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 transition-colors hover:bg-background"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{row.clientName}</p>
                    <StatusBadge status={row.status} />
                  </div>
                  {/* The subject, where there is one: on this list the client's
                      name is the heading, and three quotes for the same client
                      used to differ only by number. */}
                  {row.title ? (
                    <p className="mt-0.5 truncate text-sm">{row.title}</p>
                  ) : null}
                  <p className="mt-0.5 text-sm text-muted">
                    הצעה <span className="numeric">#{row.quoteNumber}</span> ·{" "}
                    <span className="numeric">{row.dateLabel}</span>
                  </p>
                </div>
                <span className="numeric shrink-0 font-bold">
                  {formatILS(row.total)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
