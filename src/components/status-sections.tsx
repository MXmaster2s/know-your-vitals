"use client";

import * as React from "react";
import { Check, MoveDownRight, MoveUpRight, StickyNote, X } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { cn } from "@/lib/utils";
import type { QualitativeFinding } from "@/lib/data";
import type { AttentionEntry, PositiveEntry } from "@/lib/derive";
import {
  buildMarkerCopy,
  fmtDate,
  fmtDateCompact,
  fmtRange,
  fmtValue,
} from "@/lib/derive";

/* Shared shell -------------------------------------------------------------

   One responsive grid, never a horizontal scroller: two columns on a phone,
   more as the viewport allows. Cards stay deliberately small — tapping one
   opens the full-size detail sheet anyway.                                  */

const GRID = "grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4";

function Section({
  title,
  tone,
  count,
  children,
  footer,
}: {
  title: string;
  tone: "positive" | "attention";
  count: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section aria-label={title}>
      <h2 className="mb-3 flex items-center gap-2 font-serif text-lg">
        <span
          aria-hidden
          className={cn(
            "size-2 rounded-full",
            tone === "positive" ? "bg-positive" : "bg-attention"
          )}
        />
        {title}
        {count > 0 ? (
          <span className="text-sm font-normal text-muted-foreground">
            {count}
          </span>
        ) : null}
      </h2>
      {children}
      {footer}
    </section>
  );
}

/** Compact card body shared by every tile in these two sections. */
function CardShell({
  tone,
  onOpen,
  onDismiss,
  dismissLabel,
  copy,
  children,
}: {
  tone: "positive" | "attention" | "note";
  onOpen?: () => void;
  onDismiss?: () => void;
  dismissLabel?: string;
  copy?: { label: string; getText: () => string };
  children: React.ReactNode;
}) {
  const border =
    tone === "positive"
      ? "border-positive/35"
      : tone === "attention"
        ? "border-attention/45"
        : "border-annotation/40";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className={cn(
          "flex h-full w-full flex-col gap-1 rounded-xl border bg-card p-3 text-left shadow-xs transition-colors",
          border,
          onOpen &&
            "cursor-pointer hover:border-ring/50 focus-visible:outline-2 focus-visible:outline-ring/60"
        )}
      >
        {children}
      </button>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel ?? "Dismiss"}
          className="absolute right-1 top-1 grid size-7 place-items-center rounded-lg text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring/60"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
      {copy ? (
        <CopyButton
          className="absolute bottom-1 right-1"
          label={copy.label}
          getText={copy.getText}
        />
      ) : null}
    </div>
  );
}

/* Doing well ---------------------------------------------------------------*/

const POSITIVE_LABEL: Record<PositiveEntry["kind"], string> = {
  recovered: "Back in range",
  improving: "Improving",
  steady: "In range",
};

export function PositiveSection({
  entries,
  personLabel,
  onOpenMarker,
}: {
  entries: PositiveEntry[];
  personLabel: string;
  onOpenMarker: (markerId: string) => void;
}) {
  if (entries.length === 0) return null;

  return (
    <Section title="Doing well" tone="positive" count={entries.length}>
      <div className={GRID}>
        {entries.map((entry) => {
          const { series, kind, delta } = entry;
          const { marker, latest } = series;
          const unit = latest.unit ?? marker.unit;
          const range = fmtRange(latest);
          return (
            <CardShell
              key={marker.id}
              tone="positive"
              onOpen={() => onOpenMarker(marker.id)}
              copy={{
                label: `Copy ${marker.name ?? marker.id} data`,
                getText: () => buildMarkerCopy(series, personLabel),
              }}
            >
              <span className="line-clamp-2 pr-1 text-xs font-medium leading-tight">
                {marker.name ?? marker.id}
              </span>
              <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <span className="flex items-baseline gap-1">
                  <span className="text-xl font-medium tabular-nums text-positive">
                    {fmtValue(latest.value)}
                  </span>
                  {unit ? (
                    <span className="text-[10px] text-muted-foreground">
                      {unit}
                    </span>
                  ) : null}
                </span>
                <span className="flex items-center gap-0.5 text-[10px] leading-tight text-positive">
                  <Check className="size-3 shrink-0" aria-hidden />
                  {POSITIVE_LABEL[kind]}
                  {kind !== "steady" && delta !== null
                    ? ` ${delta >= 0 ? "+" : "−"}${fmtValue(Math.abs(delta))}`
                    : ""}
                </span>
              </span>
              <span className="mt-auto pr-7 pt-1 text-[10px] leading-tight text-muted-foreground">
                {range ? `Range ${range} · ` : ""}
                {fmtDateCompact(latest.taken_on)}
              </span>
            </CardShell>
          );
        })}
      </div>
    </Section>
  );
}

/* Needs attention ----------------------------------------------------------*/

