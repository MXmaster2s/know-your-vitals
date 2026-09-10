"use client";

import * as React from "react";
import { EditNum, EditWrapText } from "@/components/nutrition/edit-cell";
import { usePerson } from "@/components/person-provider";
import { cn } from "@/lib/utils";
import {
  fmt0,
  perGramProtein,
  rupees2,
  updateFood,
  type Food,
} from "@/lib/nutrition";

/**
 * The pantry priced the way you shop: everything per kilo, as purchased.
 *
 * Built to be read at a counter with a price board in front of you, so the two
 * columns that survive a phone screen are what it costs and what a gram of
 * protein costs. The rest appear as the screen widens.
 *
 * Edible/kg is the one column nothing reads. It says how much of the kilo is
 * food and how much is bone, shell or peel — a measure of the buy, not an
 * input to it. Both per-kilo figures already include that waste, so dividing
 * by it as well would count it twice.
 */
export function IngredientsTable({
  foods,
  onChanged,
}: {
  foods: Food[];
  onChanged: () => void;
}) {
  const { personId, canEdit } = usePerson();
  const editable = canEdit(personId);

  if (foods.length === 0) {
    return (
      <p className="rounded-xl border border-dashed bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
        No ingredients yet. They appear here as you add them to a meal.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
            <th scope="col" className="border-b px-3 py-2 font-normal">
              Name
            </th>
            <th
              scope="col"
              className="hidden border-b px-3 py-2 font-normal md:table-cell"
            >
              Nutrients
            </th>
            <th scope="col" className="border-b px-2 py-2 text-right font-normal">
              Cost <Unit>₹/kg</Unit>
            </th>
            <th
              scope="col"
              className="hidden border-b px-2 py-2 text-right font-normal sm:table-cell"
            >
              Protein <Unit>g/kg</Unit>
            </th>
            <th
              scope="col"
              className="hidden border-b px-2 py-2 text-right font-normal lg:table-cell"
            >
              Edible <Unit>g/kg</Unit>
            </th>
            <th scope="col" className="border-b px-3 py-2 text-right font-normal">
              <Unit>₹ / g</Unit> protein
            </th>
          </tr>
        </thead>
        <tbody>
          {foods.map((food, i) => {
            const last = i === foods.length - 1;
            const rate = perGramProtein(food);
            const cell = (extra?: string) =>
              cn("px-2 py-3 text-right", !last && "border-b", extra);

            const nutrients = (
              <EditWrapText
                value={food.nutrients}
                placeholder="—"
                emptyHint="What this is worth eating for"
                className="text-sm text-muted-foreground"
                disabled={!editable}
                onSave={async (v) => {
                  await updateFood(food.id, { nutrients: v });
                  onChanged();
                }}
              />
            );

            return (
              <tr key={food.id} className="align-top">
                <td className={cn("px-1.5 py-3", !last && "border-b")}>
                  <span className="block px-1.5 font-serif text-base">
                    {food.name}
                  </span>
                  {/* Below md the nutrients ride under the name, the way the
                      food column rides under the event in The day. */}
                  <div className="mt-0.5 md:hidden">{nutrients}</div>
                </td>

                <td
                  className={cn("hidden px-1.5 py-3 md:table-cell", !last && "border-b")}
                >
                  {nutrients}
                </td>

                <td className={cell()}>
                  <EditNum
                    value={food.price_per_kg}
                    width="w-16"
                    disabled={!editable}
                    emptyHint="What a kilo costs you"
                    onSave={async (v) => {
                      await updateFood(food.id, { price_per_kg: v });
                      onChanged();
                    }}
                  />
                </td>

                <td className={cell("hidden sm:table-cell")}>
                  <EditNum
                    value={food.protein_g_per_kg}
                    width="w-14"
                    disabled={!editable}
                    emptyHint="Protein in a kilo as bought"
                    onSave={async (v) => {
                      await updateFood(food.id, { protein_g_per_kg: v });
                      onChanged();
                    }}
                  />
                </td>

                <td className={cell("hidden lg:table-cell")}>
                  <EditNum
                    value={food.edible_g_per_kg}
                    width="w-14"
                    disabled={!editable}
                    emptyHint="How much of a kilo is food, not waste"
                    onSave={async (v) => {
                      await updateFood(food.id, { edible_g_per_kg: v });
                      onChanged();
                    }}
                  />
                </td>

                {/* Derived, so it can never disagree with the two figures it
                    comes from. A dash means one of them is still blank —
                    which is not the same as zero. */}
                <td
                  className={cn(
                    "px-3 py-3 text-right text-sm tabular-nums",
                    !last && "border-b"
                  )}
                >
                  {rate === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    rupees2(rate)
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="border-t px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        Everything is per kilo as purchased, waste included. Edible/kg is there
        to show what you are throwing away — nothing calculates from it.
        {foods.some((f) => perGramProtein(f) === null) ? (
          <>
            {" "}
            {fmt0(foods.filter((f) => perGramProtein(f) === null).length)} of{" "}
            {fmt0(foods.length)} still need a cost or a protein figure.
          </>
        ) : null}
      </p>
    </div>
  );
}

function Unit({ children }: { children: React.ReactNode }) {
  return <span className="normal-case tracking-normal">{children}</span>;
}
