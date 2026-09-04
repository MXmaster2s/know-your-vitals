"use client";

import * as React from "react";
import { FileText, Upload, X } from "lucide-react";
import Link from "next/link";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "@/components/auth-provider";
import {
  REPORT_MAX_BYTES,
  deleteReport,
  getMyStatus,
  getMyUploads,
  getSlots,
  uploadReport,
  type ReportUpload,
  type Slots,
} from "@/lib/data";
import { cn } from "@/lib/utils";

const CHECKOUT_URL = process.env.NEXT_PUBLIC_CHECKOUT_URL;

type Rejection = { name: string; reason: "type" | "size" };

function vet(list: File[]): { ok: File[]; bad: Rejection[] } {
  const ok: File[] = [];
  const bad: Rejection[] = [];
  for (const f of list) {
    const isPdf =
      f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) bad.push({ name: f.name, reason: "type" });
    else if (f.size > REPORT_MAX_BYTES) bad.push({ name: f.name, reason: "size" });
    else ok.push(f);
  }
  return { ok, bad };
}

/**
 * The first screen for anyone with nothing in the app yet. An empty screen is
 * an invitation, so it asks for the one thing that starts everything.
 *
 * Files really do go somewhere — a private bucket, under the uploader's own
 * folder — and what happens after is said in words rather than implied by a
 * spinner: the next step is access, then the reports get read.
 */
