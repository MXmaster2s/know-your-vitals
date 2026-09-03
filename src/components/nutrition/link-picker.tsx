"use client";

import * as React from "react";
import { ExternalLink, Link2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { updateFood, type Food } from "@/lib/nutrition";

/** Only http(s) gets rendered as a link — anything else is text we ignore. */
export function safeUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

/**
 * Where this product came from. Not decoration — it is how the nutrition
 * figures get re-checked and refilled without guessing.
 */
export function LinkCell({
  food,
  editable,
  onChanged,
}: {
  food: Food | undefined;
  editable: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const href = safeUrl(food?.source_url ?? null);

  if (!food) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={href ?? "Add a product link"}
        aria-label={href ? `Product link for ${food.name}` : `Add a product link for ${food.name}`}
        className={cn(
          "grid size-6 place-items-center rounded-md transition-colors",
          href
            ? "text-foreground hover:bg-muted"
            : "text-muted-foreground/50 hover:bg-muted hover:text-foreground"
        )}
      >
        <Link2 className="size-3.5" aria-hidden />
      </button>

      {open ? (
        <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-serif text-lg">Product link</DialogTitle>
              <DialogDescription>{food.name}</DialogDescription>
            </DialogHeader>
            <UrlField
              food={food}
              editable={editable}
              onSaved={() => {
                onChanged();
                setOpen(false);
              }}
            />
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                Open in a new tab
              </a>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

function UrlField({
  food,
  editable,
  onSaved,
}: {
  food: Food;
  editable: boolean;
  onSaved: () => void;
}) {
  const [draft, setDraft] = React.useState(food.source_url ?? "");
  const [busy, setBusy] = React.useState(false);

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
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await updateFood(food.id, {
                source_url: draft.trim() || null,
              });
              onSaved();
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-lg bg-foreground px-3 py-1.5 text-sm text-background transition-opacity disabled:opacity-40"
        >
          Save
        </button>
      ) : null}
    </div>
  );
}
