"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { matchFoods, rupees, unitOf, type Food } from "@/lib/nutrition";

/**
 * Type a name, see what the household already has.
 *
 * Reusing a row matters more than it looks: two ingredients called "Chicken"
 * and "chicken" are two sets of figures that drift apart, and the day totals
 * stop meaning anything. So the list is offered from the first letter, and
 * picking from it passes the id rather than the text.
 *
 * Follows the ARIA combobox pattern — arrows move, Enter takes, Escape
 * dismisses the list without losing what was typed.
 */
export function IngredientCombobox({
  foods,
  value,
  onChange,
  onPick,
  onEnter,
  id = "ingredient",
  placeholder,
  className,
}: {
  foods: Food[];
  value: string;
  onChange: (v: string) => void;
  /** An existing row was chosen. */
  onPick: (food: Food) => void;
  /** Enter with nothing highlighted — take the text as typed. */
  onEnter: () => void;
  id?: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const matches = React.useMemo(
    () => matchFoods(foods, value),
    [foods, value]
  );
  const listId = `${id}-list`;
  const shown = open && matches.length > 0;

  // A fresh query starts at the top rather than keeping the old highlight.
  React.useEffect(() => setActive(0), [value]);

  function take(food: Food) {
    onPick(food);
    setOpen(false);
  }

  return (
    <div className={cn("relative min-w-40 flex-1", className)}>
      <input
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={shown ? `${id}-opt-${active}` : undefined}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // A tap on an option fires after blur, so the list has to survive long
        // enough to be clicked — the options cancel their own mousedown.
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && shown) {
            e.preventDefault();
            setActive((i) => (i + 1) % matches.length);
          } else if (e.key === "ArrowUp" && shown) {
            e.preventDefault();
            setActive((i) => (i - 1 + matches.length) % matches.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (shown && matches[active]) take(matches[active]);
            else onEnter();
          } else if (e.key === "Escape" && shown) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        aria-label="Ingredient name"
        className="w-full rounded-md border bg-background px-2 py-1 text-xs"
      />

      {shown ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Existing ingredients"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border bg-popover py-1 shadow-lg"
        >
          {matches.map((f, i) => {
            const u = unitOf(f.base_unit);
            return (
              <li
                key={f.id}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  take(f);
                }}
                className={cn(
                  "flex cursor-pointer items-baseline gap-2 px-2.5 py-1.5 text-xs",
                  i === active && "bg-muted"
                )}
              >
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {f.price_per_unit === null
                    ? `per ${u.rate}`
                    : `${rupees(f.price_per_unit)} / ${u.rate}`}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
