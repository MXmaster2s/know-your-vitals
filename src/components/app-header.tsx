"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EditModeToggle } from "@/components/edit-mode";
import { ThemeToggle } from "@/components/theme-toggle";
import { ViewCounts } from "@/components/view-counts";
import { useSession } from "@/components/auth-provider";
import { usePerson } from "@/components/person-provider";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Vitals" },
  { href: "/nutrition", label: "Nutrition" },
] as const;

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useSession();
  const { personId, setPersonId, people, meId } = usePerson();

  return (
    <header className="sticky top-0 z-10 border-b border-border/60 bg-background/85 backdrop-blur">
      {/* Below sm the section links drop to their own row — the wordmark,
          person switch and three controls already fill 393 px. */}
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-2 gap-y-1.5 px-5 py-2.5 sm:flex-nowrap sm:gap-3 sm:px-8 sm:py-3">
        <span className="font-serif text-xl leading-none">Health</span>
        <nav
          aria-label="Sections"
          className="order-last flex w-full items-center gap-1 sm:order-none sm:ml-4 sm:w-auto"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-2 py-1 text-sm transition-colors",
                pathname === item.href
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
          {/* Sits at the tail of the section links: on a phone that row has
              the space, and the counts are the least urgent thing here. */}
          <span className="ml-auto pl-2 sm:ml-3">
            <ViewCounts />
          </span>
        </nav>
        {people.length > 1 ? (
          <Tabs
            value={personId ?? undefined}
            onValueChange={setPersonId}
            className="ml-auto"
          >
            <TabsList>
              {people.map((p) => (
                <TabsTrigger key={p.id} value={p.id}>
                  {p.display_name ?? p.id}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : (
          <span className="ml-auto" />
        )}
        {meId ? <EditModeToggle /> : null}
        <ThemeToggle />
        <Button
          variant="outline"
          size="icon"
          aria-label="Sign out"
          className="cursor-pointer"
          onClick={async () => {
            await signOut();
            router.replace("/login");
          }}
        >
          <LogOut strokeWidth={1.75} aria-hidden />
        </Button>
      </div>
    </header>
  );
}
