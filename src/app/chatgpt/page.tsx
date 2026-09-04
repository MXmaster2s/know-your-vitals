"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";

const MCP_URL = "https://health.openhouse.ink/mcp";

/**
 * How to point an AI at your own numbers.
 *
 * Two honest problems shape this page. The connector is not switched on yet,
 * and custom connectors are a paid feature in both ChatGPT and Claude — so a
 * guide that opens with "add this URL" would waste the time of most people
 * who read it. It leads with the thing that works today on any plan instead,
 * and puts the connector second, marked as not ready.
 *
 * No hero, no pitch. Someone arriving here has already decided; they want the
 * steps.
 */
export default function ChatGptPage() {
  return (
    <main className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-2xl items-center gap-4 px-5 py-5 sm:px-8">
        <Link href="/learnmore" className="font-serif text-xl leading-none">
          Health
        </Link>
        <Link
          href="/"
          className="ml-auto text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Your dashboard
        </Link>
      </header>

      <div className="mx-auto w-full max-w-2xl space-y-14 px-5 pb-24 pt-6 sm:px-8">
        <section className="space-y-3">
          <h1 className="font-serif text-3xl leading-tight sm:text-4xl">
            Ask your AI about your own numbers
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Two ways. The first works right now, on a free account, and takes
            about ten seconds. The second is less typing but needs a paid plan
            and is not switched on yet.
          </p>
        </section>

        {/* ------------------------------------------------ works today */}
        <section className="space-y-5">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-positive">
              Works now · any plan, including free
            </p>
            <h2 className="font-serif text-2xl leading-tight">Copy and paste</h2>
          </div>

          <ol className="space-y-5">
            <Step n={1} title="Open the marker you want to ask about">
              On <Link href="/" className="underline decoration-border underline-offset-4 hover:decoration-foreground">your dashboard</Link>, tap any card — cholesterol, HbA1c, whatever is
              on your mind.
            </Step>
            <Step n={2} title="Press the copy icon">
              Top right of the card. It copies the full history as plain text:
              every reading, its date, the lab, and the range that lab printed.
            </Step>
            <Step n={3} title="Paste it into ChatGPT or Claude">
              Then ask your question. Something like:
              <Quote>
                Here are my triglyceride readings over eighteen months. What is
                the trend, and what would you ask my doctor?
              </Quote>
            </Step>
          </ol>

          <p className="rounded-xl border bg-card/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            This is the whole trick. The AI does not need access to your
            account — it needs the numbers, and the copy button hands them over
            in a form it reads well.
          </p>
        </section>

        {/* ------------------------------------------------- coming soon */}
        <section className="space-y-5">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-attention">
              Not switched on yet
            </p>
            <h2 className="font-serif text-2xl leading-tight">
              Connect it once, then just ask
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              A connector lets the AI read your data itself, so you stop
              copying anything. Two things to know before you try:{" "}
              <strong className="font-medium text-foreground">
                it needs a paid ChatGPT or Claude plan
              </strong>{" "}
              — custom connectors are not on the free tiers — and the address
              below is not live yet. This is here so you know what is coming.
            </p>
          </div>

          <CopyRow value={MCP_URL} />

          <div className="grid gap-8 sm:grid-cols-2">
            <div className="space-y-3">
              <h3 className="font-serif text-lg">In ChatGPT</h3>
              <ol className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                <NumberedLine n={1}>
                  Settings → <strong className="font-medium text-foreground">Connectors</strong>
                </NumberedLine>
                <NumberedLine n={2}>Add a custom connector</NumberedLine>
                <NumberedLine n={3}>Paste the address above</NumberedLine>
                <NumberedLine n={4}>
                  A browser window asks you to sign in to Health. Approve it.
                </NumberedLine>
                <NumberedLine n={5}>
                  In a chat, turn the connector on and ask your question.
                </NumberedLine>
              </ol>
            </div>

            <div className="space-y-3">
              <h3 className="font-serif text-lg">In Claude</h3>
              <ol className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                <NumberedLine n={1}>
                  Settings → <strong className="font-medium text-foreground">Connectors</strong>
                </NumberedLine>
                <NumberedLine n={2}>Add custom connector</NumberedLine>
                <NumberedLine n={3}>Paste the address above</NumberedLine>
                <NumberedLine n={4}>
                  Sign in to Health in the window that opens, and approve.
                </NumberedLine>
                <NumberedLine n={5}>
                  Ask away — Claude reads your markers when it needs them.
                </NumberedLine>
              </ol>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            You approve it in your own browser, and you can disconnect it from
            the same Connectors screen whenever you like.
          </p>
        </section>

        <section className="border-t pt-8">
          <h2 className="font-serif text-lg">Worth asking</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li>Which of my markers changed most in the last year?</li>
            <li>My ALT went up while my triglycerides came down. Is that odd?</li>
            <li>
              Write me a short summary of my last three panels for my doctor.
            </li>
          </ul>
          <p className="mt-4 text-xs text-muted-foreground/80">
            An AI is not your doctor, and neither is this. It is good at
            spotting patterns and at helping you write down a better question.
          </p>
        </section>
      </div>
    </main>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      {/* Numbered because it genuinely is an order — you cannot paste before
          you copy. */}
      <span className="mt-1 shrink-0 font-mono text-xs tabular-nums text-muted-foreground/70">
        {String(n).padStart(2, "0")}
      </span>
      <div className="space-y-1">
        <h3 className="font-serif text-lg leading-tight">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}

function NumberedLine({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground/60">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function Quote({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-2 block border-l-2 border-border pl-3 italic text-foreground/90">
      {children}
    </span>
  );
}

/** The address, with a copy button — nobody should retype a URL by hand. */
function CopyRow({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed bg-card/40 px-3 py-2.5">
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
        {value}
      </code>
      <button
        type="button"
        aria-label="Copy the address"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
          } catch {
            // Older browsers and locked-down webviews refuse the clipboard;
            // the address is on screen either way.
            return;
          }
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {copied ? (
          <Check className="size-3.5 text-positive" aria-hidden />
        ) : (
          <Copy className="size-3.5" aria-hidden />
        )}
      </button>
    </div>
  );
}
