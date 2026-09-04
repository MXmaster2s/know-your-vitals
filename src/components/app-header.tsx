"use client";

import { LogOut, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EditModeToggle } from "@/components/edit-mode";
import { useSession } from "@/components/auth-provider";
import { usePerson } from "@/components/person-provider";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  /** Only for whoever runs the place. */
  admin?: boolean;
  /** Only while the pencil is on. */
  editing?: boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "Vitals" },
  { href: "/nutrition", label: "Nutrition" },
  { href: "/analytics", label: "Analytics", admin: true, editing: true },
];

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useSession();
  const { personId, setPersonId, people, meId, canEdit, isAdmin } = usePerson();
  const signedIn = meId !== null;

  const nav = NAV.filter(
    (item) =>
      (!item.admin || isAdmin) && (!item.editing || canEdit(personId))
  );

  return (
    <header className="sticky top-0 z-10 border-b border-border/60 bg-background/85 backdrop-blur">
      {/* Below sm the section links drop to their own row — the wordmark,
          person switch and controls already fill 393 px. */}
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-2 gap-y-1.5 px-5 py-2.5 sm:flex-nowrap sm:gap-3 sm:px-8 sm:py-3">
        <Link
          href="/"
          className="font-serif text-xl leading-none transition-opacity hover:opacity-80"
        >
          Health
        </Link>

        <nav
          aria-label="Sections"
          className="order-last flex w-full items-center gap-1 sm:order-none sm:ml-4 sm:w-auto"
        >
          {nav.map((item) => (
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

        {/* A household of one gets its name; a household of more gets a switch. */}
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
          <span className="ml-auto truncate text-sm">
            {people[0]?.display_name ?? ""}
          </span>
        )}

        {signedIn ? (
          <Link
            href="/partner"
            title="Add your partner's data"
            aria-label="Add your partner's data"
            className="group grid size-8 shrink-0 place-items-center rounded-lg border text-muted-foreground transition-colors hover:border-ring/60 hover:text-foreground"
          >
            <Plus className="size-4" strokeWidth={1.75} aria-hidden />
            <span className="sr-only">Add your partner&apos;s data</span>
          </Link>
        ) : null}

        {signedIn ? <EditModeToggle /> : null}

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
