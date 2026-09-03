"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const CHECKOUT_URL = process.env.NEXT_PUBLIC_CHECKOUT_URL;

/**
 * The landing page. Its one job is to make the case in about twenty seconds
 * to somebody who arrived from a link and has a drawer of lab PDFs.
 *
 * The hero is not a headline over a screenshot. The characteristic artifact of
 * this world is the lab printout itself — monospaced, an H flag, a reference
 * range nobody reads — and the product IS the act of turning that line into a
 * direction. So the hero performs that, using the two typefaces to carry the
 * before and after: mono for paper, serif for what it means.
 */
export default function LearnMorePage() {
  return (
    <main className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-4xl items-center gap-4 px-5 py-5 sm:px-8">
        <Link href="/learnmore" className="font-serif text-xl leading-none">
          Health
        </Link>
        <Link
          href="/"
          className="ml-auto text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Sign in
        </Link>
      </header>

      <div className="mx-auto w-full max-w-4xl px-5 pb-24 sm:px-8">
        {/* ---------------------------------------------------------- hero */}
        <section className="pt-10 sm:pt-16">
          <h1 className="max-w-2xl font-serif text-3xl leading-[1.15] sm:text-5xl">
            Every lab prints the number.
            <br />
            <span className="text-muted-foreground">
              None of them print the direction.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            You get a PDF with an <span className="font-mono text-attention">H</span>{" "}
            beside a number and no way to tell whether that is new, or whether
            it has been drifting for two years. Health reads your blood tests —
            any lab, any year — and shows you what is moving.
          </p>

          <Transformation />
        </section>

        {/* ------------------------------------------------------ what it is */}
        <section className="mt-20 grid gap-10 border-t pt-12 sm:mt-28 sm:grid-cols-2 sm:gap-12">
          <div className="space-y-2">
            <h2 className="font-serif text-xl">Vitals</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              What sits outside its range, and which way it is heading. Every
              reading is judged against the range{" "}
              <em className="not-italic text-foreground">that lab printed next to it</em> —
              one lab caps ALT at 50, another at 55, a third splits it by sex,
              and comparing them any other way means nothing.
            </p>
          </div>
          <div className="space-y-2">
            <h2 className="font-serif text-xl">Nutrition</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The day as a timetable — what you ate, in grams or pieces, what it
              cost. Totals land against the targets you set, so a week of eating
              is a number you can put next to a lipid panel instead of a
              feeling.
            </p>
          </div>
        </section>

        {/* ------------------------------------------------------------ price */}
        <section className="mt-20 border-t pt-12 sm:mt-28">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="space-y-2">
              <h2 className="font-serif text-2xl leading-tight sm:text-3xl">
                Ten dollars, once.
              </h2>
              <p className="max-w-md text-sm text-muted-foreground">
                No subscription, no renewal, no per-report charge. Bring as many
                years of reports as you have.
              </p>
            </div>
            {CHECKOUT_URL ? (
              <Button asChild size="lg" className="cursor-pointer">
                <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer">
                  Request access
                  <ArrowRight className="size-4" aria-hidden />
                </a>
              </Button>
            ) : null}
          </div>

          {/* Understated on purpose: it works, but it is not the reason to buy. */}
          <p className="mt-10 max-w-xl text-xs leading-relaxed text-muted-foreground/80">
            Your AI can read it too — point it at{" "}
            <span className="font-mono text-muted-foreground">
              health.openhouse.ink/mcp
            </span>
            , sign in once in the browser, and ask it questions about your own
            numbers. Early, and getting better.
          </p>
        </section>
      </div>
    </main>
  );
}

/**
 * The signature. One marker, twice: as the lab set it, and as it reads once
 * there is more than one of them. The numbers are real — one panel, five
 * months apart.
 */
function Transformation() {
  return (
    <div className="mt-10 grid gap-3 sm:mt-12 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch sm:gap-6">
      {/* as it arrives */}
      <figure className="flex flex-col rounded-xl border bg-card/60 p-4 sm:p-5">
        <figcaption className="mb-3 text-[10px] uppercase tracking-wider text-muted-foreground/70">
          What the lab sends
        </figcaption>
        <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
{`CHOLESTEROL, TOTAL      204.0  mg/dL  H   <200
TRIGLYCERIDES, SERUM    572.7  mg/dL  H   <150
HDL CHOLESTEROL          50.0  mg/dL      >40
LDL, CALCULATED          80.4  mg/dL      <100`}
        </pre>
      </figure>

      <ArrowRight
        className="mx-auto hidden size-5 shrink-0 self-center text-muted-foreground/50 sm:block"
        aria-hidden
      />

      {/* what it means once there is more than one */}
      <figure className="flex flex-col rounded-xl border border-positive/40 bg-positive/5 p-4 sm:p-5">
        <figcaption className="mb-3 text-[10px] uppercase tracking-wider text-muted-foreground/70">
          What you see
        </figcaption>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Triglycerides</p>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-3xl tabular-nums leading-none">143</span>
            <span className="text-xs text-muted-foreground">mg/dL</span>
            <span className="text-xs text-positive">back in range</span>
          </p>
          <p className="pt-1 text-xs tabular-nums text-muted-foreground">
            572.7 → 207 → 143 over five months
          </p>
        </div>
        <p className="mt-auto border-t border-positive/20 pt-3 text-[11px] leading-relaxed text-muted-foreground">
          The same panel also stops lying about LDL: that 80.4 is calculated,
          and the formula is invalid above 400 triglycerides. Health knows, and
          says so.
        </p>
      </figure>
    </div>
  );
}
