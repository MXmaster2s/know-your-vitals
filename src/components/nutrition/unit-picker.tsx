"use client";

import * as React from "react";
import { ModuleShell } from "@/components/nutrition/module-shell";
import { cn } from "@/lib/utils";
import { BASE_UNITS, updateFood, type BaseUnit, type Food } from "@/lib/nutrition";

/**
 * How this ingredient is bought and measured. It belongs to the ingredient
 * rather than to a serving, so two helpings of the same thing can never be
 * counted in different units.
 */
export function UnitPicker({
  food,
  editable,
  onChanged,
  onClose,
}: {
  food: Food;
  editable: boolean;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = React.useState<BaseUnit | null>(null);

  return (
    <ModuleShell title="Select unit" subtitle={food.name} onBack={onClose}>
      <ul className="space-y-2">
        {BASE_UNITS.map((u) => {
          const active = food.base_unit === u.value;
          return (
            <li key={u.value}>
              <button
                type="button"
                disabled={!editable || busy !== null}
                onClick={async () => {
                  if (active) return onClose();
                  setBusy(u.value);
                  try {
                    await updateFood(food.id, { base_unit: u.value });
                    onChanged();
                    onClose();
                  } finally {
                    setBusy(null);
                  }
                }}
                className={cn(
                  "flex w-full items-baseline justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  active ? "border-foreground bg-muted/50" : "hover:bg-muted/40",
                  busy === u.value && "opacity-50"
                )}
              >
                <span className="text-sm">{u.label}</span>
                <span className="text-xs text-muted-foreground">{u.hint}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Changing this changes what the figures mean. Restate them afterwards.
      </p>
    </ModuleShell>
  );
}
