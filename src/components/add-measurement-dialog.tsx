"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addMeasurement, type Marker, type PersonId } from "@/lib/data";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/derive";
import type { MarkerCategory } from "@/lib/data";

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Manual entry: marker + date + value → insert (ad-hoc "manual" report). */
export function AddMeasurementDialog({
  markers,
  personId,
  personLabel,
  onAdded,
}: {
  markers: Marker[];
  personId: PersonId;
  personLabel: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [markerId, setMarkerId] = React.useState<string>("");
  const [date, setDate] = React.useState(todayIso);
  const [value, setValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const marker = markers.find((m) => m.id === markerId) ?? null;

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    markers: markers.filter(
      (m) => ((m.category ?? "other") as MarkerCategory) === category
    ),
  })).filter((g) => g.markers.length > 0);

  function reset() {
    setMarkerId("");
    setDate(todayIso());
    setValue("");
    setError(null);
    setBusy(false);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numeric = Number(value);
    if (!markerId || !date || !Number.isFinite(numeric)) {
      setError("Pick a marker, a date, and a numeric value.");
      return;
    }
    if (numeric < 0) {
      setError("Value can't be negative.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addMeasurement({
        person_id: personId,
        marker_id: markerId,
        taken_on: date,
        value: numeric,
        unit: marker?.unit ?? null,
      });
      onAdded();
      setOpen(false);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="cursor-pointer">
          <Plus aria-hidden /> Add
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader className="text-left">
          <DialogTitle className="font-serif text-xl">Add a reading</DialogTitle>
          <DialogDescription>
            Saved for {personLabel} under a &ldquo;manual&rdquo; report for that
            date.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="add-marker">Marker</Label>
            <Select value={markerId} onValueChange={setMarkerId}>
              <SelectTrigger id="add-marker" className="w-full">
                <SelectValue placeholder="Choose a marker" />
              </SelectTrigger>
              <SelectContent>
                {grouped.map((g) => (
                  <SelectGroup key={g.category}>
                    <SelectLabel>{CATEGORY_LABEL[g.category]}</SelectLabel>
                    {g.markers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name ?? m.id}
                        {m.unit ? ` (${m.unit})` : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-date">Date</Label>
            <Input
              id="add-date"
              type="date"
              required
              max={todayIso()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-value">
              Value{marker?.unit ? ` (${marker.unit})` : ""}
            </Label>
            <Input
              id="add-value"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Saving…" : "Save reading"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
