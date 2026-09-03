"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EditNum, EditText, EditWrapText } from "@/components/nutrition/edit-cell";
import { LinkCell } from "@/components/nutrition/link-picker";
import { UnitPicker } from "@/components/nutrition/unit-picker";
import { usePerson } from "@/components/person-provider";
import { cn } from "@/lib/utils";
import {
  deleteMealFood,
  deleteMealItem,
  displayAmount,
  findOrCreateFood,
  fmt0,
  fmt1,
  fmtClock,
  gramsFromAmount,
  insertMealFood,
  insertMealItem,
  itemTotals,
  mealTotals,
  rupees,
  summaryRenamed,
  summaryWith,
  summaryWithout,
  tidyLabel,
  updateFood,
  updateMeal,
  updateMealFood,
  updateMealItem,
  type AmountUnit,
  type Food,
  type Meal,
  type MealFood,
  type MealItem,
} from "@/lib/nutrition";

const COLS =
  "sm:grid-cols-[minmax(7rem,1.35fr)_3.5rem_4.25rem_minmax(7rem,1.35fr)_minmax(10rem,1.6fr)_2rem_3.75rem_1.5rem]";

/**
 * Edit food — one meal, broken into the Foods it is actually made of. A Food
 * is a box with a name and its own ingredients, because "Salad" is one thing
 * you eat and five things you bought.
 *
 * Five columns on a tablet and up; the same five as labelled rows on a phone,
 * since a five-column table at 393 px is a horizontal scrollbar pretending to
 * be a layout.
 */
