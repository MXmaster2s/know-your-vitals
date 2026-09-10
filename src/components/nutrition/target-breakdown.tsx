"use client";

import * as React from "react";
import { ModuleShell } from "@/components/nutrition/module-shell";
import { cn } from "@/lib/utils";
import {
  NUTRIENTS,
  fmt0,
  itemOne,
  nutrientBy,
  nutrientValue,
  rupees,
  type Food,
  type Meal,
  type MealItem,
  type NutritionTarget,
} from "@/lib/nutrition";

interface Line {
  food: Food;
  value: number;
  meals: string[];
}

/**
 * Where a day's figure actually comes from. One row per ingredient, biggest
 * first, because the question behind opening this is always "what is doing
 * that" and the answer is usually two or three rows.
 *
 * An ingredient with no figure for this nutrient is named at the foot rather
 * than counted as zero — the total is only as complete as its inputs, and
 * saying so is cheaper than being quietly wrong.
 */
export function TargetBreakdown({
  nutrientKey,
  meals,
  items,
  foods,
  target,
  onPick,
  onClose,
}: {
  nutrientKey: string;
  meals: Meal[];
  items: MealItem[];
  foods: Food[];
  target: NutritionTarget | null;
  /** Switching nutrient without closing — the strip repeats inside. */
  onPick: (key: string) => void;
  onClose: () => void;
}) {
  const n = nutrientBy(nutrientKey) ?? NUTRIENTS[0];
  const foodById = React.useMemo(
    () => new Map(foods.map((f) => [f.id, f])),
    [foods]
  );
  const mealName = React.useMemo(
    () => new Map(meals.map((m) => [m.id, m.name])),
    [meals]
  );

  const { lines, total, missing } = React.useMemo(() => {
    const byFood = new Map<string, Line>();
    const blank = new Map<string, Food>();
    for (const it of items) {
      const food = foodById.get(it.food_id);
      if (!food) continue;
      const v = itemOne(it, food, n);
      if (v === null) {
        blank.set(food.id, food);
        continue;
      }
      const row = byFood.get(food.id);
      const where = mealName.get(it.meal_id) ?? "";
      if (row) {
        row.value += v;
        if (where && !row.meals.includes(where)) row.meals.push(where);
      } else {
        byFood.set(food.id, { food, value: v, meals: where ? [where] : [] });
      }
    }
    const lines = [...byFood.values()]
      .filter((l) => l.value > 0)
      .sort((a, b) => b.value - a.value);
    return {
      lines,
      total: lines.reduce((s, l) => s + l.value, 0),
      missing: [...blank.values()],
    };
  }, [items, foodById, mealName, n]);

  const goal = n.target ? ((target?.[n.target] as number | null) ?? null) : null;
  // Percentages read against the target when there is one, because that is the
  // number being aimed at. Without one, against the day's own total.
  const basis = goal && goal > 0 ? goal : total;
  const pct = (v: number) => (basis > 0 ? (v / basis) * 100 : 0);

  return (
    <ModuleShell title="Day targets breakdown" onBack={onClose}>
      <div className="space-y-3">
        <Strip active={n.key} onPick={onPick} />

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h3 className="font-serif text-lg">{n.label}</h3>
          <span className="text-base tabular-nums">
            {nutrientValue(n, total)}
          </span>
          {goal ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              of {nutrientValue(n, goal)} target · {fmt0(pct(total))}%
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              across the day
            </span>
          )}
        </div>

        {lines.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            Nothing in the day carries a figure for {n.label.toLowerCase()} yet.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {lines.map((l) => (
              <li key={l.food.id} className="px-3 py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {l.food.name}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums">
                    {nutrientValue(n, l.value)}
                  </span>
                  <span className="w-11 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {fmt0(pct(l.value))}%
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div
                    className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
                    aria-hidden
                  >
                    <div
                      className="h-full rounded-full bg-editable"
                      style={{ width: `${Math.min(100, pct(l.value))}%` }}
                    />
                  </div>
                  {l.meals.length ? (
                    <span className="shrink-0 text-[10px] text-muted-foreground/80">
                      {l.meals.join(", ")}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {missing.length ? (
          <p className="text-[11px] text-muted-foreground">
            No {n.label.toLowerCase()} figure yet, so counted as nothing rather
            than zero: {missing.map((f) => f.name).join(", ")}.
          </p>
        ) : null}

        {n.key === "cost" ? (
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {rupees(total * 7)} a week · {rupees(total * 30)} a month.
          </p>
        ) : null}
      </div>
    </ModuleShell>
  );
}

/** The same list the cards are in, so a wrong tap is one tap from right. */
function Strip({
  active,
  onPick,
}: {
  active: string;
  onPick: (key: string) => void;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max gap-1">
        {NUTRIENTS.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => onPick(x.key)}
            aria-current={x.key === active}
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-1 text-xs transition-colors",
              x.key === active
                ? "border-foreground bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {x.label}
          </button>
        ))}
      </div>
    </div>
  );
}
