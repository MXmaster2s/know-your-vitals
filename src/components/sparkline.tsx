"use client";

import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import type { Measurement } from "@/lib/data";

/** Tiny inline trend line: no axes, no tooltip, just the shape. */
export function Sparkline({
  points,
  flagged,
}: {
  points: Measurement[];
  flagged: boolean;
}) {
  if (points.length < 2) {
    return <div className="h-8" aria-hidden />;
  }
  const data = points.map((p) => ({
    t: new Date(`${p.taken_on}T00:00:00`).getTime(),
    value: Number(p.value),
  }));
  return (
    <div className="h-8 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line
            dataKey="value"
            type="monotone"
            dot={false}
            isAnimationActive={false}
            strokeWidth={1.5}
            stroke={flagged ? "var(--attention)" : "var(--muted-foreground)"}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
