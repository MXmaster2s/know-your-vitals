"use client";

import * as React from "react";
import { fmt1, type Totals } from "@/lib/nutrition";

/**
 * What a serving actually contains, one pill each.
 *
 * Only what is there: a food with no fat does not get a "0 g fat" pill, since
 * a zero reads as a measurement when it is really an absence. The qualitative
 * list beside it names substances and nothing else — what a nutrient does for
 * the person reading is a sentence for a conversation, not a value in a cell.
 */
export function NutrientPills({
  totals,
  nutrients,
  className,
}: {
  totals: Totals;
  nutrients: string | null;
  className?: string;
}) {
  const macros: [number, string][] = [
    [totals.protein_g, "protein"],
    [totals.carb_g, "carbs"],
    [totals.fat_g, "fat"],
    [totals.fiber_g, "fibre"],
  ];
  const named = (nutrients ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  return (
    <div className={className}>
      <ul className="flex flex-wrap gap-1">
        {totals.kcal >= 0.5 ? <Pill strong>{Math.round(totals.kcal)} kcal</Pill> : null}
        {macros
          .filter(([v]) => v >= 0.05)
          .map(([v, label]) => (
            <Pill key={label}>
              {fmt1(v)}g {label}
            </Pill>
          ))}
        {named.map((x) => (
          <Pill key={x} muted>
            {x}
          </Pill>
        ))}
      </ul>
    </div>
  );
}

function Pill({
  strong,
  muted,
  children,
}: {
  strong?: boolean;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      className={
        "rounded-full border px-1.5 py-px text-[11px] leading-normal tabular-nums " +
        (strong
          ? "border-foreground/25 text-foreground"
          : muted
            ? "border-border text-muted-foreground"
            : "border-border text-foreground/80")
      }
    >
      {children}
    </li>
  );
}
