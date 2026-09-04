"use client";

import * as React from "react";
import Link from "next/link";
import { Dashboard } from "@/components/dashboard";
import NutritionPage from "@/app/nutrition/page";
import { PersonProvider } from "@/components/person-provider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePersonData } from "@/lib/use-person-data";

/**
 * The same tool, filled with two real people's records — the only honest way
 * to show what it does. The Vitals / Nutrition switch here is the page's own,
 * not the navbar's: the navbar stays about YOU, and this is about them.
 */
export default function PreviewPage() {
  const [view, setView] = React.useState<"vitals" | "nutrition">("vitals");

  return (
    <PersonProvider roster="demo">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed bg-card/40 px-4 py-3">
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-medium">Someone else&apos;s data.</span>{" "}
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
          <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
            <TabsList>
              <TabsTrigger value="vitals">Vitals</TabsTrigger>
              <TabsTrigger value="nutrition">Nutrition</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {view === "vitals" ? <DemoVitals /> : <NutritionPage />}
      </div>
    </PersonProvider>
  );
}

function DemoVitals() {
  const state = usePersonData();
  return <Dashboard {...state} />;
}
