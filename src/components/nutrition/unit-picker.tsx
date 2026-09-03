"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  UNITS,
  displayAmount,
  gramsFromAmount,
  updateFood,
  updateMealItem,
  type AmountUnit,
  type Food,
  type MealItem,
} from "@/lib/nutrition";

/**
 * Select unit — three choices, plus the one number that makes a count mean
 * something. Picking "pieces" without saying what a piece weighs would leave
 * the totals guessing, so the conversion is asked for in the same breath.
 */
export function UnitPicker({
  item,
  food,
  onClose,
  onChanged,
}: {
  item: MealItem;
  food: Food | undefined;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [unit, setUnit] = React.useState<AmountUnit>(item.amount_unit);
  const [conv, setConv] = React.useState(() =>
    String(
      (item.amount_unit === "piece" ? food?.grams_per_piece : food?.grams_per_ml) ??
        ""
    )
  );
  const [busy, setBusy] = React.useState(false);

  const needsConv = unit === "piece" || unit === "ml";
  const known =
    unit === "piece" ? food?.grams_per_piece : unit === "ml" ? food?.grams_per_ml : null;

  function pick(next: AmountUnit) {
    setUnit(next);
    setConv(
      String(
        (next === "piece" ? food?.grams_per_piece : next === "ml" ? food?.grams_per_ml : "") ??
          ""
      )
    );
  }

  async function save() {
    if (!food) return;
    setBusy(true);
    try {
      // Keep the amount the eye sees, and let the grams follow from it — the
      // alternative silently rewrites how much you ate.
      const shown = displayAmount(item, food);
      const n = Number(conv);
      const patch: Partial<Food> = {};
      if (unit === "piece" && Number.isFinite(n) && n > 0) patch.grams_per_piece = n;
      if (unit === "ml" && Number.isFinite(n) && n > 0) patch.grams_per_ml = n;
      if (Object.keys(patch).length) await updateFood(food.id, patch);

      const merged: Food = { ...food, ...patch };
      await updateMealItem(item.id, {
        amount_unit: unit,
        qty_g: gramsFromAmount(shown, unit, merged),
      });
      onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">Select unit</DialogTitle>
          <DialogDescription>{food?.name ?? "This ingredient"}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          {UNITS.map((u) => (
            <button
              key={u.value}
              type="button"
              onClick={() => pick(u.value)}
              aria-pressed={unit === u.value}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm transition-colors",
                unit === u.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card hover:border-ring/50"
              )}
            >
              {u.label}
            </button>
          ))}
        </div>

        {needsConv ? (
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">
              {unit === "piece" ? "One piece weighs" : "One millilitre weighs"}
            </span>
            <span className="flex items-baseline gap-2">
              <input
                inputMode="decimal"
                value={conv}
                onChange={(e) => setConv(e.target.value)}
                placeholder={unit === "piece" ? "e.g. 200" : "e.g. 0.91"}
                className="w-24 rounded-md border bg-background px-2 py-1.5 text-right text-sm tabular-nums"
              />
              <span className="text-sm text-muted-foreground">grams</span>
            </span>
            {!known && !conv ? (
              <span className="block text-xs text-attention">
                Without this the totals can&apos;t count this ingredient.
              </span>
            ) : null}
          </label>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || (needsConv && !Number(conv))}
            className="rounded-lg bg-foreground px-3 py-1.5 text-sm text-background transition-opacity disabled:opacity-40"
          >
            Save unit
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
