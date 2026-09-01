"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePerson } from "@/components/person-provider";
import { usePersonData } from "@/lib/use-person-data";
import { effectiveFlag, fmtDate, fmtRange, fmtValue } from "@/lib/derive";
import { cn } from "@/lib/utils";
import type { Measurement } from "@/lib/data";

export default function ReportsPage() {
  const { personId, labelFor } = usePerson();
  const { data, error } = usePersonData();

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Couldn&apos;t load reports: {error}
      </p>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  const markerById = new Map(data.markers.map((m) => [m.id, m]));
  const measurementsByReport = new Map<string, Measurement[]>();
  for (const m of data.measurements) {
    const list = measurementsByReport.get(m.report_id);
    if (list) list.push(m);
    else measurementsByReport.set(m.report_id, [m]);
  }
  // Newest first; measurements inside a report follow marker sort order.
  const reports = [...data.reports].sort((a, b) =>
    b.taken_on.localeCompare(a.taken_on)
  );
  const sortOf = (m: Measurement) => markerById.get(m.marker_id)?.sort ?? 9999;

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl">
        Reports · {labelFor(personId)}
      </h1>

      {reports.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card/50 px-4 py-10 text-center text-sm text-muted-foreground">
          No reports for {labelFor(personId)} yet.
        </p>
      ) : (
        <Accordion type="multiple" className="w-full">
          {reports.map((report) => {
            const rows = (measurementsByReport.get(report.id) ?? []).sort(
              (a, b) => sortOf(a) - sortOf(b)
            );
            const flaggedCount = rows.filter((m) => effectiveFlag(m)).length;
            return (
              <AccordionItem key={report.id} value={report.id}>
                <AccordionTrigger className="cursor-pointer hover:no-underline">
                  <span className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 pr-2 text-left">
                    <span className="font-medium">{fmtDate(report.taken_on)}</span>
                    {report.lab ? (
                      <span className="text-muted-foreground">{report.lab}</span>
                    ) : null}
                    {report.kind ? (
                      <Badge variant="secondary">{report.kind}</Badge>
                    ) : null}
                    <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                      {flaggedCount > 0 ? (
                        <Badge
                          variant="outline"
                          className="border-attention/50 text-attention"
                        >
                          {flaggedCount} flagged
                        </Badge>
                      ) : null}
                      {rows.length} value{rows.length === 1 ? "" : "s"}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  {rows.length === 0 ? (
                    <p className="px-1 pb-2 text-sm text-muted-foreground">
                      No measurements attached to this report.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Marker</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead>Range</TableHead>
                          <TableHead className="text-right">Flag</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((m) => {
                          const flag = effectiveFlag(m);
                          const marker = markerById.get(m.marker_id);
                          return (
                            <TableRow
                              key={m.id}
                              className={cn(flag && "bg-attention/5")}
                            >
                              <TableCell className="whitespace-normal">
                                {marker?.name ?? m.marker_id}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "text-right tabular-nums",
                                  flag && "font-medium text-attention"
                                )}
                              >
                                {fmtValue(m.value)}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {m.unit ?? marker?.unit ?? ""}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {fmtRange(m) ?? "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                {flag ? (
                                  <Badge
                                    variant="outline"
                                    className="border-attention/50 text-attention"
                                  >
                                    {flag}
                                  </Badge>
                                ) : null}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
