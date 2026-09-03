"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Report } from "@/lib/data";
import { fmtDate } from "@/lib/derive";

/** Search box + report filter. Chips wrap rather than scroll sideways. */
export function DashboardControls({
  query,
  onQueryChange,
  reports,
  selectedReport,
  onSelectReport,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  reports: Report[];
  selectedReport: string | null; // taken_on, or null for "All"
  onSelectReport: (takenOn: string | null) => void;
}) {
  // Newest first — the report you most likely want is the recent one.
  const ordered = [...reports].sort((a, b) =>
    b.taken_on.localeCompare(a.taken_on)
  );
  const taken = ordered.filter((r) => !r.planned);
  // Scheduled visits sit at the end, oldest-first, so the next one to happen
  // reads left to right after the history.
  const planned = ordered.filter((r) => r.planned).reverse();

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search a marker — cholesterol, HbA1c, vitamin…"
          aria-label="Search markers"
          className="pl-9 pr-9"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>

      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filter by report"
      >
        <span className="text-xs text-muted-foreground">Reports:</span>
        <Chip
          active={selectedReport === null}
          onClick={() => onSelectReport(null)}
        >
          All
        </Chip>
        {taken.map((r) => (
          <Chip
            key={r.id}
            active={selectedReport === r.taken_on}
            onClick={() =>
              onSelectReport(selectedReport === r.taken_on ? null : r.taken_on)
            }
            title={r.lab ?? undefined}
          >
            {fmtDate(r.taken_on)}
          </Chip>
        ))}
        {/* Booked, not taken. Greyed and unclickable — there is nothing behind
            it to filter to, but it keeps the next test in view. */}
        {planned.map((r) => (
          <Chip
            key={r.id}
            active={false}
            disabled
            onClick={() => {}}
            title={`Scheduled — ${fmtDate(r.taken_on)}${
              r.notes ? ` · ${r.notes}` : ""
            }`}
          >
            {fmtDate(r.taken_on)}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  title,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-pressed={disabled ? undefined : active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        "focus-visible:outline-2 focus-visible:outline-ring/60",
        disabled
          ? "cursor-default border-dashed border-border/70 bg-transparent text-muted-foreground/60"
          : active
            ? "border-foreground bg-foreground text-background"
            : "border-border bg-card text-muted-foreground hover:border-ring/50 hover:text-foreground"
      )}
    >
      {children}
      {disabled ? (
        <span className="ml-1.5 opacity-70">scheduled</span>
      ) : null}
    </button>
  );
}
