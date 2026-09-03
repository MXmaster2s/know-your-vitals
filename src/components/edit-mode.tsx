"use client";

import * as React from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

const EditModeContext = React.createContext<{
  editing: boolean;
  setEditing: (v: boolean) => void;
}>({ editing: false, setEditing: () => {} });

/**
 * Reading and editing are different activities, and this app is read far more
 * often than it is written. Editing is off until it is asked for, so a stray
 * tap on a phone lands on the page rather than in a text field.
 *
 * Deliberately not persisted: every visit starts in reading mode.
 */
export function EditModeProvider({ children }: { children: React.ReactNode }) {
  const [editing, setEditing] = React.useState(false);
  const value = React.useMemo(() => ({ editing, setEditing }), [editing]);
  return (
    <EditModeContext.Provider value={value}>{children}</EditModeContext.Provider>
  );
}

export function useEditMode() {
  return React.useContext(EditModeContext);
}

export function EditModeToggle() {
  const { editing, setEditing } = useEditMode();
  return (
    <Button
      variant={editing ? "default" : "outline"}
      size="icon"
      aria-pressed={editing}
      aria-label={editing ? "Finish editing" : "Edit"}
      title={editing ? "Editing on — click to finish" : "Edit"}
      onClick={() => setEditing(!editing)}
      className="cursor-pointer"
    >
      <Pencil className="size-4" strokeWidth={1.75} aria-hidden />
    </Button>
  );
}
