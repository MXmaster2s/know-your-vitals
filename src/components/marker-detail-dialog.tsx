"use client";

import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
import { usePerson } from "@/components/person-provider";
import {
  getAllReports,
  getMeasurementsForMarker,
  type Marker,
  type Measurement,
  type PersonId,
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


/**
 * Chart `t` values are built from LOCAL midnight of `taken_on`, so read the
 * date back with local getters. Round-tripping through `toISOString()` (UTC)
 * shifts the date back a day in any UTC+ timezone.
 */
function isoFromChartTime(t: number): string {
  const d = new Date(t);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

interface ChartRow {
  t: number;
  [key: string]: number | string | null | undefined;
}

interface Fetched {
  measurements: Measurement[];
  labByReport: Map<string, string>;
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
        setFetched({ measurements, labByReport });
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

  // Merge both series into one time-keyed table so the tooltip sees one row.
  const rows = React.useMemo<ChartRow[]>(() => {
    if (!fetched) return [];
    const byTime = new Map<number, ChartRow>();
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
  }, [fetched, showOther]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                {/* Band comes from the CURRENT person's printed range; ranges
                    are sex-specific, so hide it when both series are shown. */}
                {banded && !showOther ? (
                  <ReferenceArea
                    y1={banded.ref_low != null ? Number(banded.ref_low) : yMin}
                    y2={banded.ref_high != null ? Number(banded.ref_high) : yMax}
                    fill="var(--chart-1)"
                    fillOpacity={0.08}
                    stroke="var(--chart-1)"
                    strokeOpacity={0.25}
                    strokeDasharray="4 4"
                  />
                ) : null}
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(t: number) => fmtDateShort(isoFromChartTime(t))}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  ticks={rows.map((r) => r.t)}
                />
                <YAxis
                  domain={[yMin, yMax]}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(v: number) => fmtValue(v)}
                />
                <Tooltip content={<TrendTooltip unitFallback={unit} />} />
                <Line
                  dataKey={personId}
                  name={labelFor(personId)}
                  type="monotone"
                  connectNulls
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--chart-1)", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
                {showOther && other ? (
                  <Line
                    dataKey={other}
                    name={labelFor(other)}
                    type="monotone"
                    connectNulls
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={{ r: 3, fill: "var(--chart-2)", strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                ) : null}
              </LineChart>
            </ResponsiveContainer>
          </div>
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

interface TooltipEntry {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: ChartRow;
}

function TrendTooltip({
  active,
  payload,
  label,
  unitFallback,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: number;
  unitFallback: string | null;
}) {
  if (!active || !payload || payload.length === 0 || label == null) return null;
  const iso = isoFromChartTime(label);
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-popover-foreground">{fmtDate(iso)}</p>
      {payload.map((entry) => {
        const key = String(entry.dataKey);
        const row = entry.payload;
        const lab = row?.[`${key}_lab`] as string | null | undefined;
        const unit = (row?.[`${key}_unit`] as string | null | undefined) ?? unitFallback;
        const flag = row?.[`${key}_flag`] as string | null | undefined;
        return (
          <p key={key} className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="inline-block size-2 rounded-full"
              style={{ background: entry.color }}
              aria-hidden
            />
            <span className="text-popover-foreground">{entry.name}</span>
            <span className="tabular-nums text-popover-foreground">
              {fmtValue(entry.value ?? "")}
              {unit ? ` ${unit}` : ""}
            </span>
            {flag ? <span className="font-medium text-attention">{flag}</span> : null}
            {lab ? <span>· {lab}</span> : null}
          </p>
        );
      })}
    </div>
  );
}
