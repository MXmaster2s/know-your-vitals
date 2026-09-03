"use client";

import { usePathname } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { EditModeProvider } from "@/components/edit-mode";
import { PersonProvider } from "@/components/person-provider";

/**
 * Chrome for the signed-in app. /login renders bare (no header, no guard
 * gate); everything else sits behind the AuthGuard with the header shell.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Public: the landing page, and where a payment lands you. Everything else
  // is behind sign-in.
  const PUBLIC = ["/login", "/learnmore", "/paid"];
  if (PUBLIC.includes(pathname)) return <>{children}</>;
  return (
    <AuthGuard>
      <EditModeProvider>
      <PersonProvider>
        <div className="flex min-h-dvh w-full flex-col">
          <AppHeader />
          <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-24 pt-8 sm:px-8">
            {children}
          </main>
          <AppFooter />
        </div>
      </PersonProvider>
      </EditModeProvider>
    </AuthGuard>
  );
}
