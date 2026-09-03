"use client";

import * as React from "react";
import { DayTable } from "@/components/nutrition/day-table";
import { DayTargets } from "@/components/nutrition/day-targets";
import { MealDialog } from "@/components/nutrition/meal-dialog";
import { ModuleHeading } from "@/components/nutrition/module-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { usePerson } from "@/components/person-provider";
import { useNutritionData } from "@/lib/use-nutrition-data";
import { mealTotals, sumTotals, type Meal } from "@/lib/nutrition";

export default function NutritionPage() {
  const { personId, labelFor } = usePerson();
  const { data, error, refresh } = useNutritionData();
  const [openMeal, setOpenMeal] = React.useState<Meal | null>(null);

  const foodById = React.useMemo(
    () => new Map((data?.foods ?? []).map((f) => [f.id, f])),
    [data?.foods]
  );

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Couldn&apos;t load nutrition: {error}
      </p>
    );
  }

  if (!data || !personId) return <NutritionSkeleton />;

  const target =
    data.targets.find((t) => t.is_active) ?? data.targets[0] ?? null;

  const itemsFor = (mealId: string) =>
    data.items.filter((i) => i.meal_id === mealId);
  const foodsFor = (mealId: string) =>
    data.mealFoods.filter((f) => f.meal_id === mealId);

  const dayTotal = sumTotals(
    data.meals.map((m) => mealTotals(itemsFor(m.id), foodById))
  );

  // Re-resolve against the latest fetch — an edit to the row's time or name
  // must not leave the dialog showing what it used to say.
  const liveMeal = openMeal
    ? (data.meals.find((m) => m.id === openMeal.id) ?? null)
    : null;

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-2xl">Nutrition · {labelFor(personId)}</h1>

      <section className="space-y-3">
        <ModuleHeading>Day targets</ModuleHeading>
        <DayTargets
          totals={dayTotal}
          target={target}
          activity={data.activity}
          onChanged={refresh}
        />
      </section>

      <section className="space-y-3">
        <ModuleHeading>The day</ModuleHeading>
        <DayTable
          meals={data.meals}
          items={data.items}
          foods={data.foods}
          onOpenMeal={setOpenMeal}
          onChanged={refresh}
        />
      </section>

      <MealDialog
        meal={liveMeal}
        mealFoods={liveMeal ? foodsFor(liveMeal.id) : []}
        items={liveMeal ? itemsFor(liveMeal.id) : []}
        foods={data.foods}
        onClose={() => setOpenMeal(null)}
        onChanged={refresh}
      />
    </div>
  );
}

function NutritionSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-8 w-44" />
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
