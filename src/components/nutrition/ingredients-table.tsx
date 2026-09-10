"use client";

import * as React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { AI_MARK, IngredientDialog } from "@/components/nutrition/ingredient-dialog";
import { usePerson } from "@/components/person-provider";
import { cn } from "@/lib/utils";
import {
  fmt0,
  perGramProtein,
  unitOf,
  rupees2,
  type Food,
  type MealItem,
} from "@/lib/nutrition";

/** The pantry, priced per whatever unit each ingredient is bought in. A row
 *  opens the ingredient, which is the only place these figures are edited. */


type Key = "name" | "nutrients" | "cost" | "protein" | "edible" | "unit" | "rate";

const COLUMNS: {
  key: Key;
  label: React.ReactNode;
  align: "left" | "right";
  /** Which breakpoint the column appears at; undefined means always. */
  at?: string;
}[] = [
  { key: "name", label: "Name", align: "left" },
  { key: "nutrients", label: <>Nutrients {AI_MARK}</>, align: "left", at: "md" },
  { key: "cost", label: <>Cost <Unit>₹</Unit></>, align: "right" },
  { key: "protein", label: <>Protein {AI_MARK} <Unit>g</Unit></>, align: "right", at: "sm" },
  { key: "edible", label: <>Edible <Unit>g</Unit></>, align: "right", at: "lg" },
  { key: "unit", label: "Per", align: "left", at: "lg" },
  { key: "rate", label: <><Unit>₹ / g</Unit> protein</>, align: "right" },
];

function valueOf(food: Food, key: Key): string | number | null {
  switch (key) {
    case "name": return food.name.toLowerCase();
    case "nutrients": return food.nutrients?.toLowerCase() ?? null;
    case "cost": return food.price_per_unit;
    case "protein": return food.protein_g_per_unit;
    case "edible": return food.edible_g_per_unit;
    case "unit": return food.base_unit;
    case "rate": return perGramProtein(food);
  }
}

export function IngredientsTable({
  foods,
  items,
  onChanged,
}: {
  foods: Food[];
  /** Only to count where each food is used, so removing one can say what
   *  else goes with it. */
  items: MealItem[];
  onChanged: () => void;
}) {
  const { personId, canEdit } = usePerson();
  const editable = canEdit(personId);
  const [sort, setSort] = React.useState<{ key: Key; desc: boolean } | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);

  const usage = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.food_id, (m.get(it.food_id) ?? 0) + 1);
    return m;
  }, [items]);

  const rows = React.useMemo(() => {
    if (!sort) return foods;
    const dir = sort.desc ? -1 : 1;
    return [...foods].sort((a, b) => {
      const x = valueOf(a, sort.key);
      const y = valueOf(b, sort.key);
      // A blank is a figure nobody has looked up. It is not the smallest
      // value, so it sits at the bottom whichever way the column is pointing.
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return (typeof x === "string" ? String(x).localeCompare(String(y)) : Number(x) - Number(y)) * dir;
    });
  }, [foods, sort]);

  // Re-resolve against the latest fetch, so an edit inside the dialog is
  // reflected the moment it saves rather than when it is closed.
  const live = open ? (foods.find((f) => f.id === open) ?? null) : null;

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
            {COLUMNS.map((c) => {
              const active = sort?.key === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}
                  className={cn(
                    "border-b p-0 font-normal",
                    c.at === "sm" && "hidden sm:table-cell",
                    c.at === "md" && "hidden md:table-cell",
                    c.at === "lg" && "hidden lg:table-cell"
                  )}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setSort((s) =>
                        s?.key === c.key ? { key: c.key, desc: !s.desc } : { key: c.key, desc: false }
                      )
                    }
                    title={`Sort by ${typeof c.label === "string" ? c.label : c.key}`}
                    className={cn(
                      "flex w-full items-center gap-1 px-3 py-2 transition-colors hover:text-foreground",
                      c.align === "right" && "justify-end",
                      active && "text-foreground"
                    )}
                  >
                    <span>{c.label}</span>
                    {active ? (
                      sort.desc ? (
                        <ArrowDown className="size-3 shrink-0" aria-hidden />
                      ) : (
                        <ArrowUp className="size-3 shrink-0" aria-hidden />
                      )
                    ) : null}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((food, i) => {
            const last = i === rows.length - 1;
            const rate = perGramProtein(food);
            const num = (v: number | null, extra?: string) => (
              <td
                className={cn(
                  "px-3 py-3 text-right text-sm tabular-nums",
                  !last && "border-b",
                  extra
                )}
              >
                {v === null ? <span className="text-muted-foreground">—</span> : fmt0(v)}
              </td>
            );

            return (
              <tr
                key={food.id}
                role="button"
                tabIndex={0}
                aria-label={`Edit ${food.name}`}
                onClick={() => setOpen(food.id)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpen(food.id);
                  }
                }}
                className={cn(
                  "cursor-pointer align-top transition-colors",
                  "hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                )}
              >
                <td className={cn("px-3 py-3", !last && "border-b")}>
                  <span className="block font-serif text-base">{food.name}</span>
                  {/* Below md the nutrients ride under the name, the way the
                      food column rides under the event in The day. */}
                  {food.nutrients ? (
                    <span className="mt-0.5 block text-sm text-muted-foreground md:hidden">
                      {food.nutrients}
                    </span>
                  ) : null}
                </td>

                <td
                  className={cn(
                    "hidden px-3 py-3 text-sm text-muted-foreground md:table-cell",
                    !last && "border-b"
                  )}
                >
                  {food.nutrients ?? "—"}
                </td>

                {num(food.price_per_unit)}
                {num(food.protein_g_per_unit, "hidden sm:table-cell")}
                {num(food.edible_g_per_unit, "hidden lg:table-cell")}
                <td
                  className={cn(
                    "hidden px-3 py-3 text-sm text-muted-foreground lg:table-cell",
                    !last && "border-b"
                  )}
                >
                  {unitOf(food.base_unit).rate}
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

      <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
        {AI_MARK}: also editable by your AI.
        {foods.some((f) => perGramProtein(f) === null) ? (
          <>
            {" "}
            {fmt0(foods.filter((f) => perGramProtein(f) === null).length)} of{" "}
            {fmt0(foods.length)} need a figure.
          </>
        ) : null}
      </p>

      {live ? (
        <IngredientDialog
          food={live}
          usedIn={usage.get(live.id) ?? 0}
          editable={editable}
          onChanged={onChanged}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}

function Unit({ children }: { children: React.ReactNode }) {
  return <span className="normal-case tracking-normal">{children}</span>;
}