export function UploadReports({
  title = "Find hidden trends in your blood tests",
  blurb,
  variant = "hero",
}: {
  title?: string;
  /** Replaces the default line under the title; the Preview demo link is
   *  part of the default and goes with it. */
  blurb?: React.ReactNode;
  /** "hero" is the whole screen for someone with nothing yet. "section" is
   *  the quieter version that sits at the foot of a page that already has
   *  something on it, so more reports can be added at any time. */
  variant?: "hero" | "section";
}) {
  const section = variant === "section";
  const { session } = useSession();
  const [queued, setQueued] = React.useState<File[]>([]);
  const [rejected, setRejected] = React.useState<Rejection[] | null>(null);
  const [done, setDone] = React.useState<ReportUpload[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [over, setOver] = React.useState(false);
  const [slots, setSlots] = React.useState<Slots | null>(null);
  const [mine, setMine] = React.useState<ReportUpload[] | null>(null);
  const [removing, setRemoving] = React.useState<string | null>(null);
  const [paid, setPaid] = React.useState(false);

  React.useEffect(() => {
    getSlots().then(setSlots).catch(() => {});
    getMyUploads().then(setMine).catch(() => setMine([]));
    getMyStatus().then((s) => setPaid(s.paid)).catch(() => {});
  }, []);

  const add = (list: FileList | null) => {
    if (!list) return;
    const { ok, bad } = vet(Array.from(list));
    if (bad.length) {
      setRejected(bad);
      posthog.capture("upload_rejected", {
        count: bad.length,
        by_type: bad.filter((b) => b.reason === "type").length,
        by_size: bad.filter((b) => b.reason === "size").length,
      });
    }
    if (ok.length) setQueued((prev) => [...prev, ...ok]);
  };

  const submit = async () => {
    const user = session?.user;
    if (!user?.email || queued.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const out: ReportUpload[] = [];
      for (const f of queued) {
        out.push(await uploadReport(f, { id: user.id, email: user.email }));
      }
      setQueued([]);
      setDone(out);
      setMine((prev) => [...out, ...(prev ?? [])]);
      posthog.capture("upload_succeeded", { count: out.length });
      posthog.capture("payment_prompt_shown", { after_upload: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-6",
        section
          ? "items-stretch border-t pt-8 text-left"
          : "mx-auto max-w-xl items-center py-12 text-center sm:py-20"
      )}
    >
      <div className="space-y-2">
        <h1
          className={cn(
            "font-serif leading-tight",
            section ? "text-lg" : "text-2xl sm:text-3xl"
          )}
        >
          {section ? "Add more reports" : title}
        </h1>
        <p className={cn("text-muted-foreground", section ? "text-xs" : "text-sm")}>
          {blurb ??
            (section ? (
              "Every report you add makes the trends longer and more useful."
            ) : (
            <>
              Analyse your past blood reports to make your personalised health
              dashboard.{" "}
              <Link
                href="/preview"
                className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
              >
                Preview demo
              </Link>{" "}
              to see how it will look.
            </>
            ))}
        </p>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed px-6 transition-colors",
          section ? "py-8" : "py-14",
          over
            ? "border-foreground bg-muted/60"
            : "border-border bg-card/40 hover:border-ring/60 hover:bg-card/70"
        )}
      >
        <Upload className="size-6 text-muted-foreground" strokeWidth={1.5} aria-hidden />
        <span className="text-sm">
          <span className="underline decoration-border underline-offset-4">
            Choose your reports
          </span>{" "}
          <span className="text-muted-foreground">or drop them here</span>
        </span>
        <span className="text-[11px] text-muted-foreground/70">
          PDF only, up to 5 MB each
        </span>
        <input
          type="file"
          multiple
          accept="application/pdf"
          className="sr-only"
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {queued.length > 0 ? (
        <div className="w-full space-y-3 text-left">
          <ul className="divide-y rounded-xl border bg-card">
            {queued.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-3 px-3 py-2.5">
                <FileText className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {(f.size / 1024).toLocaleString("en-IN", { maximumFractionDigits: 0 })} KB
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  disabled={busy}
                  onClick={() => setQueued((prev) => prev.filter((_, j) => j !== i))}
                  className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
          <Button className="w-full cursor-pointer" disabled={busy} onClick={submit}>
            {busy
              ? "Uploading…"
              : `Upload ${queued.length} ${queued.length === 1 ? "report" : "reports"}`}
          </Button>
        </div>
      ) : null}

      {mine && mine.length > 0 ? (
        <MyReports
          uploads={mine}
          paid={paid}
          removing={removing}
          onDelete={async (u) => {
            setRemoving(u.path);
            setError(null);
            try {
              await deleteReport(u.path);
              setMine((prev) => (prev ?? []).filter((x) => x.path !== u.path));
              posthog.capture("upload_deleted");
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setRemoving(null);
            }
          }}
        />
      ) : null}

      {slots && !section ? <SlotsLeft slots={slots} /> : null}

      {!section ? (
        <Button asChild variant="outline" className="cursor-pointer">
          <Link href="/learnmore">Learn more</Link>
        </Button>
      ) : null}

      {/* Turned away — say exactly why, and which ones. */}
      {rejected ? (
        <Dialog open onOpenChange={(o) => !o && setRejected(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">
                Only PDFs, up to 5 MB each
              </DialogTitle>
              <DialogDescription>
                {rejected.length === 1 ? "This one" : "These"} didn&apos;t go in.
              </DialogDescription>
            </DialogHeader>
            <ul className="divide-y rounded-lg border text-sm">
              {rejected.map((r, i) => (
                <li key={`${r.name}-${i}`} className="flex items-baseline justify-between gap-3 px-3 py-2">
                  <span className="min-w-0 truncate">{r.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {r.reason === "type" ? "not a PDF" : "over 5 MB"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Most labs email a PDF. If yours sent a photo, a scan-to-PDF app
              on your phone turns it into one.
            </p>
          </DialogContent>
        </Dialog>
      ) : null}

      {/* In — and the next step, without a number. The checkout carries the
          right price for the country; quoting one here would be wrong for
          most people who read it. */}
      {done ? (
        <Dialog open onOpenChange={(o) => !o && setDone(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">
                {done.length === 1 ? "Report received" : `${done.length} reports received`}
              </DialogTitle>
              <DialogDescription>
                They are in, safely, under your account. The next step is
                access — once that is done, they get read and your dashboard is
                built from what is in them.
              </DialogDescription>
            </DialogHeader>
            {CHECKOUT_URL ? (
              <Button asChild className="cursor-pointer">
                <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer">
                  Get access
                </a>
              </Button>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Already have access? Nothing more to do — you will get an email
              when your dashboard is ready.
            </p>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

/**
 * What is already here. Sits under the dropzone because the dropzone is the
 * invitation and this is the record of having accepted it. Deleting really
 * deletes — the file leaves the server, not just the list — so the row says
 * so rather than leaving someone to wonder.
 */
export function MyReports({
  uploads,
  paid,
  removing,
  onDelete,
}: {
  uploads: ReportUpload[];
  /** Whether this account has paid — decides between the first two states. */
  paid: boolean;
  removing: string | null;
  onDelete: (u: ReportUpload) => void;
}) {
  return (
    <section className="w-full space-y-2 text-left">
      <h2 className="px-1 text-[11px] uppercase tracking-wider text-muted-foreground/70">
        Your reports
      </h2>
      <ul className="divide-y rounded-xl border bg-card">
        {uploads.map((u) => (
          <li key={u.path} className="flex items-center gap-3 px-3 py-2.5">
            <FileText className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm">
              {u.file_name}
              <span className="block text-[11px] tabular-nums text-muted-foreground">
                {new Date(u.uploaded_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
                {u.size_bytes
                  ? ` · ${(u.size_bytes / 1024).toLocaleString("en-IN", { maximumFractionDigits: 0 })} KB`
                  : ""}
              </span>
            </span>
            <StatusPill upload={u} paid={paid} />
            <button
              type="button"
              disabled={removing === u.path}
              aria-label={`Delete ${u.file_name}`}
              title="Delete this report"
              onClick={() => onDelete(u)}
              className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <p className="px-1 text-[11px] text-muted-foreground">
        Deleting a report removes the file from the server as well.
      </p>
    </section>
  );
}

/**
 * Where one report has got to. Only three things can be true of it, and the
 * first one is a way out rather than a label: nothing happens to a report
 * until there is access, so that state is the button that gets it.
 */
function StatusPill({ upload, paid }: { upload: ReportUpload; paid: boolean }) {
  const base =
    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider";

  if (upload.analysed_at) {
    return (
      <span className={cn(base, "border-positive/40 bg-positive/10 text-positive")}>
        Analysed
      </span>
    );
  }
  if (paid) {
    return (
      <span className={cn(base, "text-muted-foreground")}>Paid · analysing</span>
    );
  }
  if (!CHECKOUT_URL) {
    return <span className={cn(base, "text-muted-foreground")}>Not analysed</span>;
  }
  return (
    <a
      href={CHECKOUT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        base,
        "border-foreground/30 transition-colors hover:border-foreground hover:bg-muted"
      )}
    >
      Get analysed
    </a>
  );
}

/**
 * How many of the places are taken, as twenty marks rather than a fraction —
 * you can see the shape of "most are gone" or "plenty left" before reading.
 */
export function SlotsLeft({ slots }: { slots: Slots }) {
  const total = Math.max(slots.total, 1);
  const served = Math.min(slots.served, total);
  return (
    <div className="w-full max-w-sm space-y-2">
      <div
        className="flex gap-1"
        role="img"
        aria-label={`${served} of ${total} places taken`}
      >
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              i < served ? "bg-foreground" : "bg-muted"
            )}
          />
        ))}
      </div>
      <p className="text-[11px] tabular-nums text-muted-foreground">
        {served} of {total} places taken · open to the first {total} people
      </p>
    </div>
  );
}