export function AttentionSection({
  entries,
  findings,
  personLabel,
  hiddenCount,
  showHidden,
  onToggleHidden,
  onOpenMarker,
  onDismissMeasurement,
  onDismissFinding,
}: {
  entries: AttentionEntry[];
  findings: QualitativeFinding[];
  personLabel: string;
  hiddenCount: number;
  showHidden: boolean;
  onToggleHidden: () => void;
  onOpenMarker: (markerId: string) => void;
  onDismissMeasurement: (measurementId: string) => void;
  onDismissFinding: (findingId: string) => void;
}) {
  const total = entries.length + findings.length;

  const footer =
    hiddenCount > 0 ? (
      <button
        type="button"
        onClick={onToggleHidden}
        className="mt-3 text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
      >
        {showHidden
          ? "Hide dismissed"
          : `${hiddenCount} dismissed · show`}
      </button>
    ) : null;

  if (total === 0) {
    return (
      <Section title="Needs attention" tone="attention" count={0} footer={footer}>
        <p className="rounded-xl border border-dashed bg-card/50 px-4 py-6 text-sm text-muted-foreground">
          Nothing flagged — every latest reading sits inside its printed range.
        </p>
      </Section>
    );
  }

  return (
    <Section
      title="Needs attention"
      tone="attention"
      count={total}
      footer={footer}
    >
      <div className={GRID}>
        {entries.map((entry) => {
          const { series, flag, delta, trend } = entry;
          const { marker, latest } = series;
          const unit = latest.unit ?? marker.unit;
          const range = fmtRange(latest);
          return (
            <CardShell
              key={marker.id}
              tone="attention"
              onOpen={() => onOpenMarker(marker.id)}
              onDismiss={() => onDismissMeasurement(latest.id)}
              dismissLabel={`Dismiss ${marker.name ?? marker.id}`}
              copy={{
                label: `Copy ${marker.name ?? marker.id} data`,
                getText: () => buildMarkerCopy(series, personLabel),
              }}
            >
              <span className="line-clamp-2 pr-6 text-xs font-medium leading-tight">
                {marker.name ?? marker.id}
              </span>
              <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <span className="flex items-baseline gap-1">
                  <span className="text-xl font-medium tabular-nums text-attention">
                    {fmtValue(latest.value)}
                  </span>
                  {unit ? (
                    <span className="text-[10px] text-muted-foreground">
                      {unit}
                    </span>
                  ) : null}
                </span>
                {delta !== null ? (
                  <span
                    className={cn(
                      "flex items-center gap-0.5 text-[10px] leading-tight",
                      trend === "worsening"
                        ? "text-attention"
                        : "text-muted-foreground"
                    )}
                  >
                    {delta >= 0 ? (
                      <MoveUpRight className="size-3 shrink-0" aria-hidden />
                    ) : (
                      <MoveDownRight className="size-3 shrink-0" aria-hidden />
                    )}
                    {delta >= 0 ? "+" : "−"}
                    {fmtValue(Math.abs(delta))}
                    {trend !== "flat" ? ` ${trend}` : ""}
                  </span>
                ) : (
                  <span className="text-[10px] leading-tight text-muted-foreground">
                    first reading
                  </span>
                )}
              </span>
              <span className="mt-auto pr-7 pt-1 text-[10px] leading-tight text-muted-foreground">
                {flag === "H" ? "High" : "Low"}
                {range ? ` · range ${range}` : ""}
                {" · "}
                {fmtDateCompact(latest.taken_on)}
              </span>
            </CardShell>
          );
        })}

        {findings.map((finding) => (
          <CardShell
            key={finding.id}
            tone="note"
            onDismiss={() => onDismissFinding(finding.id)}
            dismissLabel={`Dismiss ${finding.title ?? "finding"}`}
            copy={{
              label: `Copy ${finding.title ?? "finding"}`,
              getText: () =>
                [
                  `${finding.title ?? finding.kind ?? "Finding"} — ${personLabel}`,
                  fmtDate(finding.taken_on),
                  "",
                  finding.detail ?? "",
                ].join("\n"),
            }}
          >
            <span className="flex items-start gap-1.5 pr-6 text-xs font-medium leading-tight">
              <StickyNote
                className="mt-0.5 size-3 shrink-0 text-annotation"
                aria-hidden
              />
              <span className="line-clamp-2">
                {finding.title ?? finding.kind ?? "Finding"}
              </span>
            </span>
            {finding.detail ? (
              <p className="line-clamp-3 text-[10px] leading-relaxed text-muted-foreground">
                {finding.detail}
              </p>
            ) : null}
            <span className="mt-auto pr-7 pt-1 text-[10px] text-muted-foreground">
              {fmtDate(finding.taken_on)}
            </span>
          </CardShell>
        ))}
      </div>
    </Section>
  );
}
