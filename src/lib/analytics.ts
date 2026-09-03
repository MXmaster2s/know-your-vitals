import { supabase } from "@/lib/supabase";

export interface Visitor {
  email: string;
  name: string | null;
  provider: string | null;
  first_seen: string | null;
  last_seen: string | null;
  visits: number;
}

export interface VisitTime {
  email: string;
  path: string;
  viewed_at: string;
}

export interface PageTotal {
  path: string;
  views: number;
}

/** All three are gated inside the database by `is_owner()`, so a guest calling
 *  them directly gets an empty result rather than a list of everyone's email. */
async function rpc<T>(fn: string): Promise<T[]> {
  const { data, error } = await supabase.rpc(fn);
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export const getVisitors = () => rpc<Visitor>("visitor_log");
export const getVisitTimes = () => rpc<VisitTime>("visit_times");
export const getPageTotals = () => rpc<PageTotal>("page_totals");

/** "12 min ago" while that is the useful answer; a date once it isn't. */
export function ago(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

/** "3 Sep, 15:40" — the whole point of the first column, so it carries both. */
export function stamp(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}