export function MealDialog({
  meal,
  mealFoods,
  items,
  foods,
  onClose,
  onChanged,
}: {
  meal: Meal | null;
  mealFoods: MealFood[];
  items: MealItem[];
  foods: Food[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { personId, canEdit } = usePerson();
  const editable = canEdit(personId);
  const foodById = React.useMemo(
    () => new Map(foods.map((f) => [f.id, f])),
    [foods]
  );

  if (!meal) return null;

  const total = mealTotals(items, foodById);
  const boxes = [...mealFoods].sort(
    (a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name)
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-[90dvh] gap-0 overflow-y-auto p-0 sm:max-w-5xl"
        // Focus lands on the panel, not the first Food's name field —
        // opening this to read it should not start an edit.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).focus();
        }}
      >
        <DialogHeader className="sticky top-0 z-10 border-b bg-background px-5 pb-3 pt-5 text-left">
          <DialogTitle className="font-serif text-xl">Edit food</DialogTitle>
          <DialogDescription asChild>
            <div>
              <span className="block text-foreground">
                {meal.name}
                <span className="ml-2 text-muted-foreground">
                  {fmtClock(meal.at_time)}
                </span>
              </span>
              <span className="block tabular-nums">
                {fmt0(total.kcal)} kcal · {fmt0(total.protein_g)}g protein ·{" "}
                {fmt0(total.carb_g)}g carbs · {fmt0(total.fat_g)}g fat ·{" "}
                {rupees(total.cost)}
              </span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-3 pb-3 pt-3 sm:px-5 sm:pb-5">
          {boxes.map((box) => (
            <FoodBox
              key={box.id}
              box={box}
              meal={meal}
              items={items.filter((i) => i.meal_food_id === box.id)}
              foodById={foodById}
              editable={editable}
              onChanged={onChanged}
            />
          ))}

          {boxes.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              Nothing in this meal yet.
            </p>
          ) : null}

          {editable ? (
            <AddFood
              meal={meal}
              nextSort={(boxes[boxes.length - 1]?.sort ?? 0) + 1}
              onAdded={onChanged}
            />
          ) : (
            <p className="px-1 pt-1 text-xs text-muted-foreground">
              Read-only — only this day&apos;s owner can change it.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** One Food: its name, its ingredients, and a way to add another. */
function FoodBox({
  box,
  meal,
  items,
  foodById,
  editable,
  onChanged,
}: {
  box: MealFood;
  meal: Meal;
  items: MealItem[];
  foodById: Map<string, Food>;
  editable: boolean;
  onChanged: () => void;
}) {
  const rows = [...items].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  const t = mealTotals(rows, foodById);

  return (
    <section className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-2 pb-1.5 pt-2.5 sm:px-3">
        <div className="min-w-0 flex-1">
          {editable ? (
            <EditText
              value={box.name}
              className="font-serif text-base"
              onSave={async (v) => {
                if (!v) return;
                const next = tidyLabel(v);
                await updateMealFood(box.id, { name: next });
                await updateMeal(meal.id, {
                  food_summary: summaryRenamed(meal.food_summary, box.name, next),
                });
                onChanged();
              }}
            />
          ) : (
            <span className="block px-1.5 font-serif text-base">{box.name}</span>
          )}
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {fmt0(t.kcal)} kcal · {fmt0(t.protein_g)}g protein · {rupees(t.cost)}
        </span>
        {editable ? (
          <button
            type="button"
            aria-label={`Remove ${box.name}`}
            onClick={async () => {
              await deleteMealFood(box.id);
              await updateMeal(meal.id, {
                food_summary: summaryWithout(meal.food_summary, box.name),
              });
              onChanged();
            }}
            className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>

      <div
        className={cn(
          "hidden gap-2 border-b px-3 pb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70 sm:grid",
          COLS
        )}
      >
        <span>Item</span>
        <span>Amount</span>
        <span>Unit</span>
        <span>Comments</span>
        <span>Nutrition</span>
        <span />
        <span className="text-right">Price</span>
        <span />
      </div>

      <ul className="divide-y">
        {rows.length === 0 ? (
          <li className="px-3 py-3 text-sm text-muted-foreground">
            No ingredients yet.
          </li>
        ) : (
          rows.map((it) => (
            <ItemRow
              key={it.id}
              item={it}
              food={foodById.get(it.food_id)}
              editable={editable}
              onChanged={onChanged}
            />
          ))
        )}
      </ul>

      {editable ? (
        <div className="border-t px-2 py-2 sm:px-3">
          <AddIngredient
            mealId={meal.id}
            mealFoodId={box.id}
            nextSort={(rows[rows.length - 1]?.sort ?? 0) + 1}
            onAdded={onChanged}
          />
        </div>
      ) : null}
    </section>
  );
}
function ItemRow({
  item,
  food,
  editable,
  onChanged,
}: {
  item: MealItem;
  food: Food | undefined;
  editable: boolean;
  onChanged: () => void;
}) {
  const [unitOpen, setUnitOpen] = React.useState(false);
  const line = itemTotals(item, food);
  const amount = displayAmount(item, food);
  const unitLabel = unitWord(item.amount_unit, amount);
  // A food added by name has no figures yet — say so rather than counting it
  // as zero and letting the day totals quietly under-report.
  const missing = !food || food.kcal === null;

  const remove = editable ? (
    <button
      type="button"
      aria-label={`Remove ${food?.name ?? item.food_id}`}
      onClick={async () => {
        await deleteMealItem(item.id);
        onChanged();
      }}
      className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <X className="size-3.5" aria-hidden />
    </button>
  ) : null;

  return (
    <li
      className={cn(
        "grid grid-cols-1 gap-0.5 px-2 py-2.5 sm:items-start sm:gap-2 sm:px-3",
        COLS
      )}
    >
      <Cell label="Item">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1">
            {food ? (
              <EditText
                value={food.name}
                className="text-sm"
                disabled={!editable}
                onSave={async (v) => {
                  if (!v) return;
                  await updateFood(food.id, { name: tidyLabel(v) });
                  onChanged();
                }}
              />
            ) : (
              <span className="text-sm">{item.food_id}</span>
            )}
          </span>
          <span className="sm:hidden">{remove}</span>
        </span>
      </Cell>

      {/* Amount and its unit belong together — on a phone they share a line. */}
      <div className="grid grid-cols-2 gap-2 sm:contents">
        <Cell label="Amount">
          <EditNum
            value={amount}
            width="w-12"
            align="left"
            disabled={!editable}
            onSave={async (n) => {
              await updateMealItem(item.id, {
                qty_g: gramsFromAmount(n ?? 0, item.amount_unit, food),
              });
              onChanged();
            }}
          />
        </Cell>

        <Cell label="Unit">
          <button
            type="button"
            disabled={!editable}
            onClick={() => setUnitOpen(true)}
            title={editable ? "Change the unit" : undefined}
            className={cn(
              "rounded-md px-1.5 py-0.5 text-sm transition-colors",
              editable
                ? "cursor-pointer underline decoration-dotted underline-offset-4 hover:bg-muted"
                : "cursor-default"
            )}
          >
            {unitLabel}
          </button>
          {item.amount_unit !== "g" ? (
            <span className="block px-1.5 text-[11px] text-muted-foreground">
              {fmt0(item.qty_g)} g
            </span>
          ) : null}
        </Cell>
      </div>

      <Cell label="Comments">
        <EditWrapText
          value={item.comments}
          placeholder="—"
          className="text-xs"
          disabled={!editable}
          onSave={async (v) => {
            await updateMealItem(item.id, { comments: v ? tidyLabel(v) : null });
            onChanged();
          }}
        />
      </Cell>

      <Cell label="Nutrition">
        <EditWrapText
          value={food?.nutrients ?? null}
          placeholder="Fetching data"
          emptyHint="Data will update next time Rohit works on the site."
          className="text-xs"
          disabled={!editable || !food}
          onSave={async (v) => {
            if (!food) return;
            await updateFood(food.id, { nutrients: v });
            onChanged();
          }}
        />
        {/* Calories sit under the line they belong to, the way the grams sit
            under the unit. Nothing is shown while there are no figures —
            "0 kcal" would read as a measurement rather than a gap. */}
        {missing ? null : (
          <span className="block px-1.5 text-[11px] tabular-nums text-muted-foreground">
            {fmt0(line.kcal)} kcal
          </span>
        )}
      </Cell>

      {/* Link and price are both narrow — on a phone they share a line too. */}
      <div className="grid grid-cols-2 gap-2 sm:contents">
      <Cell label="Link">
        <LinkCell food={food} editable={editable} onChanged={onChanged} />
      </Cell>

      <Cell label="Price" align="right">
        <span className="flex items-baseline gap-0.5 sm:justify-end">
          <span className="text-xs text-muted-foreground">₹</span>
          <EditNum
            value={item.price}
            width="w-11"
            disabled={!editable}
            onSave={async (n) => {
              // What this item cost, as stated. Nothing is inferred from a
              // per-kg rate — the rate is the softer number, not this one.
              await updateMealItem(item.id, { price: n });
              onChanged();
            }}
          />
        </span>
      </Cell>
      </div>

      <div className="hidden sm:block sm:pt-0.5">{remove}</div>

      {unitOpen ? (
        <UnitPicker
          item={item}
          food={food}
          onClose={() => setUnitOpen(false)}
          onChanged={onChanged}
        />
      ) : null}
    </li>
  );
}

function unitWord(unit: AmountUnit, amount: number): string {
  if (unit === "g") return "g";
  if (unit === "ml") return "ml";
  return amount === 1 ? "piece" : "pieces";
}

/** Stacked rows on a phone need their column name; the table already has one. */
function Cell({
  label,
  align,
  children,
}: {
  label: string;
  align?: "right";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline gap-2 sm:block",
        align === "right" && "sm:text-right"
      )}
    >
      <span className="w-14 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground/70 sm:hidden">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
/**
 * Free text on purpose. The point is to write down what you actually ate the
 * moment you eat it — the figures can be looked up afterwards. A name the
 * household already has reuses that ingredient; anything else creates a bare
 * row waiting for its numbers.
 */
function AddIngredient({
  mealId,
  mealFoodId,
  nextSort,
  onAdded,
}: {
  mealId: string;
  mealFoodId: string;
  nextSort: number;
  onAdded: () => void;
}) {
  const [name, setName] = React.useState("");
  const [qty, setQty] = React.useState("100");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    const n = Number(qty);
    if (!name.trim() || !Number.isFinite(n)) return;
    setBusy(true);
    setError(null);
    try {
      const foodId = await findOrCreateFood(name);
      await insertMealItem({
        meal_id: mealId,
        meal_food_id: mealFoodId,
        food_id: foodId,
        qty_g: n,
        sort: nextSort,
      });
      setName("");
      setQty("100");
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
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Add an ingredient — paneer, curry leaves, ghee…"
          aria-label="Ingredient name"
          className="min-w-40 flex-1 rounded-md border bg-background px-2 py-1 text-xs"
        />
        <input
          inputMode="decimal"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          aria-label="Grams"
          className="w-14 rounded-md border bg-background px-2 py-1 text-right text-xs tabular-nums"
        />
        <span className="text-xs text-muted-foreground">g</span>
        <Button
          size="sm"
          variant="outline"
          className="h-8 cursor-pointer"
          disabled={!name.trim() || busy}
          onClick={submit}
        >
          <Plus className="size-3.5" aria-hidden /> Add ingredient
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

function AddFood({
  meal,
  nextSort,
  onAdded,
}: {
  meal: Meal;
  nextSort: number;
  onAdded: () => void;
}) {
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    const clean = tidyLabel(name);
    if (!clean) return;
    setBusy(true);
    try {
      await insertMealFood({ meal_id: meal.id, name: clean, sort: nextSort });
      await updateMeal(meal.id, {
        food_summary: summaryWith(meal.food_summary, clean),
      });
      setName("");
      onAdded();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed px-2 py-2 sm:px-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="Name a food — Salad, Smoothie, Dal…"
        aria-label="Food name"
        className="min-w-40 flex-1 rounded-md border bg-background px-2 py-1.5 text-sm"
      />
      <Button
        size="sm"
        variant="outline"
        className="h-9 cursor-pointer"
        disabled={!name.trim() || busy}
        onClick={submit}
      >
        <Plus className="size-3.5" aria-hidden /> Add food
      </Button>
    </div>
  );
}
