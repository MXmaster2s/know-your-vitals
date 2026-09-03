"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Inline editor that commits on blur or Enter and rolls back if the write
 * fails. Escape abandons the edit. Deliberately not a form — every cell is
 * independent, and a failed save should not cost you the other cells.
 */
export function EditNum({
  value,
  onSave,
  suffix,
  width = "w-16",
  align = "right",
  disabled,
}: {
  value: number | null;
  onSave: (next: number | null) => Promise<void>;
  suffix?: string;
  width?: string;
  align?: "left" | "right";
  disabled?: boolean;
}) {
  const text = value === null || value === undefined ? "" : String(value);
  const [draft, setDraft] = React.useState(text);
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  // Resync when the row changes underneath us (refresh, person switch).
  const [seen, setSeen] = React.useState(text);
  if (seen !== text && !busy) {
    setSeen(text);
    setDraft(text);
  }

  async function commit() {
    const raw = draft.trim();
    const next = raw === "" ? null : Number(raw);
    if (next !== null && !Number.isFinite(next)) {
      setDraft(text);
      return;
    }
    if (next === value) return;
    setBusy(true);
    setFailed(false);
    try {
      await onSave(next);
      setSeen(raw);
    } catch {
      setDraft(text);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-baseline gap-1">
      <input
        inputMode="decimal"
        disabled={disabled}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(text);
            e.currentTarget.blur();
          }
        }}
        className={cn(
          width,
          align === "right" ? "text-right" : "text-left",
          "rounded-md border border-transparent bg-transparent px-1.5 py-0.5",
          "tabular-nums transition-colors",
          "hover:border-border focus:border-ring focus:bg-background focus:outline-none",
          busy && "opacity-50",
          failed && "border-destructive text-destructive",
          disabled && "cursor-not-allowed opacity-40"
        )}
        aria-invalid={failed || undefined}
      />
      {suffix ? (
        <span className="text-xs text-muted-foreground">{suffix}</span>
      ) : null}
    </span>
  );
}

/** Same contract for free text — used by the activity targets. */
export function EditText({
  value,
  onSave,
  placeholder,
  className,
  disabled,
  autoFocus,
  onDone,
}: {
  value: string | null;
  onSave: (next: string | null) => Promise<void>;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onDone?: () => void;
}) {
  const text = value ?? "";
  const [draft, setDraft] = React.useState(text);
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  const [seen, setSeen] = React.useState(text);
  if (seen !== text && !busy) {
    setSeen(text);
    setDraft(text);
  }

  async function commit() {
    const next = draft.trim() === "" ? null : draft.trim();
    if (next === value) return;
    setBusy(true);
    setFailed(false);
    try {
      await onSave(next);
      setSeen(next ?? "");
    } catch {
      setDraft(text);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <input
      value={draft}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      // A long method name clips in its column; the full text is still here.
      title={draft || undefined}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={async () => {
        await commit();
        onDone?.();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(text);
          e.currentTarget.blur();
        }
      }}
      className={cn(
        "w-full rounded-md border border-transparent bg-transparent px-1.5 py-0.5",
        "transition-colors hover:border-border focus:border-ring focus:bg-background focus:outline-none",
        busy && "opacity-50",
        failed && "border-destructive text-destructive",
        disabled && "cursor-default hover:border-transparent",
        className
      )}
    />
  );
}

/**
 * For text that needs to wrap when you are reading it — a long list of foods
 * in a narrow phone column. An <input> would clip it, so this shows wrapped
 * text and only becomes a field once you tap it.
 */
export function EditWrapText({
  value,
  onSave,
  placeholder,
  emptyHint,
  className,
  disabled,
}: {
  value: string | null;
  onSave: (next: string | null) => Promise<void>;
  placeholder?: string;
  /** Shown on hover while the value is empty — says who fills it in. */
  emptyHint?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [editing, setEditing] = React.useState(false);

  if (editing && !disabled) {
    return (
      <EditText
        value={value}
        onSave={onSave}
        placeholder={placeholder}
        className={className}
        autoFocus
        onDone={() => setEditing(false)}
      />
    );
  }

  return (
    <span
      role={disabled ? undefined : "button"}
      tabIndex={disabled ? undefined : 0}
      title={!value ? emptyHint : undefined}
      onClick={() => !disabled && setEditing(true)}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditing(true);
        }
      }}
      className={cn(
        "block rounded-md border border-transparent px-1.5 py-0.5 text-left",
        !disabled &&
          "cursor-text transition-colors hover:border-border focus:border-ring focus:outline-none",
        className
      )}
    >
      {value || (
        <span className="italic opacity-60">{placeholder ?? "—"}</span>
      )}
    </span>
  );
}
