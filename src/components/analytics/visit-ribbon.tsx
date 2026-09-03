"use client";

import { cn } from "@/lib/utils";

/**
 * Every visit as a tick on a time axis that is SHARED by every row on the
 * page. That is the whole idea: a visitor who came once shows an almost-empty
 * strip, which looks wrong by dashboard convention and is exactly right — it
 * places their single visit against everyone else's. A burst of arrivals after
 * a post becomes a visible vertical band running down the page.
 *
 * Ticks are discrete because visits are discrete. Smoothing a dozen events
 * into a curve would draw traffic that never happened. Overlapping ticks
 * darken on their own, so density reads without a legend.
 */
export function VisitRibbon({
  times,
  from,
  to,
  className,
  tone = "normal",
}: {
  times: number[];
  from: number;
  to: number;
  className?: string;
  tone?: "normal" | "loud";
}) {
  const span = Math.max(to - from, 1);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-sm",
        // The hero strip carries a track because it establishes the axis. The
        // per-person lanes below barely need one — a filled track there reads
        // as an empty progress bar, which is the wrong story: a row with two
        // ticks is not 2% of anything.
        tone === "loud" ? "bg-muted/40" : "bg-foreground/[0.04]",
        className
      )}
      aria-hidden
    >
      {times.map((t, i) => (
        <span
          key={i}
          className={cn(
            "absolute top-0 bottom-0 w-px",
            tone === "loud" ? "bg-foreground/55" : "bg-foreground/35"
          )}
          style={{
            left: `${Math.min(99.8, Math.max(0, ((t - from) / span) * 100))}%`,
          }}
        />
      ))}
    </div>
  );
}

/** The axis is drawn once, under the top strip, and every ribbon below shares
 *  it — so labelling each row would be repeating a caption. */
export function RibbonAxis({ from, to }: { from: number; to: number }) {
  const fmt = (t: number) =>
    new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return (
    <div className="flex items-baseline justify-between text-[10px] tabular-nums text-muted-foreground/70">
      <span>{fmt(from)}</span>
      <span>now</span>
    </div>
  );
}
