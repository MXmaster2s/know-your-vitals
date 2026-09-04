"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditText, EditWrapText } from "@/components/nutrition/edit-cell";
import { createMeal } from "@/lib/data";
import { usePerson } from "@/components/person-provider";
import { cn } from "@/lib/utils";
import {
  fmt0,
  fmtClock,
  mealTotals,
  parseClock,
  rupees,
  tidyLabel,
  updateMeal,
  type Food,
  type Meal,
  type MealItem,
} from "@/lib/nutrition";

/**
 * The day as a timetable. The time column is a continuous spine — one hairline
 * rule running the height of the table — because the order of the day is the
 * information here, not decoration. Everything else stays quiet.
 *
 * Time, event and food edit in place. Anywhere else on the row opens the meal.
 * The three derived columns do not edit here: they are totalled up from the
 * ingredients in Edit food, which is the only place they can honestly change.
 */
export function DayTable({
  meals,
  items,
  foods,
  onOpenMeal,
  onChanged,
}: {
  meals: Meal[];
  items: MealItem[];
  foods: Food[];
  onOpenMeal: (meal: Meal) => void;
  onChanged: () => void;
}) {
  const { personId, canEdit } = usePerson();
  const editable = canEdit(personId);

  const foodById = React.useMemo(
    () => new Map(foods.map((f) => [f.id, f])),
    [foods]
  );
  const itemsByMeal = React.useMemo(() => {
    const m = new Map<string, MealItem[]>();
    for (const it of items) {
      const list = m.get(it.meal_id);
      if (list) list.push(it);
      else m.set(it.meal_id, [it]);
    }
    return m;
  }, [items]);

  if (meals.length === 0) {
    return (
      <div className="space-y-3">
        <p className="rounded-xl border border-dashed bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
          {editable
            ? "Nothing here yet. Add the first thing you eat in a day and work forward."
            : "No meals yet."}
        </p>
        {editable && personId ? (
          <AddMeal personId={personId} nextSort={1} onAdded={onChanged} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
            <th scope="col" className="w-[4.75rem] border-b border-r px-3 py-2 font-normal sm:w-24">
              Time
            </th>
            <th scope="col" className="border-b px-3 py-2 font-normal">
              Event
            </th>
            <th scope="col" className="hidden border-b px-3 py-2 font-normal sm:table-cell">
              Food
            </th>
            <th scope="col" className="border-b px-2 py-2 text-right font-normal">
              kcal
            </th>
            <th scope="col" className="hidden border-b px-2 py-2 text-right font-normal sm:table-cell">
              Protein
            </th>
            <th scope="col" className="hidden border-b px-3 py-2 text-right font-normal sm:table-cell">
              Cost
            </th>
          </tr>
        </thead>
        <tbody>
          {meals.map((meal, i) => {
            const t = mealTotals(itemsByMeal.get(meal.id) ?? [], foodById);
            const last = i === meals.length - 1;
            const open = () => onOpenMeal(meal);
            const stop = (e: React.MouseEvent) => editable && e.stopPropagation();

            const foodCell = (
              <EditWrapText
                value={meal.food_summary}
                placeholder="What's in it"
                className="text-sm text-muted-foreground"
                disabled={!editable}
                onSave={async (v) => {
                  await updateMeal(meal.id, { food_summary: v });
                  onChanged();
                }}
              />
            );

            return (
              <tr
                key={meal.id}
                role="button"
                tabIndex={0}
                aria-label={`Open ${meal.name}`}
                onClick={open}
                onKeyDown={(e) => {
                  // Only when the row itself has focus. Without this, a space
                  // typed into any field inside the row bubbles up here and
                  // opens the meal instead of typing a space.
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    open();
                  }
                }}
                className={cn(
                  "group cursor-pointer align-top transition-colors",
                  "hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                )}
              >
                <td
                  onClick={stop}
                  className={cn(
                    "border-r px-1.5 py-3 text-sm tabular-nums text-muted-foreground",
                    !last && "border-b"
                  )}
                >
                  {editable ? (
                    <EditText
                      value={fmtClock(meal.at_time)}
                      className="text-right text-sm tabular-nums"
                      onSave={async (v) => {
                        const parsed = v ? parseClock(v) : null;
                        if (v && !parsed) throw new Error("bad time");
                        await updateMeal(meal.id, { at_time: parsed });
                        onChanged();
                      }}
                    />
                  ) : (
                    <span className="block px-1.5 text-right">
                      {fmtClock(meal.at_time)}
                    </span>
                  )}
                </td>

                <td onClick={stop} className={cn("px-1.5 py-3", !last && "border-b")}>
                  {editable ? (
                    <EditText
                      value={meal.name}
                      className="font-serif text-base"
                      onSave={async (v) => {
                        if (!v) return;
                        await updateMeal(meal.id, { name: tidyLabel(v) });
                        onChanged();
                      }}
                    />
                  ) : (
                    <span className="block px-1.5 font-serif text-base">
                      {meal.name}
                    </span>
                  )}
                  {meal.time_note ? (
                    <span className="block px-1.5 text-[11px] text-muted-foreground">
                      {meal.time_note}
                    </span>
                  ) : null}
                  {/* Below sm the food column rides under the event name. */}
                  <div className="mt-0.5 sm:hidden">{foodCell}</div>
                </td>

                <td
                  onClick={stop}
                  className={cn("hidden px-1.5 py-3 sm:table-cell", !last && "border-b")}
                >
                  {foodCell}
                </td>

                <td className={cn("px-2 py-3 text-right text-sm tabular-nums", !last && "border-b")}>
                  {t.kcal >= 0.5 ? fmt0(t.kcal) : "—"}
                </td>
                <td
                  className={cn(
                    "hidden px-2 py-3 text-right text-sm tabular-nums text-muted-foreground sm:table-cell",
                    !last && "border-b"
                  )}
                >
                  {t.protein_g >= 0.5 ? `${fmt0(t.protein_g)}g` : "—"}
                </td>
                <td
                  className={cn(
                    "hidden px-3 py-3 text-right text-sm tabular-nums text-muted-foreground sm:table-cell",
                    !last && "border-b"
                  )}
                >
                  {t.cost >= 0.5 ? rupees(t.cost) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {editable && personId ? (
        <div className="border-t px-3 py-2">
          <AddMeal
            personId={personId}
            nextSort={meals.length + 1}
            onAdded={onChanged}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * A meal is the container everything else hangs off, so without this a person
 * with an empty day has nothing to do. Time is optional — plenty of people
 * know they eat breakfast before they know when.
 */
function AddMeal({
  personId,
  nextSort,
  onAdded,
}: {
  personId: string;
  nextSort: number;
  onAdded: () => void;
}) {
  const [name, setName] = React.useState("");
  const [time, setTime] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    const clean = tidyLabel(name);
    if (!clean) return;
    const at = time.trim() ? parseClock(time) : null;
    if (time.trim() && !at) {
      setError("Times look like 9:30am or 19:30.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createMeal({ person_id: personId, name: clean, at_time: at, sort: nextSort });
      setName("");
      setTime("");
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={time}
          onChange={(e) => setTime(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="9:30am"
          aria-label="Time"
          className="w-20 rounded-md border bg-background px-2 py-1 text-xs tabular-nums"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Breakfast, lunch, tea…"
          aria-label="Meal name"
          className="min-w-32 flex-1 rounded-md border bg-background px-2 py-1 text-xs"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8 cursor-pointer"
          disabled={!name.trim() || busy}
          onClick={submit}
        >
          <Plus className="size-3.5" aria-hidden /> Add meal
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-[11px] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
