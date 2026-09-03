"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ago, shortDate, stamp, type VisitTime, type Visitor } from "@/lib/analytics";

/**
 * Guest analytics — everything known about one person, which is deliberately
 * not much: when they first arrived, when they were last here, what they
 * opened. No profile, no avatar. They followed a link; that is the whole
 * relationship.
 */
export function GuestDialog({
  guest,
  visits,
  onClose,
}: {
  guest: Visitor | null;
  visits: VisitTime[];
  onClose: () => void;
}) {
  if (!guest) return null;

  const mine = visits
    .filter((v) => v.email.toLowerCase() === guest.email.toLowerCase())
    .sort((a, b) => b.viewed_at.localeCompare(a.viewed_at));

  const byPath = new Map<string, number>();
  for (const v of mine) byPath.set(v.path, (byPath.get(v.path) ?? 0) + 1);
  const pages = [...byPath.entries()].sort((a, b) => b[1] - a[1]);

  const facts: [string, string][] = [
    ["Visits", guest.visits.toLocaleString("en-IN")],
    ["First seen", shortDate(guest.first_seen)],
    ["Last seen", ago(guest.last_seen)],
    ["Signed in with", guest.provider ?? "—"],
    ["Paid", guest.paid_at ? shortDate(guest.paid_at) : "no"],
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            Guest analytics
          </DialogTitle>
          <DialogDescription asChild>
            <div>
              <span className="block text-foreground">
                {guest.name ?? guest.email.split("@")[0]}
              </span>
              <span className="block break-all">{guest.email}</span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y py-4 sm:grid-cols-5">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 text-sm tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>

        {pages.length > 0 ? (
          <section className="space-y-1.5">
            <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
              Pages opened
            </h3>
            <ul className="divide-y rounded-lg border">
              {pages.map(([path, n]) => (
                <li
                  key={path}
                  className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-sm"
                >
                  <span className="truncate font-mono text-xs">{path}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {n}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="space-y-1.5">
          <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
            Every visit
          </h3>
          {mine.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
              Signed in, but hasn&apos;t opened a page yet.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {mine.map((v, i) => (
                <li
                  key={`${v.viewed_at}-${i}`}
                  className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-sm"
                >
                  <span className="tabular-nums">{stamp(v.viewed_at)}</span>
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {v.path}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
