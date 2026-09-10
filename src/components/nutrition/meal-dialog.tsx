"use client";

import * as React from "react";
import { ChevronLeft, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EditNum, EditText, EditWrapText } from "@/components/nutrition/edit-cell";
import { IngredientDialog } from "@/components/nutrition/ingredient-dialog";
import { usePerson } from "@/components/person-provider";
import { cn } from "@/lib/utils";
import {
  deleteMealFood,
  deleteMealItem,
  findOrCreateFood,
  fmt0,
  hasFigures,
  hasRate,
  fmt1,
  fmtClock,
  parseClock,
  insertMealFood,
  insertMealItem,
  itemTotals,
  unitOf,
  mealTotals,
  rupees,
  summaryRenamed,
  summaryWith,
  summaryWithout,
  tidyLabel,
  updateMeal,
  updateMealFood,
  updateMealItem,
  type Food,
  type Meal,
  type MealFood,
  type MealItem,
} from "@/lib/nutrition";

const COLS =
  "sm:grid-cols-[minmax(7rem,1.35fr)_3.5rem_4.25rem_minmax(7rem,1.3fr)_minmax(9rem,1.5fr)_4.75rem_1.5rem]";

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
  const [openFood, setOpenFood] = React.useState<string | null>(null);
  const foodById = React.useMemo(
    () => new Map(foods.map((f) => [f.id, f])),
    [foods]
  );
  // Re-resolved every render so an edit inside the ingredient shows here the
  // moment it saves.
  const liveFood = openFood ? (foodById.get(openFood) ?? null) : null;

  if (!meal) return null;

  const total = mealTotals(items, foodById);
  const boxes = [...mealFoods].sort(
    (a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name)
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        // Capped short of the viewport so there is always somewhere to tap to
        // get out of it on a phone.
        className="max-h-[80dvh] gap-0 overflow-y-auto p-0 sm:max-w-5xl"
        // Focus lands on the panel, not the first field — opening this to read
        // it should not start an edit.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).focus();
        }}
      >
        <DialogHeader className="sticky top-0 z-10 border-b bg-background px-3 pb-3 pt-3 text-left sm:px-5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              aria-label="Back"
              className="-ml-1.5 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <DialogTitle className="font-serif text-lg">Edit food</DialogTitle>
          </div>
          <DialogDescription asChild>
            <div className="pl-7">
              {/* The meal itself is edited here, not in The day. */}
              <span className="flex flex-wrap items-baseline gap-x-2">
                <EditText
                  value={meal.name}
                  className="w-auto min-w-24 font-serif text-base text-foreground"
                  disabled={!editable}
                  onSave={async (v) => {
                    if (!v) return;
                    await updateMeal(meal.id, { name: tidyLabel(v) });
                    onChanged();
                  }}
                />
                <EditText
                  value={fmtClock(meal.at_time)}
                  className="w-16 text-sm tabular-nums"
                  disabled={!editable}
                  onSave={async (v) => {
                    const parsed = v ? parseClock(v) : null;
                    if (v && !parsed) throw new Error("bad time");
                    await updateMeal(meal.id, { at_time: parsed });
                    onChanged();
                  }}
                />
              </span>
              <EditWrapText
                value={meal.food_summary}
                placeholder="What's in it"
                className="text-xs"
                disabled={!editable}
                onSave={async (v) => {
                  await updateMeal(meal.id, { food_summary: v });
                  onChanged();
                }}
              />
              <span className="block px-1.5 tabular-nums">
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
              onOpenFood={setOpenFood}
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
        {liveFood ? (
          <IngredientDialog
            food={liveFood}
            usedIn={items.filter((i) => i.food_id === liveFood.id).length}
            editable={editable}
            onChanged={onChanged}
            onClose={() => setOpenFood(null)}
          />
        ) : null}

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
  onOpenFood,
}: {
  box: MealFood;
  meal: Meal;
  items: MealItem[];
  foodById: Map<string, Food>;
  editable: boolean;
  onChanged: () => void;
  onOpenFood: (foodId: string) => void;
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
        <span>Amount / serving</span>
        <span>Unit</span>
        <span>Comments</span>
        <span>Nutrition / serving</span>
        <span className="text-right">Price / serving</span>
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
              onOpenFood={onOpenFood}
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
  onOpenFood,
}: {
  item: MealItem;
  food: Food | undefined;
  editable: boolean;
  onChanged: () => void;
  /** A serving owns only how much was eaten. Everything about the thing
   *  itself is edited in one place, which this opens. */
  onOpenFood: (foodId: string) => void;
}) {
  const line = itemTotals(item, food);
  const u = food ? unitOf(food.base_unit) : null;
  // A food added by name has no figures yet — say so rather than counting it
  // as zero and letting the day totals quietly under-report.
  const missing = !hasFigures(food);

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

  // Anywhere that is not a field opens the ingredient. The two cells that ARE
  // the serving — how much, and how it was made — swallow the click.
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <li
      role="button"
      tabIndex={0}
      aria-label={`Edit ${food?.name ?? item.food_id}`}
      onClick={() => food && onOpenFood(food.id)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (food) onOpenFood(food.id);
        }
      }}
      className={cn(
        "grid cursor-pointer grid-cols-1 gap-0.5 px-2 py-2.5 transition-colors sm:items-start sm:gap-2 sm:px-3",
        "hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none",
        COLS
      )}
    >
      <Cell label="Item">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 px-1.5 text-sm">
            {food?.name ?? item.food_id}
          </span>
          <span onClick={stop} className="sm:hidden">{remove}</span>
        </span>
      </Cell>

      {/* Amount and its unit belong together — on a phone they share a line. */}
      <div onClick={stop} className="grid grid-cols-2 gap-2 sm:contents">
        <Cell label="Amount / serving">
          <EditNum
            value={item.qty}
            width="w-14"
            align="left"
            disabled={!editable}
            onSave={async (n) => {
              await updateMealItem(item.id, { qty: n });
              onChanged();
            }}
          />
        </Cell>

        <Cell label="Unit">
          {/* The unit belongs to the ingredient, so this goes where it is
              chosen rather than opening a second picker here. */}
          <button
            type="button"
            disabled={!editable || !food}
            onClick={() => food && onOpenFood(food.id)}
            title={editable ? "Set on the ingredient" : undefined}
            className={cn(
              "rounded-md px-1.5 py-0.5 text-sm transition-colors",
              editable
                ? "cursor-pointer underline decoration-dotted underline-offset-4 hover:bg-muted"
                : "cursor-default"
            )}
          >
            {u?.amount ?? "—"}
          </button>
        </Cell>
      </div>

      <Cell label="Comments" onClick={stop}>
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

      {/* Both derived from the amount and the ingredient's per-kilo figures.
          Nothing here is typed: the serving states how much, the ingredient
          states what a kilo of it is, and these two are the product. */}
      <Cell label="Nutrition / serving">
        {missing ? (
          <span className="block px-1.5 text-xs italic text-muted-foreground/70">
            No figures yet
          </span>
        ) : (
          <>
            <span className="block px-1.5 text-sm tabular-nums">
              {fmt0(line.kcal)} kcal · {fmt1(line.protein_g)} g protein
            </span>
            <span className="block px-1.5 text-[11px] tabular-nums text-muted-foreground">
              {fmt1(line.carb_g)} c · {fmt1(line.fat_g)} f · {fmt1(line.fiber_g)} fib
            </span>
          </>
        )}
        {food?.nutrients ? (
          <span className="block px-1.5 text-[11px] text-muted-foreground">
            {food.nutrients}
          </span>
        ) : null}
      </Cell>

      <Cell label="Price / serving" align="right">
        {hasRate(food) ? (
          <span className="block px-1.5 text-sm tabular-nums">
            {rupees(line.cost)}
          </span>
        ) : (
          <span
            className="block px-1.5 text-xs italic text-muted-foreground/70"
            title="This ingredient has no cost per kilo yet"
          >
            No rate
          </span>
        )}
      </Cell>

      <div onClick={stop} className="hidden sm:block sm:pt-0.5">{remove}</div>

    </li>
  );
}


/** Stacked rows on a phone need their column name; the table already has one. */
function Cell({
  label,
  align,
  onClick,
  children,
}: {
  label: string;
  align?: "right";
  onClick?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
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
  // Which households' ingredients an existing name may match, so typing
  // "Tomato" reuses this household's row and never another one's.
  const { people } = usePerson();
  const households = React.useMemo(
    () => [...new Set(people.map((x) => x.household).filter((h): h is string => !!h))],
    [people]
  );

  async function submit() {
    const n = Number(qty);
    if (!name.trim() || !Number.isFinite(n)) return;
    setBusy(true);
    setError(null);
    try {
      const foodId = await findOrCreateFood(name, households);
      await insertMealItem({
        meal_id: mealId,
        meal_food_id: mealFoodId,
        food_id: foodId,
        qty: n,
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
