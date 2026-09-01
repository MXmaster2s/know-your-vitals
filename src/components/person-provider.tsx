"use client";

import * as React from "react";
import { getPeople, type Person, type PersonId } from "@/lib/data";

interface PersonContextValue {
  /** null until the roster has loaded. */
  personId: PersonId | null;
  setPersonId: (id: PersonId) => void;
  people: Person[];
  labelFor: (id: PersonId | null) => string;
}

const PersonContext = React.createContext<PersonContextValue>({
  personId: null,
  setPersonId: () => {},
  people: [],
  labelFor: (id) => id ?? "",
});

/**
 * Who the vault is tracking. The roster comes from the `people` table, so the
 * app carries no names of its own — seed whoever you like.
 */
export function PersonProvider({ children }: { children: React.ReactNode }) {
  const [people, setPeople] = React.useState<Person[]>([]);
  const [personId, setPersonId] = React.useState<PersonId | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getPeople()
      .then((rows) => {
        if (cancelled) return;
        setPeople(rows);
        setPersonId((cur) => cur ?? rows[0]?.id ?? null);
      })
      .catch(() => {
        /* the pages surface their own load errors */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = React.useMemo<PersonContextValue>(() => {
    const byId = new Map(people.map((p) => [p.id, p]));
    return {
      personId,
      setPersonId,
      people,
      labelFor: (id) => (id ? (byId.get(id)?.display_name ?? id) : ""),
    };
  }, [people, personId]);

  return (
    <PersonContext.Provider value={value}>{children}</PersonContext.Provider>
  );
}

export function usePerson() {
  return React.useContext(PersonContext);
}
