"use client";

import * as React from "react";
import { FileText, Upload, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The first screen someone sees with nothing in the app yet. An empty screen
 * is an invitation, so it asks for the one thing that starts everything: the
 * last blood test.
 *
 * It is honest about what happens next. Reading reports is not automatic yet,
 * and a dropzone that silently swallows a file would be worse than one that
 * says so.
 */
export function UploadReports({
  title = "Start with your last blood test",
  blurb = "Drop in the PDFs your lab gave you — any lab, any format. Your dashboard gets built from what is in them.",
}: {
  title?: string;
  blurb?: string;
}) {
  const [files, setFiles] = React.useState<File[]>([]);
  const [over, setOver] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);

  const add = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 py-12 text-center sm:py-20">
      <div className="space-y-2">
        <h1 className="font-serif text-2xl leading-tight sm:text-3xl">{title}</h1>
        <p className="text-sm text-muted-foreground">{blurb}</p>
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
          "flex w-full cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-14 transition-colors",
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
          PDFs, or photos of a printout
        </span>
        <input
          ref={input}
          type="file"
          multiple
          accept="application/pdf,image/*"
          className="sr-only"
          onChange={(e) => add(e.target.files)}
        />
      </label>

      {files.length > 0 ? (
        <div className="w-full space-y-2 text-left">
          <ul className="divide-y rounded-xl border bg-card">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-3 px-3 py-2.5">
                <FileText className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {(f.size / 1024).toLocaleString("en-IN", { maximumFractionDigits: 0 })} KB
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          {/* Said plainly rather than implied by a spinner that never resolves. */}
          <p className="px-1 text-[11px] text-muted-foreground">
            Reading reports is not automatic yet — they are read by hand, and
            you will get an email when your dashboard is ready.
          </p>
        </div>
      ) : null}

      <Button asChild variant="outline" className="cursor-pointer">
        <Link href="/learnmore">Learn more</Link>
      </Button>
    </div>
  );
}
