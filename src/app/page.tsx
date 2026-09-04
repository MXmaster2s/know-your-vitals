"use client";

import { Dashboard } from "@/components/dashboard";
import { UploadReports } from "@/components/upload-reports";
import { Skeleton } from "@/components/ui/skeleton";
import { usePerson } from "@/components/person-provider";
import { usePersonData } from "@/lib/use-person-data";

/**
 * Home is whatever you have. With no readings the upload screen IS the page;
 * once there is a dashboard it moves to the foot, because more reports are
 * always welcome but they are no longer the reason you came.
 */
export default function HomePage() {
  const { personId } = usePerson();
  const state = usePersonData();

  if (!personId || (!state.data && !state.error)) {
    return <Skeleton className="h-64 w-full" />;
  }

  const empty = state.data?.measurements.length === 0;
  if (empty) return <UploadReports />;

  return (
    <div className="space-y-12">
      <Dashboard {...state} />
      <UploadReports variant="section" />
    </div>
  );
}
