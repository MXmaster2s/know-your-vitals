"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EditNum, EditWrapText } from "@/components/nutrition/edit-cell";
import { safeUrl } from "@/components/nutrition/link-picker";
import { cn } from "@/lib/utils";
import {
  deleteFood,
  perGramProtein,
  rupees2,
  tidyLabel,
  updateFood,
  type Food,
} from "@/lib/nutrition";

/**
 * The one place an ingredient is edited.
 *
 * Both tables open this: the Ingredients list, and a row inside Edit food. A
 * serving owns only how much of the thing was eaten — everything about the
 * thing itself lives here, so the same fact is never typed into two tables and
 * left to disagree with itself.
 *
 * Every figure is per kilo AS PURCHASED, the weight that goes on the scale.
 * One denominator, so a serving is a single multiplication.
 */
export function IngredientDialog({
  food,
  usedIn,
  editable,
  onChanged,
  onClose,
}: {
  food: Food;
  /** How many servings are built on this, so removing it can say what goes. */
  usedIn: number;
  editable: boolean;
  onChanged: () => void;
  onClose: () => void;
}) {
  const rate = perGramProtein(food);
  const href = safeUrl(food.source_url);

  const save = (patch: Partial<Food>) => async () => {
    await updateFood(food.id, patch);
    onChanged();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">
            <EditWrapText
              value={food.name}
              className="font-serif text-lg"
              disabled={!editable}
              onSave={async (v) => {
                if (!v) throw new Error("name required");
                await updateFood(food.id, { name: tidyLabel(v) });
                onChanged();
              }}
            />
          </DialogTitle>
          <DialogDescription>
            Everything here is per kilo as purchased — the weight you put on the
            scale, waste included.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Worth eating for">
            <EditWrapText
              value={food.nutrients}
              placeholder="—"
              emptyHint="What this food is worth eating for"
              className="text-sm text-muted-foreground"
              disabled={!editable}
              onSave={async (v) => {
                await updateFood(food.id, { nutrients: v });
                onChanged();
              }}
            />
          </Field>

          <div className="rounded-xl border bg-card/40 p-3">
            <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              Per kilo as purchased
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              <Num label="Cost ₹" value={food.price_per_kg} editable={editable}
                   onSave={async (v) => { await save({ price_per_kg: v })(); }} />
              <Num label="kcal" value={food.kcal_per_kg} editable={editable}
                   onSave={async (v) => { await save({ kcal_per_kg: v })(); }} />
              <Num label="Protein g" value={food.protein_g_per_kg} editable={editable}
                   onSave={async (v) => { await save({ protein_g_per_kg: v })(); }} />
              <Num label="Carbs g" value={food.carb_g_per_kg} editable={editable}
                   onSave={async (v) => { await save({ carb_g_per_kg: v })(); }} />
              <Num label="Fat g" value={food.fat_g_per_kg} editable={editable}
                   onSave={async (v) => { await save({ fat_g_per_kg: v })(); }} />
              <Num label="Fibre g" value={food.fiber_g_per_kg} editable={editable}
                   onSave={async (v) => { await save({ fiber_g_per_kg: v })(); }} />
            </dl>
            <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
              ₹ per gram of protein{" "}
              <span className="tabular-nums text-foreground">
                {rate === null ? "—" : rupees2(rate)}
              </span>
              {rate === null ? " — needs a cost and a protein figure" : null}
            </p>
          </div>

          <Field label="Edible g/kg">
            <div className="flex items-baseline gap-2">
              <EditNum
                value={food.edible_g_per_kg}
                width="w-16"
                align="left"
                disabled={!editable}
                emptyHint="How much of a kilo is food, not waste"
                onSave={async (v) => { await save({ edible_g_per_kg: v })(); }}
              />
              <span className="text-xs text-muted-foreground">
                what is left after the bone, shell or peel. Nothing calculates
                from this.
              </span>
            </div>
          </Field>

          <Field label="Product link">
            <UrlRow food={food} editable={editable} onChanged={onChanged} />
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="mt-1 block truncate text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                {href}
              </a>
            ) : null}
          </Field>

          {editable ? (
            <div className="border-t pt-3">
              <button
                type="button"
                onClick={async () => {
                  const warning = usedIn
                    ? `Remove "${food.name}"?\n\nIt is used ${usedIn} ${
                        usedIn === 1 ? "time" : "times"
                      } in your meals. Those servings go too, and the days they are in will drop the calories, protein and cost they contributed.`
                    : `Remove "${food.name}"? It is not used in any meal.`;
                  if (!window.confirm(warning)) return;
                  await deleteFood(food.id);
                  onChanged();
                  onClose();
                }}
                className="text-sm text-destructive underline underline-offset-4 transition-opacity hover:opacity-70"
              >
                Remove this ingredient
                {usedIn ? ` — used ${usedIn}×` : ""}
              </button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function Num({
  label,
  value,
  editable,
  onSave,
}: {
  label: string;
  value: number | null;
  editable: boolean;
  onSave: (v: number | null) => Promise<void>;
}) {
  return (
    <div className="flex items-baseline justify-between gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>
        <EditNum
          value={value}
          width="w-16"
          disabled={!editable}
          emptyHint={`${label} in one kilo as purchased`}
          onSave={onSave}
        />
      </dd>
    </div>
  );
}

/** A plain field rather than the LinkCell button — this is already a dialog,
 *  and opening a second one inside it to type a URL helps nobody. */
function UrlRow({
  food,
  editable,
  onChanged,
}: {
  food: Food;
  editable: boolean;
  onChanged: () => void;
}) {
  const [draft, setDraft] = React.useState(food.source_url ?? "");
  const [busy, setBusy] = React.useState(false);
  const dirty = draft.trim() !== (food.source_url ?? "");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="url"
        inputMode="url"
        value={draft}
        disabled={!editable}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="https://…"
        aria-label="Product URL"
        className="min-w-48 flex-1 rounded-md border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
      />
      {editable ? (
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={async () => {
            setBusy(true);
            try {
              await updateFood(food.id, { source_url: draft.trim() || null });
              onChanged();
            } finally {
              setBusy(false);
            }
          }}
          className={cn(
            "rounded-lg bg-foreground px-3 py-1.5 text-sm text-background",
            "transition-opacity disabled:opacity-40"
          )}
        >
          Save
        </button>
      ) : null}
    </div>
  );
}
