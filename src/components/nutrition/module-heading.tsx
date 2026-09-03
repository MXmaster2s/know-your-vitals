/**
 * Every module on this page carries a visible name, so a change can be asked
 * for by pointing at one ("the Edit food module") rather than described.
 */
export function ModuleHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="font-serif text-lg leading-tight">{children}</h2>;
}
