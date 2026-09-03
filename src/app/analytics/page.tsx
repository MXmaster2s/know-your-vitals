"use client";

import * as React from "react";
import { ModuleHeading } from "@/components/nutrition/module-heading";
import { RibbonAxis, VisitRibbon } from "@/components/analytics/visit-ribbon";
import { Skeleton } from "@/components/ui/skeleton";
import { usePerson } from "@/components/person-provider";
import {
  ago,
  getPageTotals,
  getVisitTimes,
  getVisitors,
  shortDate,
  type PageTotal,
  type VisitTime,
  type Visitor,
} from "@/lib/analytics";

export default function AnalyticsPage() {
  const { personId, canEdit } = usePerson();
  const allowed = canEdit(personId);
  const [data, setData] = React.useState<{
    visitors: Visitor[];
    times: VisitTime[];
    pages: PageTotal[];
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([getVisitors(), getVisitTimes(), getPageTotals()])
      .then(([visitors, times, pages]) => {
        if (!cancelled) setData({ visitors, times, pages });
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!allowed) {
    return (
      <p className="rounded-xl border border-dashed bg-card/50 px-4 py-10 text-center text-sm text-muted-foreground">
        Analytics is for whoever keeps these records. Turn on the pencil if that
        is you.
      </p>
    );
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Couldn&apos;t load analytics: {error}
      </p>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  const stamps = data.times.map((t) => new Date(t.viewed_at).getTime());
  const now = Date.now();
  // A single visit would give a zero-width axis; a day of context fixes that.
  const from = stamps.length ? Math.min(...stamps) : now - 86400000;
  const to = Math.max(now, ...stamps);

  const byEmail = new Map<string, number[]>();
  for (const t of data.times) {
    const k = t.email.toLowerCase();
    const list = byEmail.get(k);
    const ms = new Date(t.viewed_at).getTime();
    if (list) list.push(ms);
    else byEmail.set(k, [ms]);
  }

  const day = data.times.filter(
    (t) => now - new Date(t.viewed_at).getTime() < 86400000
  ).length;

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-2xl">Analytics</h1>

      <section className="space-y-2">
        <ModuleHeading>Arrivals</ModuleHeading>
        {data.times.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
            No one has opened the link yet. Share it and arrivals show up here.
          </p>
        ) : (
          <>
            <VisitRibbon
              times={stamps}
              from={from}
              to={to}
              tone="loud"
              className="h-12"
            />
            <RibbonAxis from={from} to={to} />
            <p className="pt-1 text-sm tabular-nums text-muted-foreground">
              {data.times.length.toLocaleString("en-IN")} visits from{" "}
              {byEmail.size} {byEmail.size === 1 ? "person" : "people"} ·{" "}
              {day} in the last 24 hours
            </p>
          </>
        )}
      </section>

      <section className="space-y-2">
        <ModuleHeading>Who</ModuleHeading>
        <ul className="divide-y rounded-xl border bg-card">
          {data.visitors.map((v) => {
            const mine = byEmail.get(v.email.toLowerCase()) ?? [];
            return (
              <li key={v.email} className="space-y-1.5 px-3 py-3 sm:px-4">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-serif text-base">
                    {v.name ?? v.email.split("@")[0]}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {v.email}
                    {v.provider ? ` · ${v.provider}` : null}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums">
                    {v.visits.toLocaleString("en-IN")}{" "}
                    {v.visits === 1 ? "visit" : "visits"}
                  </span>
                </div>

                <VisitRibbon
                  times={mine}
                  from={from}
                  to={to}
                  className="h-5"
                />

                <p className="text-[11px] tabular-nums text-muted-foreground">
                  first seen {shortDate(v.first_seen)} · last {ago(v.last_seen)}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      {data.pages.length > 0 ? (
        <section className="space-y-2">
          <ModuleHeading>Pages</ModuleHeading>
          <ul className="divide-y rounded-xl border bg-card">
            {data.pages.map((p) => (
              <li
                key={p.path}
                className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm sm:px-4"
              >
                <span className="truncate font-mono text-xs">{p.path}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {p.views.toLocaleString("en-IN")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
