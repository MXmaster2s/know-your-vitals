"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { effectiveFlag, fmtDate, fmtRange, fmtValue } from "@/lib/derive";
import { cn } from "@/lib/utils";
import type { Measurement } from "@/lib/data";
import type { PersonData } from "@/lib/use-person-data";

/**
 * Every visit, in full, with the numbers as the lab printed them. It lives at
 * the foot of the dashboard rather than on a page of its own — the cards above
 * are what you check; this is what you scroll to when a card raises a question.
 */
export function ReportsList({
  data,
  personLabel,
}: {
  data: PersonData;
  personLabel: string;
}) {
  const markerById = new Map(data.markers.map((m) => [m.id, m]));
  const measurementsByReport = new Map<string, Measurement[]>();
  for (const m of data.measurements) {
    const list = measurementsByReport.get(m.report_id);
    if (list) list.push(m);
    else measurementsByReport.set(m.report_id, [m]);
  }
  // Newest first; measurements inside a report follow marker sort order.
  const sorted = [...data.reports].sort((a, b) =>
    b.taken_on.localeCompare(a.taken_on)
  );
  const reports = sorted.filter((r) => !r.planned);
  // Booked but not taken — listed separately so an empty accordion row never
  // reads as "this test came back with nothing".
  const upcoming = sorted.filter((r) => r.planned).reverse();
  const sortOf = (m: Measurement) => markerById.get(m.marker_id)?.sort ?? 9999;

  return (
    <div className="space-y-4">
      {reports.length === 0 && upcoming.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card/50 px-4 py-10 text-center text-sm text-muted-foreground">
          No reports for {personLabel} yet.
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

      {upcoming.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-serif text-lg">Scheduled</h2>
          <ul className="divide-y rounded-xl border border-dashed bg-card/40">
            {upcoming.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm text-muted-foreground"
              >
                <span className="font-medium text-foreground">
                  {fmtDate(r.taken_on)}
                </span>
                {r.lab ? <span>{r.lab}</span> : null}
                <Badge variant="outline" className="border-dashed">
                  not taken yet
                </Badge>
                {r.notes ? <span className="text-xs">{r.notes}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
