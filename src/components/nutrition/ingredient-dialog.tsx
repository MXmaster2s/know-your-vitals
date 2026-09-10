"use client";

import * as React from "react";
import { ModuleShell } from "@/components/nutrition/module-shell";
import { UnitPicker } from "@/components/nutrition/unit-picker";
import { EditNum, EditWrapText } from "@/components/nutrition/edit-cell";
import { safeUrl } from "@/components/nutrition/link-picker";
import { cn } from "@/lib/utils";
import {
  deleteFood,
  tidyLabel,
  unitOf,
  updateFood,
  type Food,
} from "@/lib/nutrition";

/** Marks a field the AI keeps up to date. */
export const AI_MARK = "✳";

/** The fields the AI is responsible for, in the order they appear. Exported
 *  so the same list can be handed to it over MCP. */
export const AI_FIELDS = [
  "nutrients",
  "kcal_per_unit",
  "protein_g_per_unit",
  "carb_g_per_unit",
  "fat_g_per_unit",
  "fiber_g_per_unit",
] as const;

/**
 * The one place an ingredient is edited. Both the Ingredients list and a row
 * inside Edit food open this, so the same fact is never typed in two tables.
 */
export function IngredientDialog({
  food,
  usedIn,
  editable,
  onChanged,
  onClose,
}: {
  food: Food;
  usedIn: number;
  editable: boolean;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [unitOpen, setUnitOpen] = React.useState(false);
  const u = unitOf(food.base_unit);
  const href = safeUrl(food.source_url);

  const set = (patch: Partial<Food>) => async () => {
    await updateFood(food.id, patch);
    onChanged();
  };

  if (unitOpen) {
    return (
      <UnitPicker
        food={food}
        editable={editable}
        onChanged={onChanged}
        onClose={() => setUnitOpen(false)}
      />
    );
  }

  return (
    <ModuleShell title="Edit ingredient" onBack={onClose}>
      <div className="space-y-3">
        <Row label="Name">
          <EditWrapText
            value={food.name}
            className="text-sm"
            disabled={!editable}
            onSave={async (v) => {
              if (!v) throw new Error("name required");
              await updateFood(food.id, { name: tidyLabel(v) });
              onChanged();
            }}
          />
        </Row>

        <Row label={`Nutrients ${AI_MARK}`}>
          <EditWrapText
            value={food.nutrients}
            placeholder="—"
            className="text-sm text-muted-foreground"
            disabled={!editable}
            onSave={async (v) => {
              await updateFood(food.id, { nutrients: v });
              onChanged();
            }}
          />
        </Row>

        <div className="rounded-xl border bg-card/40 px-3 py-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Data as per {u.rate}
            </p>
            <button
              type="button"
              disabled={!editable}
              onClick={() => setUnitOpen(true)}
              className={cn(
                "text-xs underline decoration-dotted underline-offset-4 transition-colors",
                editable ? "hover:text-foreground" : "cursor-default",
                "text-muted-foreground"
              )}
            >
              Select unit
            </button>
          </div>
          <p className="mb-1.5 text-xs text-muted-foreground">
            Add details as per KG, Liter or Units.
          </p>
          <dl className="divide-y">
            <Num label="Cost ₹" value={food.price_per_unit} editable={editable}
                 onSave={async (v) => { await set({ price_per_unit: v })(); }} />
            <Num label={`kcal ${AI_MARK}`} value={food.kcal_per_unit} editable={editable}
                 onSave={async (v) => { await set({ kcal_per_unit: v })(); }} />
            <Num label={`Protein g ${AI_MARK}`} value={food.protein_g_per_unit} editable={editable}
                 onSave={async (v) => { await set({ protein_g_per_unit: v })(); }} />
            <Num label={`Carbs g ${AI_MARK}`} value={food.carb_g_per_unit} editable={editable}
                 onSave={async (v) => { await set({ carb_g_per_unit: v })(); }} />
            <Num label={`Fat g ${AI_MARK}`} value={food.fat_g_per_unit} editable={editable}
                 onSave={async (v) => { await set({ fat_g_per_unit: v })(); }} />
            <Num label={`Fibre g ${AI_MARK}`} value={food.fiber_g_per_unit} editable={editable}
                 onSave={async (v) => { await set({ fiber_g_per_unit: v })(); }} />
            <Num label="Edible g" value={food.edible_g_per_unit} editable={editable}
                 onSave={async (v) => { await set({ edible_g_per_unit: v })(); }} />
          </dl>
        </div>

        <Row label="Product link">
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
        </Row>

        {editable ? (
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
            Remove this ingredient{usedIn ? ` — used ${usedIn}×` : ""}
          </button>
        ) : null}

        <p className="border-t pt-2 text-[11px] text-muted-foreground">
          {AI_MARK}: also editable by your AI.
        </p>
      </div>
    </ModuleShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <p className="w-24 shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="min-w-0 flex-1">{children}</div>
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
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd>
        <EditNum value={value} width="w-20" disabled={!editable} onSave={onSave} />
      </dd>
    </div>
  );
}

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
        className="min-w-40 flex-1 rounded-md border bg-background px-2 py-1 text-sm disabled:opacity-50"
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
          className="rounded-lg bg-foreground px-3 py-1 text-sm text-background transition-opacity disabled:opacity-40"
        >
          Save
        </button>
      ) : null}
    </div>
  );
}
