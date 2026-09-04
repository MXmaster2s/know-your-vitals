"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { ViewCounts } from "@/components/view-counts";

// A public checkout link, so it belongs in config rather than in the code —
// and the open-source repo stays free of one person's product id. Unset means
// the invitation simply is not shown.
const CHECKOUT_URL = process.env.NEXT_PUBLIC_CHECKOUT_URL;

/**
 * The quietest thing on the page, and the right home for everything that is
 * about the app rather than about the data: the invitation, how many people
 * have looked, and the light switch. Moving those out of the header leaves it
 * to do one job — telling you where you are.
 */
export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-border/60">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-8">
        {CHECKOUT_URL ? (
          <p className="text-xs text-muted-foreground">
            Want to start using this tool for yourself?{" "}
            <a
              href={CHECKOUT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
            >
              Request access
            </a>
          </p>
        ) : null}

        {/* Prices are set per country by the payment provider now, so no
            figure is quoted anywhere in the app — the checkout shows the
            right one. */}
        <Link
          href="/chatgpt"
          className="text-xs text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground"
        >
          Connect your AI
        </Link>

        <Link
          href="/preview"
          className="text-xs text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground"
        >
          Preview Demo
        </Link>

        <div className="ml-auto flex items-center gap-3">
          <ViewCounts />
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}
