"use client";

import * as React from "react";
import { getPeople, type Person, type PersonId } from "@/lib/data";
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
  /** The person the signed-in email belongs to, null if it matches nobody. */
  meId: PersonId | null;
}

export const PersonContext = React.createContext<PersonContextValue>({
  personId: null,
  setPersonId: () => {},
  people: [],
  labelFor: (id) => id ?? "",
  canEdit: () => false,
  meId: null,
});

/**
 * Who the vault is tracking. The roster comes from the `people` table, so the
 * app carries no names of its own — seed whoever you like.
 */
export function PersonProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const { editing } = useEditMode();
  const [people, setPeople] = React.useState<Person[]>([]);
  const [personId, setPersonId] = React.useState<PersonId | null>(null);

  // Read through a ref so the roster fetch stays a mount-once effect.
  const emailRef = React.useRef<string | null>(null);
  emailRef.current = session?.user?.email?.toLowerCase() ?? null;

  React.useEffect(() => {
    let cancelled = false;
    getPeople()
      .then((rows) => {
        if (cancelled) return;
        setPeople(rows);
        // Open on yourself. Falling back to the first row alphabetically meant
        // the app greeted Rohit with Aditi's page on every refresh.
        const mine = rows.find(
          (r) => r.email?.toLowerCase() === emailRef.current
        );
        setPersonId((cur) => cur ?? mine?.id ?? rows[0]?.id ?? null);
      })
      .catch(() => {
        /* the pages surface their own load errors */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const email = session?.user?.email?.toLowerCase() ?? null;

  const value = React.useMemo<PersonContextValue>(() => {
    const byId = new Map(people.map((p) => [p.id, p]));
    const meId =
      people.find((p) => p.email?.toLowerCase() === email)?.id ?? null;
    return {
      personId,
      setPersonId,
      people,
      labelFor: (id) => (id ? (byId.get(id)?.display_name ?? id) : ""),
      canEdit: (id) => {
        if (!editing) return false;
        if (id === null || meId === null) return false;
        if (id === meId) return true;
        // Whoever keeps the records may edit everyone's.
        return people.find((p) => p.id === meId)?.can_edit_all === true;
      },
      meId,
    };
  }, [people, personId, email, editing]);

  return (
    <PersonContext.Provider value={value}>{children}</PersonContext.Provider>
  );
}

export function usePerson() {
  return React.useContext(PersonContext);
}
