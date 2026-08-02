"use client";

import Link from "next/link";
import { useState } from "react";

import { matchesSearch, SearchField } from "@/components/ui/search-field";

/** Only what a row draws. Notes and email stay on the server. */
export type ClientListRow = {
  id: string;
  fullName: string;
  /** Already formatted for display, or null when the client has no number. */
  phoneLabel: string | null;
  /** Digits only, so 054 finds a number stored as +97254. */
  phoneDigits: string;
};

/** Same threshold as the quote list, for the same reason. */
const SEARCH_FROM = 8;

export function ClientList({ rows }: { rows: ClientListRow[] }) {
  const [query, setQuery] = useState("");

  /*
   * A phone number typed into the search box has punctuation the stored one
   * does not, and the other way round: 054-123 against +972541234567. Both
   * sides are reduced to digits before matching, and the leading zero of the
   * local form is dropped so it lines up with the international one.
   */
  const digits = query.replace(/\D/g, "");
  const localDigits = digits.startsWith("0") ? digits.slice(1) : digits;

  const visible = rows.filter((row) => {
    if (digits.length >= 3 && row.phoneDigits.includes(localDigits)) return true;
    return matchesSearch(query, [row.fullName]);
  });

  return (
    <div className="flex flex-col gap-3">
      {rows.length >= SEARCH_FROM ? (
        <SearchField
          label="חיפוש לקוחות"
          placeholder="חיפוש לפי שם או טלפון"
          value={query}
          onValueChange={setQuery}
          resultCount={visible.length}
        />
      ) : null}

      {visible.length === 0 ? (
        <p className="rounded-card border border-dashed border-border p-6 text-center text-sm text-muted">
          לא נמצא לקוח שמתאים ל&rdquo;{query.trim()}&ldquo;.
        </p>
      ) : (
        /* Same shape as the quote list, for the same reason: a name at one edge
           and a chevron at the other with 900px between them is not a row. */
        <ul className="grid gap-2 lg:grid-cols-2">
          {visible.map((row) => (
            <li key={row.id}>
              <Link
                href={`/dashboard/clients/${row.id}`}
                className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 transition-colors hover:bg-background"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{row.fullName}</p>
                  {row.phoneLabel ? (
                    <p className="truncate text-sm text-muted">
                      <span className="numeric">{row.phoneLabel}</span>
                    </p>
                  ) : (
                    <p className="truncate text-sm text-warning">חסר טלפון</p>
                  )}
                </div>
                <span aria-hidden="true" className="text-muted">
                  ‹
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
