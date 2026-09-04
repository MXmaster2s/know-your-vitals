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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Measurement } from "@/lib/data";
import { fmtDate, fmtDateShort, fmtValue } from "@/lib/derive";

export interface ChartRow {
  t: number;
  [key: string]: number | string | null | undefined;
}

/**
 * One marker over time, on an axis of EVERY visit the person has had — not
 * only the visits where this marker was measured. Labs do not run the same
 * panel each time; a marker missing from a report shows as a gap on a fixed
 * axis rather than quietly vanishing and making the remaining points look
 * adjacent. Tapping the chart opens the same numbers as a table, because
 * hover tooltips are unreliable on a phone.
 */
export function TrendChart({
  title,
  rows,
  axisDates,
  personId,
  other,
  banded,
  yMin,
  yMax,
  unit,
  labelFor,
}: {
  title: string;
  rows: ChartRow[];
  axisDates: number[];
  personId: string;
  /** The compared person, when the comparison is on. */
  other: string | null;
  /** The reading whose printed range draws the band; null hides the band. */
  banded: Measurement | null;
  yMin: number;
  yMax: number;
  unit: string | null;
  labelFor: (id: string | null) => string;
}) {
  const [tableOpen, setTableOpen] = React.useState(false);
  const showOther = other !== null;

  return (
    <>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={rows}
                margin={{ top: 14, right: 12, bottom: 0, left: 0 }}
                onClick={() => setTableOpen(true)}
                style={{ cursor: "pointer" }}
              >
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                {/* Band comes from the CURRENT person's printed range; ranges
                    are sex-specific, so hide it when both series are shown. */}
                {banded ? (
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
                  type="category"
                  tickFormatter={(t: number) => fmtDateShort(isoFromChartTime(t))}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickLine={{ stroke: "var(--border)" }}
                  axisLine={{ stroke: "var(--border)" }}
                  interval={0}
                  padding={{ left: 12, right: 12 }}
                />
                <YAxis
                  domain={[yMin, yMax]}
                  tick={{ fill: "var(--foreground)", fontSize: 11, opacity: 0.8 }}
                  tickLine={{ stroke: "var(--border)" }}
                  axisLine={{ stroke: "var(--border)" }}
                  width={56}
                  tickFormatter={(v: number) => fmtValue(v)}
                />
                <Tooltip content={<TrendTooltip unitFallback={unit} />} />
                <Line
                  dataKey={personId}
                  name={labelFor(personId)}
                  type="monotone"
                  connectNulls={false}
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--chart-1)", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
                {other ? (
                  <Line
                    dataKey={other}
                    name={labelFor(other)}
                    type="monotone"
                    connectNulls={false}
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
      {rows.length > 0 ? (
        <p className="-mt-1 text-[11px] text-muted-foreground/70">
          {unit ? `Values in ${unit} · ` : ""}Tap the chart for the numbers as a table.
        </p>
      ) : null}

        {tableOpen ? (
          <Dialog open onOpenChange={(o) => !o && setTableOpen(false)}>
            <DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-sm">
              <DialogHeader className="text-left">
                <DialogTitle className="font-serif text-lg">
                  {title}
                </DialogTitle>
                <DialogDescription>
                  Every visit. A dash means this was not measured that day.
                </DialogDescription>
              </DialogHeader>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="border-b py-1.5 pr-3 text-left font-normal">Date</th>
                    <th className="border-b py-1.5 text-right font-normal">
                      {labelFor(personId)}
                    </th>
                    {showOther && other ? (
                      <th className="border-b py-1.5 pl-3 text-right font-normal">
                        {labelFor(other)}
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const cell = (id: string) => {
                      const v = r[id];
                      if (typeof v !== "number") return <span className="text-muted-foreground/60">—</span>;
                      const flag = r[`${id}_flag`];
                      return (
                        <span className={flag ? "text-attention" : undefined}>
                          {fmtValue(v)}
                          {flag ? <span className="ml-1 text-[10px]">{String(flag)}</span> : null}
                        </span>
                      );
                    };
                    return (
                      <tr key={r.t}>
                        <td className="border-b py-1.5 pr-3 tabular-nums text-muted-foreground">
                          {fmtDate(isoFromChartTime(r.t))}
                        </td>
                        <td className="border-b py-1.5 text-right tabular-nums">{cell(personId)}</td>
                        {showOther && other ? (
                          <td className="border-b py-1.5 pl-3 text-right tabular-nums">{cell(other)}</td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {unit ? (
                <p className="text-[11px] text-muted-foreground">Values in {unit}.</p>
              ) : null}
            </DialogContent>
          </Dialog>
        ) : null}

    </>
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

/**
 * Chart `t` values are built from LOCAL midnight of `taken_on`, so read the
 * date back with local getters. Round-tripping through `toISOString()` (UTC)
 * shifts the date back a day in any UTC+ timezone.
 */
export function isoFromChartTime(t: number): string {
  const d = new Date(t);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
