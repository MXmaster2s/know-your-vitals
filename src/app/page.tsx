"use client";

import { Dashboard } from "@/components/dashboard";
import { UploadReports } from "@/components/upload-reports";
import { Skeleton } from "@/components/ui/skeleton";
import { usePerson } from "@/components/person-provider";

/**
 * Home is whatever you have. Someone with records lands on them; someone who
 * has just signed in lands on the one thing that starts everything.
 */
export default function HomePage() {
  const { people, meId } = usePerson();

  if (people.length === 0) {
    return <Skeleton className="h-64 w-full" />;
  }

  return meId ? <Dashboard /> : <UploadReports />;
}
