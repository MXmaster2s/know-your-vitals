"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { getViewCounts, recordView, type ViewCounts } from "@/lib/data";

const fmt = (n: number) => n.toLocaleString("en-IN");

/**
 * Page loads, not people. Recorded through a security-definer function so the
 * log itself stays unreadable to whoever is looking at the page.
 *
 * Failures are swallowed on purpose: a counter is not worth an error state on
 * a page about someone's health.
 */
export function ViewCounts() {
  const pathname = usePathname();
  const [counts, setCounts] = React.useState<ViewCounts | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    recordView(pathname)
      .catch(() => {})
      .then(() => getViewCounts())
      .then((c) => {
        if (!cancelled && c) setCounts(c);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (!counts) return null;

  return (
    <span className="text-[11px] tabular-nums text-muted-foreground/70">
      {fmt(counts.last_24h)} views today · {fmt(counts.lifetime)} all time
    </span>
  );
}
