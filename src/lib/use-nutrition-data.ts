"use client";

import * as React from "react";
import { usePerson } from "@/components/person-provider";
import {
  getActivityTargets,
  getFoods,
  getMealFoods,
  getMealItems,
  getMeals,
  getNutritionTargets,
  type ActivityTarget,
  type Food,
  type Meal,
  type MealFood,
  type MealItem,
  type NutritionTarget,
} from "@/lib/nutrition";

export interface NutritionData {
  foods: Food[];
  meals: Meal[];
  mealFoods: MealFood[];
  items: MealItem[];
  targets: NutritionTarget[];
  activity: ActivityTarget[];
}

/** Everything the Nutrition tab needs. Meal items need the meal ids first, so
 *  this is two round-trips rather than one — the rest go in parallel. */
export function useNutritionData() {
  const { personId, people } = usePerson();
  const [data, setData] = React.useState<NutritionData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  // The ingredient library belongs to a household, so the fetch has to key on
  // it as well as the person.
  const households = React.useMemo(
    () => [...new Set(people.map((p) => p.household).filter((h): h is string => !!h))].sort(),
    [people]
  );
  const requestKey = `${personId ?? ""}@${households.join(",")}#${tick}`;
  const [lastKey, setLastKey] = React.useState(requestKey);
  if (lastKey !== requestKey) {
    setLastKey(requestKey);
    setError(null);
  }

  React.useEffect(() => {
    if (!personId) return;
    let cancelled = false;
    (async () => {
      const [foods, meals, targets, activity] = await Promise.all([
        getFoods(households),
        getMeals(personId),
        getNutritionTargets(personId),
        getActivityTargets(personId),
      ]);
      const mealIds = meals.map((m) => m.id);
      const [mealFoods, items] = await Promise.all([
        getMealFoods(mealIds),
        getMealItems(mealIds),
      ]);
      if (!cancelled)
        setData({ foods, meals, mealFoods, items, targets, activity });
    })().catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : String(e));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const refresh = React.useCallback(() => setTick((t) => t + 1), []);
  return { data, error, refresh };
}
