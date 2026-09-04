"use client";

import { Dashboard } from "@/components/dashboard";
import { UploadReports } from "@/components/upload-reports";
import { Skeleton } from "@/components/ui/skeleton";
import { usePerson } from "@/components/person-provider";
import { usePersonData } from "@/lib/use-person-data";

/**
 * Home is whatever you have. Records land you on them; no records lands you on
 * the one thing that starts everything.
 */
export default function HomePage() {
  const { personId } = usePerson();
  const state = usePersonData();

  if (!personId || (!state.data && !state.error)) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (state.data && state.data.measurements.length === 0) {
    return <UploadReports />;
  }
  return <Dashboard {...state} />;
}
