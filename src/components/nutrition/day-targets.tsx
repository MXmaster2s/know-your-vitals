"use client";

import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { EditNum, EditWrapText } from "@/components/nutrition/edit-cell";
import { usePerson } from "@/components/person-provider";
import { cn } from "@/lib/utils";
import {
  fmt0,
  rupees,
  updateActivityTarget,
  updateNutritionTarget,
  verdict,
  type ActivityTarget,
  type NutritionTarget,
  type Totals,
} from "@/lib/nutrition";

const VERDICT = {
  under: { Icon: ArrowDown, label: "under" },
  over: { Icon: ArrowUp, label: "over" },
  on: { Icon: Check, label: "on target" },
} as const;

const MACROS = [
  { key: "kcal", label: "Calories", unit: "kcal" },
  { key: "protein_g", label: "Protein", unit: "g" },
  { key: "carb_g", label: "Carbs", unit: "g" },
  { key: "fat_g", label: "Fat", unit: "g" },
  { key: "fiber_g", label: "Fibre", unit: "g" },
] as const;

/**
 * What the day is aiming at, in one place: the five macros against what the
 * meals below add up to, what it costs, then the movement, sleep and body
 * targets. Costs are shown per week and per month as well as per day — those
 * are the numbers a household actually budgets in.
 */
export function DayTargets({
  totals,
  target,
  activity,
  onChanged,
}: {
  totals: Totals;
  target: NutritionTarget | null;
  activity: ActivityTarget[];
  onChanged: () => void;
}) {
  const { personId, canEdit } = usePerson();
  const editable = canEdit(personId);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 lg:grid-cols-6">
        {MACROS.map((m) => {
          const actual = totals[m.key as keyof Totals] as number;
          const t = target?.[m.key] ?? null;
          const v = verdict(actual, t);
          return (
            <div
              key={m.key}
              className={cn(
                "rounded-xl border bg-card px-2 py-2 transition-colors sm:px-3 sm:py-2.5",
                v === "on" && "border-positive/40 bg-positive/5",
                (v === "over" || v === "under") &&
                  "border-attention/40 bg-attention/5"
              )}
            >
              <div className="truncate text-[10px] text-muted-foreground sm:text-[11px]">
                {m.label}
              </div>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-lg tabular-nums leading-none sm:text-xl">
                  {fmt0(actual)}
                </span>
                <span className="text-[10px] text-muted-foreground sm:text-[11px]">
                  {m.unit}
                </span>
                {v ? (
                  <Verdict verdict={v} />
                ) : null}
              </div>
              <div className="mt-1 flex items-baseline gap-1 text-[10px] text-muted-foreground sm:text-[11px]">
                <span>target</span>
                <EditNum
                  value={t}
                  width="w-12 sm:w-11"
                  align="left"
                  disabled={!editable || !target}
                  onSave={async (n) => {
                    if (!target) return;
                    await updateNutritionTarget(target.id, { [m.key]: n });
                    onChanged();
                  }}
                />
              </div>
            </div>
          );
        })}

        <div className="rounded-xl border border-dashed bg-muted/30 px-2 py-2 sm:px-3 sm:py-2.5">
          <div className="truncate text-[10px] text-muted-foreground sm:text-[11px]">
            Food cost
          </div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="text-lg tabular-nums leading-none sm:text-xl">
              {rupees(totals.cost)}
            </span>
            <span className="text-[10px] text-muted-foreground sm:text-[11px]">
              / day
            </span>
          </div>
          <div className="mt-1 text-[10px] tabular-nums text-muted-foreground sm:text-[11px]">
            {rupees(totals.cost * 7)} / wk · {rupees(totals.cost * 30)} / mo
          </div>
        </div>
      </div>

      {activity.length > 0 ? (
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 lg:grid-cols-4">
          {activity.map((a) => {
            const behind =
              Boolean(a.current) && Boolean(a.target) && a.current !== a.target;
            return (
              <div
                key={a.id}
                className="rounded-xl border bg-card px-2 py-2 sm:px-3 sm:py-2.5"
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
                    behind ? "text-attention" : "text-foreground"
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
            );
          })}
        </div>
      ) : null}
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
        "inline-flex items-center gap-0.5 text-[10px] leading-none sm:text-[11px]",
        verdict === "on" ? "text-positive" : "text-attention"
      )}
    >
      <Icon className="size-2.5 sm:size-3" aria-hidden />
      {label}
    </span>
  );
}
