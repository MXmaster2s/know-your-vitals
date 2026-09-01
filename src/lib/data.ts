import { supabase } from "@/lib/supabase";

// ---- Row types (mirror schema.sql) ----------------------------------------

/** A row id from the `people` table. Whoever the owner seeds. */
export type PersonId = string;

export interface Person {
  id: string;
  display_name: string | null;
  dob: string | null; // ISO date
}

export interface Report {
  id: string;
  person_id: string;
  taken_on: string; // ISO date
  lab: string | null;
  kind: string | null;
  source_file: string | null;
  notes: string | null;
}

export type MarkerCategory =
  | "glycemic"
  | "lipids"
  | "cbc"
  | "liver"
  | "kidney"
  | "thyroid"
  | "vitamins"
  | "minerals"
  | "other";

export interface Marker {
  id: string;
  name: string | null;
  description: string | null;
  category: MarkerCategory | string | null;
  unit: string | null;
  sort: number | null;
}

export interface Measurement {
  id: string;
  report_id: string;
  person_id: string;
  marker_id: string;
  value: number;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  flag: "H" | "L" | null;
  taken_on: string; // ISO date
}

export interface QualitativeFinding {
  id: string;
  person_id: string | null;
  taken_on: string | null; // ISO date
  kind: string | null;
  title: string | null;
  detail: string | null;
}

// ---- Fetch helpers (single round-trip each) -------------------------------

interface QueryResult<T> {
  data: T | null;
  error: { message: string } | null;
}

async function unwrap<T>(query: PromiseLike<QueryResult<T[]>>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function getPeople(): Promise<Person[]> {
  return unwrap<Person>(supabase.from("people").select("*").order("id"));
}

export function getMarkers(): Promise<Marker[]> {
  return unwrap<Marker>(
    supabase.from("markers").select("*").order("sort", { ascending: true })
  );
}

export function getMeasurements(personId: string): Promise<Measurement[]> {
  return unwrap<Measurement>(
    supabase
      .from("measurements")
      .select("*")
      .eq("person_id", personId)
      .order("taken_on", { ascending: true })
  );
}

export function getReports(personId: string): Promise<Report[]> {
  return unwrap<Report>(
    supabase
      .from("reports")
      .select("*")
      .eq("person_id", personId)
      .order("taken_on", { ascending: true })
  );
}

/** All measurements of one marker across BOTH people (comparison chart). */
export function getMeasurementsForMarker(
  markerId: string
): Promise<Measurement[]> {
  return unwrap<Measurement>(
    supabase
      .from("measurements")
      .select("*")
      .eq("marker_id", markerId)
      .order("taken_on", { ascending: true })
  );
}

/** All reports for both people (lab names in the comparison tooltip). */
export function getAllReports(): Promise<Report[]> {
  return unwrap<Report>(
    supabase.from("reports").select("*").order("taken_on", { ascending: true })
  );
}

export interface NewMeasurement {
  person_id: string;
  marker_id: string;
  taken_on: string; // ISO date
  value: number;
  unit: string | null;
}

/**
 * Manual entry. Every measurement hangs off a report row, so reuse the
 * person's report for that date if one exists, otherwise create an ad-hoc
 * kind:"manual" report. No printed range — RLS gates who may write.
 */
export async function addMeasurement(input: NewMeasurement): Promise<void> {
  const { data: existing, error: findError } = await supabase
    .from("reports")
    .select("id")
    .eq("person_id", input.person_id)
    .eq("taken_on", input.taken_on)
    .limit(1);
  if (findError) throw new Error(findError.message);

  let reportId: string | undefined = existing?.[0]?.id;
  if (!reportId) {
    const { data: created, error: createError } = await supabase
      .from("reports")
      .insert({
        person_id: input.person_id,
        taken_on: input.taken_on,
        kind: "manual",
      })
      .select("id")
      .single();
    if (createError) throw new Error(createError.message);
    reportId = created.id;
  }

  const { error } = await supabase
    .from("measurements")
    .insert({ ...input, report_id: reportId });
  if (error) throw new Error(error.message);
}

export function getFindings(personId: string): Promise<QualitativeFinding[]> {
  return unwrap<QualitativeFinding>(
    supabase
      .from("qualitative_findings")
      .select("*")
      .eq("person_id", personId)
      .order("taken_on", { ascending: true })
  );
}

// ---- Dismissals -----------------------------------------------------------

export interface Dismissal {
  person_id: string;
  kind: "measurement" | "finding";
  ref_id: string;
  dismissed_at: string;
}

export function getDismissals(personId: string): Promise<Dismissal[]> {
  return unwrap<Dismissal>(
    supabase.from("dismissals").select("*").eq("person_id", personId)
  );
}

/** Hide one attention card. Keyed on the specific measurement/finding id, so a
 *  later flagged reading for the same marker surfaces again on its own. */
export async function dismiss(
  personId: string,
  kind: Dismissal["kind"],
  refId: string
): Promise<void> {
  const { error } = await supabase
    .from("dismissals")
    .upsert(
      { person_id: personId, kind, ref_id: refId },
      { onConflict: "person_id,kind,ref_id" }
    );
  if (error) throw new Error(error.message);
}

export async function undismiss(
  personId: string,
  kind: Dismissal["kind"],
  refId: string
): Promise<void> {
  const { error } = await supabase
    .from("dismissals")
    .delete()
    .eq("person_id", personId)
    .eq("kind", kind)
    .eq("ref_id", refId);
  if (error) throw new Error(error.message);
}
