"use client";

import Link from "next/link";
import { Dashboard } from "@/components/dashboard";

/**
 * The same dashboard, filled with two real people's records — the only honest
 * way to show what the tool does. Behind sign-in on purpose: someone who has
 * gone that far is worth knowing about.
 */
export default function PreviewPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-dashed bg-card/40 px-4 py-3">
        <p className="text-sm">
          <span className="font-medium">This is someone else&apos;s data.</span>{" "}
          <span className="text-muted-foreground">
            Two real people, eighteen months of blood work. Yours looks like
            this once you{" "}
            <Link
              href="/"
              className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
            >
              upload your reports
            </Link>
            .
          </span>
        </p>
      </div>
      <Dashboard />
    </div>
  );
}
