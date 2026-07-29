/**
 * Loading placeholders.
 *
 * Shaped like the content that is coming, not a spinner: on a phone the screen
 * should never go blank while a server-rendered page is on its way.
 */

export function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div className={`h-4 animate-pulse rounded bg-border/60 ${className}`} />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
      <SkeletonLine className="w-1/2" />
      <SkeletonLine className="mt-2 w-1/3" />
    </div>
  );
}

/** A page heading plus a few rows, which covers most screens in this app. */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div
      className="flex flex-col gap-4"
      role="status"
      aria-label="טוען"
      aria-live="polite"
    >
      <SkeletonLine className="h-7 w-40" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
      <span className="sr-only">טוען…</span>
    </div>
  );
}

export function SkeletonForm({ fields = 4 }: { fields?: number }) {
  return (
    <div
      className="flex flex-col gap-4"
      role="status"
      aria-label="טוען"
      aria-live="polite"
    >
      <SkeletonLine className="h-7 w-40" />
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
