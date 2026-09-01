"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/components/auth-provider";

/**
 * Client-side auth guard (UX only — authorization is Supabase RLS).
 * Renders a skeleton until the session state is known, so protected
 * content never flashes; the build-time HTML is the skeleton state.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, ready } = useSession();

  useEffect(() => {
    if (ready && !session && pathname !== "/login") {
      router.replace("/login");
    }
  }, [ready, session, pathname, router]);

  if (pathname === "/login") return <>{children}</>;
  if (!ready || !session) return <PageSkeleton />;
  return <>{children}</>;
}

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-5 pt-10 sm:px-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-40" />
      </div>
      <Skeleton className="h-44 w-full" />
      <Skeleton className="h-44 w-full" />
    </div>
  );
}
