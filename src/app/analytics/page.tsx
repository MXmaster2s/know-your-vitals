"use client";

import * as React from "react";
import { GuestDialog } from "@/components/analytics/guest-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { usePerson } from "@/components/person-provider";
import { cn } from "@/lib/utils";
import {
  getVisitTimes,
  getVisitors,
  stamp,
  type VisitTime,
  type Visitor,
} from "@/lib/analytics";

/** Someone who has paid. The one distinction worth drawing in this table. */
function PaidPill() {
  return (
    <span className="rounded-full border border-positive/40 bg-positive/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-positive">
      Paid user
    </span>
  );
}

export default function AnalyticsPage() {
  const { personId, canEdit } = usePerson();
  const allowed = canEdit(personId);
  const [data, setData] = React.useState<{
    visitors: Visitor[];
    visits: VisitTime[];
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState<Visitor | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([getVisitors(), getVisitTimes()])
      .then(([visitors, visits]) => {
        if (!cancelled) setData({ visitors, visits });
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
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl">Analytics</h1>

      {data.visitors.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card/50 px-4 py-10 text-center text-sm text-muted-foreground">
          No one has opened the link yet. Share it and visitors show up here.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <th
                  scope="col"
                  className="w-[7.5rem] border-b border-r px-3 py-2 font-normal sm:w-40"
                >
                  Last visit
                </th>
                <th scope="col" className="border-b px-3 py-2 font-normal">
                  Guest
                </th>
              </tr>
            </thead>
            <tbody>
              {data.visitors.map((v, i) => {
                const last = i === data.visitors.length - 1;
                const openGuest = () => setOpen(v);
                return (
                  <tr
                    key={v.email}
                    role="button"
                    tabIndex={0}
                    aria-label={`Guest analytics for ${v.name ?? v.email}`}
                    onClick={openGuest}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openGuest();
                      }
                    }}
                    className={cn(
                      "cursor-pointer align-top transition-colors",
                      "hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                    )}
                  >
                    <td
                      className={cn(
                        "border-r px-3 py-3 text-sm tabular-nums text-muted-foreground",
                        !last && "border-b"
                      )}
                    >
                      {stamp(v.last_seen)}
                    </td>
                    <td className={cn("px-3 py-3", !last && "border-b")}>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-serif text-base leading-tight">
                          {v.name ?? v.email.split("@")[0]}
                        </span>
                        {v.paid_at ? <PaidPill /> : null}
                      </span>
                      <span className="mt-0.5 block break-all text-xs text-muted-foreground">
                        {v.email}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <GuestDialog
        guest={open}
        visits={data.visits}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}
