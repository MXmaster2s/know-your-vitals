"use client";

import * as React from "react";
import { Dashboard } from "@/components/dashboard";
import NutritionPage from "@/app/nutrition/page";
import { PersonProvider, usePerson } from "@/components/person-provider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePersonData } from "@/lib/use-person-data";

/**
 * The same tool, filled with two real people's records — the only honest way
 * to show what it does. They appear by role rather than by name: a stranger
 * should be able to read the demo without learning whose blood work it is.
 *
 * Both switches live on the page, not in the navbar. The navbar is about you;
 * this page is about them, and stacking whose-data above which-view says that
 * without a caption.
 */
export default function PreviewPage() {
  return (
    <PersonProvider roster="demo">
      <PreviewBody />
    </PersonProvider>
  );
}

function PreviewBody() {
  const { people, personId, setPersonId, labelFor } = usePerson();
  const [view, setView] = React.useState<"vitals" | "nutrition">("vitals");

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-2">
        {people.length > 1 ? (
          <Tabs value={personId ?? undefined} onValueChange={setPersonId}>
            <TabsList>
              {people.map((p) => (
                <TabsTrigger key={p.id} value={p.id}>
                  {labelFor(p.id)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}
        <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
          <TabsList>
            <TabsTrigger value="vitals">Vitals</TabsTrigger>
            <TabsTrigger value="nutrition">Nutrition</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {view === "vitals" ? <DemoVitals /> : <NutritionPage />}
    </div>
  );
}

function DemoVitals() {
  const state = usePersonData();
  return <Dashboard {...state} />;
}
