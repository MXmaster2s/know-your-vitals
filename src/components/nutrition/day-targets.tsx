"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { EditNum, EditWrapText } from "@/components/nutrition/edit-cell";
import { usePerson } from "@/components/person-provider";
import { cn } from "@/lib/utils";
import {
  NUTRIENTS,
  rupees,
  updateActivityTarget,
  updateNutritionTarget,
  verdict,
  type ActivityTarget,
  type NutrientDef,
  type NutritionTarget,
  type Totals,
} from "@/lib/nutrition";

const VERDICT = {
  under: { Icon: ArrowDown, label: "under" },
  over: { Icon: ArrowUp, label: "over" },
  on: { Icon: Check, label: "on target" },
} as const;

const dp = (v: number, places: number) =>
  v.toLocaleString("en-IN", { maximumFractionDigits: places });

/**
 * What the day is aiming at: the five macros and what it costs, then every
 * micronutrient the meals actually carry, then movement and body.
 *
 * On a phone both strips are two rows deep and scroll sideways, with the next
 * card left half-showing so there is no doubt more exists. Growing the list is
 * then a data question rather than a layout one — a fourteenth micronutrient
 * costs no vertical space. Above `sm` there is room to wrap and nothing
 * scrolls.
 */
export function DayTargets({
  totals,
  target,
  activity,
  onChanged,
  onOpen,
}: {
  totals: Totals;
  target: NutritionTarget | null;
  activity: ActivityTarget[];
  onChanged: () => void;
  /** A card opens the breakdown for its own nutrient. */
  onOpen: (nutrientKey: string) => void;
}) {
  const { personId, canEdit } = usePerson();
  const editable = canEdit(personId);

  return (
    <div className="space-y-2">
      <SwipeRow cols="auto-cols-[6.75rem] sm:auto-cols-auto sm:grid-cols-3 lg:grid-cols-6">
        {NUTRIENTS.map((n) => (
          <NutrientCard
            key={n.key}
            n={n}
            totals={totals}
            target={target}
            editable={editable}
            onChanged={onChanged}
            onOpen={onOpen}
          />
        ))}
      </SwipeRow>

      {activity.length > 0 ? (
        <SwipeRow cols="auto-cols-[9.5rem] sm:auto-cols-auto sm:grid-cols-3 lg:grid-cols-5">
          {activity.map((a) => (
            <div
              key={a.id}
              className="snap-start rounded-xl border bg-card px-2 py-2 sm:px-3 sm:py-2.5"
            >
              <div className="truncate text-[10px] text-muted-foreground sm:text-[11px]">
                {a.label}
              </div>
              <EditWrapText
                value={a.current}
                placeholder="—"
                disabled={!editable}
                className={cn(
                  "mt-0.5 text-sm",
                  Boolean(a.current) && Boolean(a.target) && a.current !== a.target
                    ? "text-attention"
                    : "text-foreground"
                )}
                onSave={async (v) => {
                  await updateActivityTarget(a.id, { current: v });
                  onChanged();
                }}
              />
              <EditWrapText
                value={a.target}
                placeholder="target"
                disabled={!editable}
                className="text-[10px] text-muted-foreground sm:text-[11px]"
                onSave={async (v) => {
                  await updateActivityTarget(a.id, { target: v });
                  onChanged();
                }}
              />
            </div>
          ))}
        </SwipeRow>
      ) : null}
    </div>
  );
}

/**
 * Two rows that scroll sideways on a phone and wrap on anything larger. The
 * negative margin lets the strip run to the screen edge, which is what makes a
 * half-visible card read as "there is more" rather than as a clipped mistake.
 */
function SwipeRow({
  cols,
  children,
}: {
  cols: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "-mx-5 overflow-x-auto px-5 pb-1",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0"
      )}
    >
      <div
        className={cn(
          "grid snap-x grid-flow-col grid-rows-2 gap-1.5",
          "sm:grid-flow-row sm:grid-rows-none sm:gap-2",
          cols
        )}
      >
        {children}
      </div>
    </div>
  );
}

function NutrientCard({
  n,
  totals,
  target,
  editable,
  onChanged,
  onOpen,
}: {
  n: NutrientDef;
  totals: Totals;
  target: NutritionTarget | null;
  editable: boolean;
  onChanged: () => void;
  onOpen: (key: string) => void;
}) {
  const actual = totals[n.key];
  const goal = n.target ? ((target?.[n.target] as number | null) ?? null) : null;
  const v = verdict(actual, goal);
  const cost = n.key === "cost";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${n.label} breakdown`}
      onClick={() => onOpen(n.key)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(n.key);
        }
      }}
      className={cn(
        "cursor-pointer snap-start rounded-xl border px-2 py-2 transition-colors sm:px-3 sm:py-2.5",
        "hover:border-ring/60 focus-visible:border-ring focus-visible:outline-none",
        cost ? "border-dashed bg-muted/30" : "bg-card",
        v === "on" && "border-positive/40 bg-positive/5",
        (v === "over" || v === "under") && "border-attention/40 bg-attention/5"
      )}
    >
      <div className="truncate text-[10px] text-muted-foreground sm:text-[11px]">
        {n.label}
      </div>

      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1 gap-y-1">
        <span className="text-lg tabular-nums leading-none sm:text-xl">
          {cost ? rupees(actual) : dp(actual, n.dp)}
        </span>
        <span className="text-[10px] text-muted-foreground sm:text-[11px]">
          {cost ? "/ day" : n.unit}
        </span>
        {v ? <Verdict verdict={v} /> : null}
      </div>

      {cost ? (
        <div className="mt-1 text-[10px] tabular-nums text-muted-foreground sm:text-[11px]">
          {rupees(actual * 7)} / wk
        </div>
      ) : (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-1 flex items-baseline gap-1 text-[10px] text-muted-foreground sm:text-[11px]"
        >
          <span>target</span>
          <EditNum
            value={goal}
            width="w-[3.25rem] sm:w-11"
            align="left"
            disabled={!editable || !target || !n.target}
            onSave={async (x) => {
              if (!target || !n.target) return;
              await updateNutritionTarget(target.id, { [n.target]: x });
              onChanged();
            }}
          />
        </div>
      )}
    </div>
  );
}

/** The reading's verdict, sitting with the reading rather than with the
 *  target — it describes what you ate, not what you were aiming at. */
function Verdict({ verdict }: { verdict: "under" | "over" | "on" }) {
  const { Icon, label } = VERDICT[verdict];
  return (
    <span
      className={cn(
        "inline-flex basis-full items-center gap-0.5 text-[10px] leading-none sm:basis-auto sm:text-[11px]",
        verdict === "on" ? "text-positive" : "text-attention"
      )}
    >
      <Icon className="size-2.5 sm:size-3" aria-hidden />
      {label}
    </span>
  );
}
