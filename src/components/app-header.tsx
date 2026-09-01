"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSession } from "@/components/auth-provider";
import { usePerson } from "@/components/person-provider";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/reports", label: "Reports" },
] as const;

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useSession();
  const { personId, setPersonId, people } = usePerson();

  return (
    <header className="sticky top-0 z-10 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-5 py-3 sm:gap-3 sm:px-8">
        <span className="font-serif text-xl leading-none">Vitals</span>
        <nav aria-label="Sections" className="ml-2 flex items-center gap-1 sm:ml-4">
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
