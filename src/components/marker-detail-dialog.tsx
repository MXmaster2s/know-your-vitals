"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendChart, type ChartRow } from "@/components/trend-chart";
import { usePerson } from "@/components/person-provider";
import {
  getAllReports,
  getMeasurementsForMarker,
  type Marker,
  type Measurement,
  type PersonId,
  type Report,
} from "@/lib/data";
import {
  buildMarkerCopy,
  effectiveFlag,
  fmtDate,
  fmtDateShort,
  fmtRange,
  fmtValue,
  seriesByMarker,
  trendSummary,
} from "@/lib/derive";




interface Fetched {
  measurements: Measurement[];
  labByReport: Map<string, string>;
  /** Every visit, including ones where this marker was not measured — the
   *  axis is built from these, not from the readings. */
  reports: Report[];
}

/**
 * Full trend for one marker, in a dialog (static-export-safe: pure client
 * state, no routes). Shows the printed ref range as a band, per-point lab in
 * the tooltip, and a two-person comparison toggle when both have data.
 */
export function MarkerDetailDialog({
  marker,
  personId,
  onClose,
}: {
  marker: Marker | null;
  personId: PersonId;
  onClose: () => void;
}) {
  const [fetched, setFetched] = React.useState<Fetched | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [compare, setCompare] = React.useState(false);

  const markerId = marker?.id ?? null;

  // Reset synchronously when the marker changes (render-time state adjustment
  // — avoids a setState-in-effect cascade).
  const [lastMarkerId, setLastMarkerId] = React.useState(markerId);
  if (lastMarkerId !== markerId) {
    setLastMarkerId(markerId);
    setFetched(null);
    setError(null);
    setCompare(false);
  }

  React.useEffect(() => {
    if (!markerId) return;
    let cancelled = false;
    Promise.all([getMeasurementsForMarker(markerId), getAllReports()])
      .then(([measurements, reports]) => {
        if (cancelled) return;
        const labByReport = new Map<string, string>();
        for (const r of reports) if (r.lab) labByReport.set(r.id, r.lab);
        setFetched({ measurements, labByReport, reports });
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [markerId]);

  const { people, labelFor } = usePerson();
  // "the other person" = the next one in the roster. Comparison only makes
  // sense for a two-person vault; with more, it pairs with the next entry.
  const otherId = React.useMemo(() => {
    if (people.length < 2) return null;
    const i = people.findIndex((p) => p.id === personId);
    return people[(i + 1) % people.length]?.id ?? null;
  }, [people, personId]);
  const other = otherId;
  const mine = fetched?.measurements.filter((m) => m.person_id === personId) ?? [];
  const theirs = fetched?.measurements.filter((m) => m.person_id === other) ?? [];
  const canCompare = mine.length > 0 && theirs.length > 0;
  const showOther = compare && canCompare && other !== null;

  // The axis is every visit the person has had — not every visit where THIS
  // marker happened to be measured. Labs do not run the same panel each time,
  // so a marker missing from a report shows as a gap on a fixed axis rather
  // than quietly vanishing and making the remaining points look adjacent.
  const axisDates = React.useMemo<number[]>(() => {
    if (!fetched) return [];
    const ids = new Set<string>([personId]);
    if (showOther && other) ids.add(other);
    const set = new Set<number>();
    for (const r of fetched.reports) {
      if (!ids.has(r.person_id) || r.planned) continue;
      set.add(new Date(`${r.taken_on}T00:00:00`).getTime());
    }
    return [...set].sort((a, b) => a - b);
  }, [fetched, personId, showOther, other]);

  const rows = React.useMemo<ChartRow[]>(() => {
    if (!fetched) return [];
    const byTime = new Map<number, ChartRow>();
    for (const t of axisDates) byTime.set(t, { t });
    const visible = showOther ? fetched.measurements : mine;
    for (const m of visible) {
      const t = new Date(`${m.taken_on}T00:00:00`).getTime();
      const row = byTime.get(t) ?? { t };
      row[m.person_id] = Number(m.value);
      row[`${m.person_id}_lab`] = fetched.labByReport.get(m.report_id) ?? null;
      row[`${m.person_id}_unit`] = m.unit;
      row[`${m.person_id}_flag`] = effectiveFlag(m);
      byTime.set(t, row);
    }
    return [...byTime.values()].sort((a, b) => a.t - b.t);
  }, [fetched, showOther, axisDates]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ref-range band from the latest of MY measurements that printed a range.
  const banded = [...mine].reverse().find((m) => m.ref_low != null || m.ref_high != null);
  const latest = mine.length > 0 ? mine[mine.length - 1] : null;

  const [yMin, yMax] = React.useMemo(() => {
    const values: number[] = [];
    for (const m of showOther ? [...mine, ...theirs] : mine) values.push(Number(m.value));
    if (banded?.ref_low != null) values.push(Number(banded.ref_low));
    if (banded?.ref_high != null) values.push(Number(banded.ref_high));
    if (values.length === 0) return [0, 1];
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const pad = (hi - lo || Math.abs(hi) || 1) * 0.12;
    return [Math.max(0, lo - pad), hi + pad];
  }, [fetched, showOther]); // eslint-disable-line react-hooks/exhaustive-deps

  const unit = latest?.unit ?? marker?.unit ?? null;

  // Single-person series drives the narration and the copy payload.
  const ownSeries = React.useMemo(() => {
    if (!marker || !fetched) return null;
    const mine = fetched.measurements.filter((m) => m.person_id === personId);
    return seriesByMarker([marker], mine)[0] ?? null;
  }, [marker, fetched, personId]);

  const labByDate = React.useMemo(() => {
    const out = new Map<string, string>();
    if (!fetched) return out;
    for (const m of fetched.measurements) {
      if (m.person_id !== personId) continue;
      const lab = fetched.labByReport.get(m.report_id);
      if (lab) out.set(m.taken_on, lab);
    }
    return out;
  }, [fetched, personId]);

  return (
    <Dialog open={marker !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg gap-5">
        <DialogHeader className="text-left">
          <DialogTitle className="pr-8 font-serif text-xl">
            {marker?.name ?? marker?.id}
          </DialogTitle>
          {marker?.description ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {marker.description}
            </p>
          ) : null}
          <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {latest ? (
              <>
                <span className="text-foreground">
                  <span className="text-lg font-medium tabular-nums">
                    {fmtValue(latest.value)}
                  </span>
                  {unit ? <span className="text-muted-foreground"> {unit}</span> : null}
                </span>
                {effectiveFlag(latest) ? (
                  <Badge variant="destructive">{effectiveFlag(latest)}</Badge>
                ) : null}
                <span>{fmtDate(latest.taken_on)}</span>
                {banded && fmtRange(banded) ? <span>Range {fmtRange(banded)}</span> : null}
              </>
            ) : (
              <span>No readings for {labelFor(personId)} yet.</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            Couldn&apos;t load the trend: {error}
          </p>
        ) : !fetched ? (
          <Skeleton className="h-64 w-full" />
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No readings yet.
          </p>
        ) : (
          <TrendChart
            title={marker?.name ?? marker?.id ?? ""}
            rows={rows}
            axisDates={axisDates}
            personId={personId}
            other={showOther && other ? other : null}
            banded={showOther ? null : (banded ?? null)}
            yMin={yMin}
            yMax={yMax}
            unit={unit}
            labelFor={labelFor}
          />
        )}

        {ownSeries && !compare ? (
          <p className="-mt-2 text-xs leading-relaxed text-muted-foreground">
            {trendSummary(ownSeries)}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          {canCompare ? (
            <Button
              variant={compare ? "default" : "outline"}
              size="sm"
              onClick={() => setCompare((c) => !c)}
            >
              {compare ? "Hide" : "Compare with"} {labelFor(other)}
            </Button>
          ) : (
            <span />
          )}

          <span className="flex items-center gap-3">
            {canCompare && compare ? (
              <span className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded bg-chart-1" />{" "}
                  {labelFor(personId)}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded bg-chart-2" />{" "}
                  {labelFor(other)}
                </span>
              </span>
            ) : null}
            {ownSeries ? (
              <CopyButton
                label={`Copy ${marker?.name ?? "marker"} data`}
                getText={() =>
                  buildMarkerCopy(ownSeries, labelFor(personId), labByDate)
                }
              />
            ) : null}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
