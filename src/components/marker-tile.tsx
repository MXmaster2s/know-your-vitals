"use client";

import { CopyButton } from "@/components/copy-button";
import { Sparkline } from "@/components/sparkline";
import { cn } from "@/lib/utils";
import type { MarkerSeries } from "@/lib/derive";
import {
  buildMarkerCopy,
  fmtDateCompact,
  fmtRange,
  fmtValue,
} from "@/lib/derive";

/** Dashboard tile: latest value + range + date + flag + inline trend.
 *  Click → detail. Deliberately compact — two per row on a phone, and tapping
 *  opens the full-size chart anyway. */
export function MarkerTile({
  series,
  personLabel,
  onOpen,
}: {
  series: MarkerSeries;
  personLabel: string;
  onOpen: () => void;
}) {
  const { marker, latest, latestFlag, points } = series;
  const unit = latest.unit ?? marker.unit;
  const range = fmtRange(latest);
  const inRange =
    !latestFlag && (latest.ref_low != null || latest.ref_high != null);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "group flex h-full w-full cursor-pointer flex-col gap-1 rounded-xl border bg-card p-3 text-left shadow-xs transition-colors",
          "hover:border-ring/50 focus-visible:outline-2 focus-visible:outline-ring/60",
          latestFlag && "border-attention/45",
          inRange && "border-positive/30",
        )}
      >
        <span className="flex w-full items-start justify-between gap-1">
          <span className="line-clamp-2 text-xs leading-tight text-muted-foreground">
            {marker.name ?? marker.id}
          </span>
          {latestFlag ? (
            <span
              aria-label={latestFlag === "H" ? "High" : "Low"}
              className="shrink-0 rounded-md border border-attention/50 px-1 text-[10px] font-medium leading-4 text-attention"
            >
              {latestFlag}
            </span>
          ) : null}
        </span>

        <span className="flex items-baseline gap-1">
          <span
            className={cn(
              "text-xl font-medium tabular-nums",
              latestFlag && "text-attention",
            )}
          >
            {fmtValue(latest.value)}
          </span>
          {unit ? (
            <span className="text-[10px] text-muted-foreground">{unit}</span>
          ) : null}
        </span>

        <span className="text-[10px] leading-tight text-muted-foreground">
          {range ? `Range ${range}` : "No printed range"}
          {" · "}
          {fmtDateCompact(latest.taken_on)}
        </span>

        {/* keep the trend clear of the copy control in the corner */}
        <span className="block pr-6">
          <Sparkline points={points} flagged={latestFlag !== null} />
        </span>
      </button>
      <CopyButton
        className="absolute bottom-1 right-1"
        label={`Copy ${marker.name ?? marker.id} data`}
        getText={() => buildMarkerCopy(series, personLabel)}
      />
    </div>
  );
}
