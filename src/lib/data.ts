import { supabase } from "@/lib/supabase";

// ---- Row types (mirror schema.sql) ----------------------------------------

/** A row id from the `people` table. Whoever the owner seeds. */
export type PersonId = string;

export interface Person {
  id: string;
  display_name: string | null;
  dob: string | null; // ISO date
  /** Which sign-in owns this person's rows. Read is shared; writes are not. */
  email: string | null;
  /** Keeps the whole household's records, not only their own. */
  can_edit_all: boolean;
  /** The unit of privacy. Reads are scoped to yours, plus the demo one. */
  household: string | null;
  /** Sees every household, analytics, uploads, settings. */
  is_admin: boolean;
  /** What to call this person on /preview, where strangers look. A role, not
   *  a name — their own view keeps display_name. */
  demo_label: string | null;
}

export interface Report {
  id: string;
  person_id: string;
  taken_on: string; // ISO date
  lab: string | null;
  kind: string | null;
  source_file: string | null;
  notes: string | null;
  /** A visit you intend to take, not one you have. No measurements hang off
   *  it — it exists so the next test stays visible. */
  planned: boolean;
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

/** Everyone in MY household — one person for a newcomer, two for the family. */
export function getPeople(): Promise<Person[]> {
  return unwrap<Person>(supabase.rpc("my_people"));
}

/** The household /preview shows to everyone who signs in. */
export function getDemoPeople(): Promise<Person[]> {
  return unwrap<Person>(supabase.rpc("demo_people"));
}

/** Creates the caller's own person row on first sign-in; a no-op after. It is
 *  the only path that creates a person without an admin, and it can only ever
 *  create the caller's own. */
export async function ensureMe(): Promise<Person> {
  const { data, error } = await supabase.rpc("ensure_me");
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data[0] : data) as Person;
}

export interface Slots {
  served: number;
  total: number;
}

export async function getSlots(): Promise<Slots> {
  const { data, error } = await supabase.rpc("slots_status");
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return { served: Number(row?.served ?? 0), total: Number(row?.total ?? 20) };
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
    .select("id, planned")
    .eq("person_id", input.person_id)
    .eq("taken_on", input.taken_on)
    .limit(1);
  if (findError) throw new Error(findError.message);

  let reportId: string | undefined = existing?.[0]?.id;

  // A scheduled visit stops being scheduled the moment a result lands on it.
  if (reportId && existing?.[0]?.planned) {
    const { error: unplanError } = await supabase
      .from("reports")
      .update({ planned: false })
      .eq("id", reportId);
    if (unplanError) throw new Error(unplanError.message);
  }
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

// ---- Page views ----------------------------------------------------------

export interface ViewCounts {
  last_24h: number;
  lifetime: number;
}

/** Records one page load. The `page_views` table has no RLS policies at all —
 *  this security-definer function is the only way in, so a visitor can add to
 *  the log but can neither read nor tamper with it. */
export async function recordView(path: string): Promise<void> {
  const { error } = await supabase.rpc("record_view", { p: path });
  if (error) throw new Error(error.message);
}

export async function getViewCounts(): Promise<ViewCounts | null> {
  const { data, error } = await supabase.rpc("view_counts");
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return row ? { last_24h: Number(row.last_24h), lifetime: Number(row.lifetime) } : null;
}

// ---- Uploaded reports ----------------------------------------------------

export interface ReportUpload {
  id: string;
  uid: string;
  email: string;
  path: string;
  file_name: string;
  size_bytes: number | null;
  uploaded_at: string;
  /** Stamped once someone has read the PDF and the readings are in. */
  analysed_at: string | null;
}

export const REPORT_MAX_BYTES = 5 * 1024 * 1024;

/** Puts one PDF in the private `reports` bucket under the caller's own folder
 *  and writes the ledger row the Analytics page reads. Storage enforces the
 *  type and size again server-side; the client check is for the message. */
export async function uploadReport(
  file: File,
  user: { id: string; email: string }
): Promise<ReportUpload> {
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
  const path = `${user.id}/${Date.now()}-${safe}`;
  const { error: upErr } = await supabase.storage
    .from("reports")
    .upload(path, file, { contentType: "application/pdf", upsert: false });
  if (upErr) throw new Error(upErr.message);

  const { data, error } = await supabase
    .from("report_uploads")
    .insert({
      uid: user.id,
      email: user.email,
      path,
      file_name: file.name,
      size_bytes: file.size,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ReportUpload;
}

/** Removes the file, then its ledger row. That order on purpose: if the
 *  second step fails the row is still listed and the retry succeeds, whereas
 *  the reverse would leave a file nobody can see or remove. */
export async function deleteReport(path: string): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from("reports")
    .remove([path]);
  if (storageError) throw new Error(storageError.message);

  const { error } = await supabase
    .from("report_uploads")
    .delete()
    .eq("path", path);
  if (error) throw new Error(error.message);
}

/** Whether the signed-in account has paid. Says nothing about anyone else. */
export async function getMyStatus(): Promise<{ paid: boolean }> {
  const { data, error } = await supabase.rpc("my_status");
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return { paid: row?.paid === true };
}

export function getMyUploads(): Promise<ReportUpload[]> {
  return unwrap<ReportUpload>(
    supabase.from("report_uploads").select("*").order("uploaded_at", { ascending: false })
  );
}

/** A short-lived link to one file. Storage RLS decides whether the caller may
 *  have it at all, so a guest asking for someone else's path gets an error. */
export async function signedReportUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("reports")
    .createSignedUrl(path, 60 * 60);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

// ---- Nutrition bootstrap -------------------------------------------------

/** Nutrition is usable without paying, so a newcomer needs a target row to
 *  edit against. Creates one blank active target for your own person, once. */
export async function ensureNutritionTarget(): Promise<void> {
  const { error } = await supabase.rpc("ensure_nutrition_target");
  if (error) throw new Error(error.message);
}

/** A meal is the container everything else in Nutrition hangs off, so a
 *  person with none has nothing to do. RLS scopes the insert to yourself. */
export async function createMeal(input: {
  person_id: string;
  name: string;
  at_time: string | null;
  sort: number;
}): Promise<void> {
  const { error } = await supabase.from("meals").insert(input);
  if (error) throw new Error(error.message);
}

// ---- MCP addresses -------------------------------------------------------

/** One key the account has minted for an AI. The plaintext is never stored;
 *  what the table keeps is a hash, and the browser is not even granted that
 *  column — this is the whole of what it may read. */
export interface McpToken {
  id: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export function getMcpTokens(): Promise<McpToken[]> {
  return unwrap<McpToken>(
    supabase
      .from("mcp_tokens")
      .select("id, label, created_at, last_used_at, revoked_at")
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
  );
}

/** Mints a key and returns the plaintext — the only time it exists outside
 *  the database's hash. Show it once; there is no way to fetch it again. */
export async function createMcpToken(label: string): Promise<string> {
  const { data, error } = await supabase.rpc("mcp_token_create", { p_label: label });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function revokeMcpToken(id: string): Promise<void> {
  const { error } = await supabase.rpc("mcp_token_revoke", { p_id: id });
  if (error) throw new Error(error.message);
}
