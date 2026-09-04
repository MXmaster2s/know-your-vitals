"use client";

import * as React from "react";
import {
  ensureMe,
  getDemoPeople,
  getPeople,
  type Person,
  type PersonId,
} from "@/lib/data";
import { useSession } from "@/components/auth-provider";
import { useEditMode } from "@/components/edit-mode";

interface PersonContextValue {
  /** null until the roster has loaded. */
  personId: PersonId | null;
  setPersonId: (id: PersonId) => void;
  people: Person[];
  labelFor: (id: PersonId | null) => string;
  /** True when you are permitted to change this person's rows AND have turned
   *  editing on. Permission is enforced in the database as well; the mode is
   *  only about what the interface offers right now. */
  canEdit: (id: PersonId | null) => boolean;
  /** Your own person — every signed-in account has one from first sign-in. */
  meId: PersonId | null;
  /** Sees every household, analytics, uploads, settings. */
  isAdmin: boolean;
  /** Whether this provider is showing your own household or the demo one. */
  roster: "mine" | "demo";
}

export const PersonContext = React.createContext<PersonContextValue>({
  personId: null,
  setPersonId: () => {},
  people: [],
  labelFor: (id) => id ?? "",
  canEdit: () => false,
  meId: null,
  isAdmin: false,
  roster: "mine",
});

/**
 * Who the pages are about. By default that is your household — yourself, plus
 * whoever shares your records. `roster="demo"` swaps in the demo household so
 * a page can show what the tool looks like with real data; nest it inside the
 * default one and only that subtree changes.
 */
export function PersonProvider({
  children,
  roster = "mine",
}: {
  children: React.ReactNode;
  roster?: "mine" | "demo";
}) {
  const { session } = useSession();
  const { editing } = useEditMode();
  const [people, setPeople] = React.useState<Person[]>([]);
  const [personId, setPersonId] = React.useState<PersonId | null>(null);
  const [me, setMe] = React.useState<Person | null>(null);

  const emailRef = React.useRef<string | null>(null);
  emailRef.current = session?.user?.email?.toLowerCase() ?? null;

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      // First sign-in creates your own row; every later one finds it.
      const mine = roster === "mine" ? await ensureMe() : null;
      const rows = roster === "demo" ? await getDemoPeople() : await getPeople();
      if (cancelled) return;
      setPeople(rows);
      setMe(mine);
      setPersonId((cur) => cur ?? mine?.id ?? rows[0]?.id ?? null);
    })().catch(() => {
      /* the pages surface their own load errors */
    });
    return () => {
      cancelled = true;
    };
  }, [roster]);

  const value = React.useMemo<PersonContextValue>(() => {
    const byId = new Map(people.map((p) => [p.id, p]));
    const meId = me?.id ?? null;
    const isAdmin = me?.is_admin === true;
    return {
      personId,
      setPersonId,
      people,
      // On the demo roster people are named by role, so a stranger reading
      // someone else's blood work never learns whose it is. This one line
      // covers every heading, chart legend and copied block at once.
      labelFor: (id) => {
        if (!id) return "";
        const p = byId.get(id);
        if (!p) return id;
        return (roster === "demo" ? p.demo_label : null) ?? p.display_name ?? id;
      },
      canEdit: (id) => {
        if (!editing || id === null || meId === null) return false;
        // The demo household is someone else's; it is never editable here.
        if (roster === "demo") return false;
        if (id === meId) return true;
        return me?.can_edit_all === true || isAdmin;
      },
      meId,
      isAdmin,
      roster,
    };
  }, [people, personId, me, editing, roster]);

  return (
    <PersonContext.Provider value={value}>{children}</PersonContext.Provider>
  );
}

export function usePerson() {
  return React.useContext(PersonContext);
}
