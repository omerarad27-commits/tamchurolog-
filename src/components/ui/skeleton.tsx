/**
 * Loading placeholders.
 *
 * Shaped like the content that is coming, not a spinner: on a phone the screen
 * should never go blank while a server-rendered page is on its way.
 *
 * "Shaped like" is meant literally, and it is the whole point. A skeleton that
 * is merely the right width still shifts the page when the real content arrives
 * with a heading row, a filter bar and two columns that the skeleton never
 * showed. These pieces mirror the containers the pages actually use, so what
 * appears second lands where the placeholder already was.
 */

export function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div className={`h-4 animate-pulse rounded bg-border/60 ${className}`} />
  );
}

/**
 * The page title, and the action button that sits opposite it on the list
 * screens. Both are part of the first paint on the real page.
 */
export function SkeletonHeading({
  action = false,
  subtitle = false,
}: {
  action?: boolean;
  subtitle?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <SkeletonLine className="h-8 w-44 lg:h-9 lg:w-56" />
        {action ? (
          <SkeletonLine className="h-control-sm w-32 shrink-0 rounded-control" />
        ) : null}
      </div>
      {subtitle ? <SkeletonLine className="h-5 w-64 max-w-full" /> : null}
    </div>
  );
}

/** The status filter pills on the quotes screen. */
export function SkeletonFilters({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonLine key={index} className="h-8 w-16 shrink-0 rounded-full" />
      ))}
    </div>
  );
}

/*
 * Sized against the real row rather than guessed: p-4, a semibold name on one
 * line and a smaller meta line under it, which comes to roughly 84px.
 */
export function SkeletonCard() {
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
      <SkeletonLine className="h-6 w-1/2" />
      <SkeletonLine className="mt-1 h-5 w-1/3" />
    </div>
  );
}

/** A page heading plus a few rows, which covers most screens in this app. */
export function SkeletonList({
  rows = 4,
  action = false,
  filters = 0,
}: {
  rows?: number;
  action?: boolean;
  filters?: number;
}) {
  return (
    <div
      className="flex flex-col gap-5"
      role="status"
      aria-label="טוען"
      aria-live="polite"
    >
      <SkeletonHeading action={action} />
      {filters > 0 ? <SkeletonFilters count={filters} /> : null}

      {/* Same grid as the lists it stands in for, so the second column does not
          appear out of nowhere when the data lands. */}
      <div className="grid gap-2 lg:grid-cols-2">
        {Array.from({ length: rows }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
      <span className="sr-only">טוען…</span>
    </div>
  );
}

/** The summary screen: a heading with a subtitle, then a grid of figures. */
export function SkeletonFigures({ count = 6 }: { count?: number }) {
  return (
    <div
      className="flex flex-col gap-4"
      role="status"
      aria-label="טוען"
      aria-live="polite"
    >
      <SkeletonHeading subtitle />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }, (_, index) => (
          <div
            key={index}
            className="rounded-card border border-border bg-surface p-5 shadow-sm"
          >
            <SkeletonLine className="h-5 w-24" />
            <SkeletonLine className="mt-2 h-9 w-36" />
            <SkeletonLine className="mt-2 h-5 w-40 max-w-full" />
          </div>
        ))}
      </div>
      <span className="sr-only">טוען…</span>
    </div>
  );
}

export function SkeletonForm({
  fields = 4,
  subtitle = false,
}: {
  fields?: number;
  subtitle?: boolean;
}) {
  return (
    <div
      className="flex w-full max-w-form flex-col gap-5"
      role="status"
      aria-label="טוען"
      aria-live="polite"
    >
      <SkeletonHeading subtitle={subtitle} />
      <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-sm">
        {Array.from({ length: fields }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <SkeletonLine className="h-3 w-24" />
            <SkeletonLine className="h-control" />
          </div>
        ))}
      </div>
      <span className="sr-only">טוען…</span>
    </div>
  );
}
