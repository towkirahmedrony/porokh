/**
 * What the hub shows while the server's stage or its sections are on the way.
 *
 * The shape mirrors the real screen so the page does not jump when content
 * lands, and so a slow connection reads as loading rather than as an empty bank.
 */
export function HubSkeleton() {
  return (
    <div className="min-h-full bg-app px-4 pb-24 pt-3" aria-busy="true">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="h-9 w-40 animate-pulse rounded-xl bg-surface" />
        <div className="h-11 animate-pulse rounded-2xl bg-surface" />
        <div className="h-12 animate-pulse rounded-2xl bg-surface" />
        {[0, 1, 2].map((index) => (
          <div key={index} className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded-md bg-surface" />
            <div className="h-32 animate-pulse rounded-2xl border border-card-border bg-card-bg" />
          </div>
        ))}
      </div>
    </div>
  );
}
