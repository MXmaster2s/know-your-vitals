"use client";

import * as React from "react";
import { AddMeasurementDialog } from "@/components/add-measurement-dialog";
import { DashboardControls } from "@/components/dashboard-controls";
import { MarkerDetailDialog } from "@/components/marker-detail-dialog";
import { MarkerTile } from "@/components/marker-tile";
import { ReportsList } from "@/components/reports-list";
import {
  AttentionSection,
  PositiveSection,
} from "@/components/status-sections";
import { Skeleton } from "@/components/ui/skeleton";
import { usePerson } from "@/components/person-provider";
import { usePersonData } from "@/lib/use-person-data";
import { dismiss, undismiss, type Marker } from "@/lib/data";
import {
  CATEGORY_LABEL,
  actionableFindings,
  attentionEntries,
  dismissalSet,
  groupByCategory,
  matchesQuery,
  positiveEntries,
  seriesAsOf,
} from "@/lib/derive";

export function Dashboard() {
  const { personId, labelFor, canEdit } = usePerson();
  const { data, error, refresh } = usePersonData();
  const [openMarker, setOpenMarker] = React.useState<Marker | null>(null);
  const [showHidden, setShowHidden] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [reportDate, setReportDate] = React.useState<string | null>(null);

  const onDismiss = React.useCallback(
    async (kind: "measurement" | "finding", refId: string) => {
      if (!personId) return;
      await dismiss(personId, kind, refId);
      refresh();
    },
    [personId, refresh]
  );

  const onRestoreAll = React.useCallback(async () => {
    if (!data || !personId) return;
    await Promise.all(
      data.dismissals.map((d) => undismiss(personId, d.kind, d.ref_id))
    );
    setShowHidden(false);
    refresh();
  }, [data, personId, refresh]);

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Couldn&apos;t load data: {error}
      </p>
    );
  }

  if (!data || !personId) return <DashboardSkeleton />;

  const personLabel = labelFor(personId);

  // Report filter narrows to one visit; search narrows by marker name.
  const scoped = seriesAsOf(data.markers, data.measurements, reportDate);
  const series = scoped.filter((s) => matchesQuery(s, query));
  const hidden = dismissalSet(data.dismissals);
  const filtering = reportDate !== null || query.trim() !== "";
  const markerById = new Map(data.markers.map((m) => [m.id, m]));

  const allAttention = attentionEntries(series);
  const allFindings = actionableFindings(data.findings);

  // Dismissals key off the specific reading, so a later flagged result for the
  // same marker comes back on its own rather than staying hidden for good.
  const attention = showHidden
    ? allAttention
    : allAttention.filter((e) => !hidden.has("measurement", e.series.latest.id));
  const findings = showHidden
    ? allFindings
    : allFindings.filter((f) => !hidden.has("finding", f.id));

  const hiddenCount =
    allAttention.length - attention.length + (allFindings.length - findings.length);
  const hiddenTotal = showHidden
    ? allAttention.filter((e) => hidden.has("measurement", e.series.latest.id))
        .length + allFindings.filter((f) => hidden.has("finding", f.id)).length
    : hiddenCount;

  const positives = positiveEntries(series);
  const groups = groupByCategory(series);

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-2xl">
          {personLabel}
        </h1>
        {canEdit(personId) ? (
          <AddMeasurementDialog
            markers={data.markers}
            personId={personId}
            personLabel={personLabel}
            onAdded={refresh}
          />
        ) : null}
      </div>

      <DashboardControls
        query={query}
        onQueryChange={setQuery}
        reports={data.reports}
        selectedReport={reportDate}
        onSelectReport={setReportDate}
      />

      {series.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card/50 px-4 py-10 text-center text-sm text-muted-foreground">
          {filtering
            ? "Nothing matches that filter."
            : `No readings for ${personLabel} yet. Add one with the button above.`}
        </p>
      ) : (
        <>
          {/* Good news first. */}
          <PositiveSection
            entries={positives}
            personLabel={personLabel}
            onOpenMarker={(id) => setOpenMarker(markerById.get(id) ?? null)}
          />

          <AttentionSection
            entries={attention}
            findings={findings}
            personLabel={personLabel}
            hiddenCount={hiddenTotal}
            showHidden={showHidden}
            onToggleHidden={() => setShowHidden((v) => !v)}
            onOpenMarker={(id) => setOpenMarker(markerById.get(id) ?? null)}
            onDismissMeasurement={(id) => onDismiss("measurement", id)}
            onDismissFinding={(id) => onDismiss("finding", id)}
          />

          {showHidden && hiddenTotal > 0 ? (
            <button
              type="button"
              onClick={onRestoreAll}
              className="-mt-6 text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
            >
              Restore all dismissed
            </button>
          ) : null}

          {groups.map((group) => (
            <section
              key={group.category}
              aria-label={CATEGORY_LABEL[group.category]}
            >
              <h2 className="mb-3 font-serif text-lg">
                {CATEGORY_LABEL[group.category]}
              </h2>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {group.series.map((s) => (
                  <MarkerTile
                    key={s.marker.id}
                    series={s}
                    personLabel={personLabel}
                    onOpen={() => setOpenMarker(s.marker)}
                  />
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      {/* The archive sits behind the pencil: reading the dashboard is the
          everyday job, and the full report list is what you open when you are
          working on the data. Hidden while filtering too, so a search returns
          a search rather than a search plus every reading you have ever had. */}
      {canEdit(personId) && !filtering ? (
        <section aria-label="Reports">
          <h2 className="mb-3 font-serif text-lg">Reports</h2>
          <ReportsList data={data} personLabel={personLabel} />
        </section>
      ) : null}

      <MarkerDetailDialog
        marker={openMarker}
        personId={personId}
        onClose={() => setOpenMarker(null)}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-20" />
      </div>
      {[0, 1].map((s) => (
        <div key={s} className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
