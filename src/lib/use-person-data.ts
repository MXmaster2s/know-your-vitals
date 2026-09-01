"use client";

import * as React from "react";
import {
  getDismissals,
  getFindings,
  getMarkers,
  getMeasurements,
  getReports,
  type Dismissal,
  type Marker,
  type Measurement,
  type QualitativeFinding,
  type Report,
} from "@/lib/data";
import { usePerson } from "@/components/person-provider";

export interface PersonData {
  markers: Marker[];
  measurements: Measurement[];
  reports: Report[];
  findings: QualitativeFinding[];
  dismissals: Dismissal[];
}

interface State {
  data: PersonData | null;
  error: string | null;
  refresh: () => void;
}

/** Everything the pages need for the selected person, one parallel fetch.
 *  Refetches when the person switches or refresh() is called (after inserts). */
export function usePersonData(): State {
  const { personId } = usePerson();
  const [data, setData] = React.useState<PersonData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  // Reset synchronously when the request identity changes (render-time state
  // adjustment — avoids a setState-in-effect cascade).
  const requestKey = `${personId ?? ""}#${tick}`;
  const [lastKey, setLastKey] = React.useState(requestKey);
  if (lastKey !== requestKey) {
    setLastKey(requestKey);
    setData(null);
    setError(null);
  }

  React.useEffect(() => {
    if (!personId) return; // roster still loading
    let cancelled = false;
    Promise.all([
      getMarkers(),
      getMeasurements(personId),
      getReports(personId),
      getFindings(personId),
      getDismissals(personId),
    ])
      .then(([markers, measurements, reports, findings, dismissals]) => {
        if (!cancelled)
          setData({ markers, measurements, reports, findings, dismissals });
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const refresh = React.useCallback(() => setTick((t) => t + 1), []);
  return { data, error, refresh };
}
