"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import * as React from "react";
import { Download } from "lucide-react";
import { signedReportUrl } from "@/lib/data";
import { ago, setAnalysed, shortDate, stamp, type Upload, type VisitTime, type Visitor } from "@/lib/analytics";

/**
 * Guest analytics — everything known about one person, which is deliberately
 * not much: when they first arrived, when they were last here, what they
 * opened. No profile, no avatar. They followed a link; that is the whole
 * relationship.
 */
export function GuestDialog({
  guest,
  visits,
  uploads,
  onClose,
  onChanged,
}: {
  guest: Visitor | null;
  visits: VisitTime[];
  uploads: Upload[];
  onClose: () => void;
  /** Refetch after marking a report read, so the pill updates. */
  onChanged: () => void;
}) {
  if (!guest) return null;

  const mine = visits
    .filter((v) => v.email.toLowerCase() === guest.email.toLowerCase())
    .sort((a, b) => b.viewed_at.localeCompare(a.viewed_at));

  const byPath = new Map<string, number>();
  for (const v of mine) byPath.set(v.path, (byPath.get(v.path) ?? 0) + 1);
  const pages = [...byPath.entries()].sort((a, b) => b[1] - a[1]);

  const files = uploads
    .filter((u) => u.email === guest.email.toLowerCase())
    .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));

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

        {files.length > 0 ? (
          <section className="space-y-1.5">
            <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
              Reports uploaded
            </h3>
            <ul className="divide-y rounded-lg border">
              {files.map((f) => (
                <li key={f.path} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{f.file_name}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {shortDate(f.uploaded_at)}
                    {f.size_bytes
                      ? ` · ${(f.size_bytes / 1024).toLocaleString("en-IN", { maximumFractionDigits: 0 })} KB`
                      : ""}
                  </span>
                  <AnalysedToggle
                    path={f.path}
                    done={f.analysed_at !== null}
                    onChanged={onChanged}
                  />
                  <DownloadLink path={f.path} name={f.file_name} />
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

/** Links are minted on demand and expire in an hour — a listing page should
 *  not carry a pile of live download URLs in its markup. */
function DownloadLink({ path, name }: { path: string; name: string }) {
  const [busy, setBusy] = React.useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={`Download ${name}`}
      title="Download"
      onClick={async () => {
        setBusy(true);
        try {
          const url = await signedReportUrl(path);
          window.open(url, "_blank", "noopener,noreferrer");
        } finally {
          setBusy(false);
        }
      }}
      className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
    >
      <Download className="size-3.5" aria-hidden />
    </button>
  );
}

/**
 * Marks one report read. This is what turns a guest's pill from "analysing"
 * to "Analysed", so it lives next to the file rather than somewhere abstract.
 */
function AnalysedToggle({
  path,
  done,
  onChanged,
}: {
  path: string;
  done: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      title={done ? "Mark as not analysed" : "Mark as analysed"}
      aria-pressed={done}
      onClick={async () => {
        setBusy(true);
        try {
          await setAnalysed(path, !done);
          onChanged();
        } finally {
          setBusy(false);
        }
      }}
      className={
        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider transition-colors disabled:opacity-50 " +
        (done
          ? "border-positive/40 bg-positive/10 text-positive"
          : "text-muted-foreground hover:border-ring/60 hover:text-foreground")
      }
    >
      {done ? "Analysed" : "Mark analysed"}
    </button>
  );
}
