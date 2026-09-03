"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Where the payment page sends you. One job: say what happens next, in the
 * order it happens. No celebration graphics — you have paid for a tool, not
 * won something.
 */
export default function PaidPage() {
  const steps: [string, React.ReactNode][] = [
    [
      "Upload your reports",
      <>
        Every blood test you can find, oldest first — the further back you go,
        the more the trends are worth.{" "}
        <Link
          href="/"
          className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
        >
          Start here
        </Link>
        .
      </>,
    ],
    [
      "They get read",
      <>
        Values, units and each lab&apos;s own reference ranges come out of the
        PDFs. This part is done by hand today, so give it a day.
      </>,
    ],
    [
      "Your dashboard appears",
      <>
        What is in range, what is not, and which way each marker is moving —
        laid out like{" "}
        <Link
          href="/preview"
          className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
        >
          this one
        </Link>
        .
      </>,
    ],
  ];

  return (
    <div className="mx-auto max-w-xl space-y-8 py-12 sm:py-20">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-positive">
          Payment received
        </p>
        <h1 className="font-serif text-3xl leading-tight">
          You have access for good.
        </h1>
        <p className="text-sm text-muted-foreground">
          One payment, no renewal. Here is what happens next.
        </p>
      </div>

      {/* Numbered because this genuinely is a sequence — you cannot get a
          dashboard before the reports are read. */}
      <ol className="space-y-5">
        {steps.map(([title, body], i) => (
          <li key={title} className="flex gap-4">
            <span className="mt-0.5 shrink-0 font-mono text-xs tabular-nums text-muted-foreground/70">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="space-y-0.5">
              <h2 className="font-serif text-lg leading-tight">{title}</h2>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          </li>
        ))}
      </ol>

      <Button asChild className="cursor-pointer">
        <Link href="/">Upload your reports</Link>
      </Button>
    </div>
  );
}
