import type {
  Dismissal,
  Marker,
  MarkerCategory,
  Measurement,
  QualitativeFinding,
} from "@/lib/data";

// Pure client-side derivations over the fetched rows. No I/O here.

export const CATEGORY_ORDER: MarkerCategory[] = [
  "glycemic",
  "lipids",
  "liver",
  "cbc",
  "kidney",
  "thyroid",
  "vitamins",
  "minerals",
  "other",
];

export const CATEGORY_LABEL: Record<MarkerCategory, string> = {
  glycemic: "Glycemic",
  lipids: "Lipids",
  liver: "Liver",
  cbc: "Blood counts",
  kidney: "Kidney",
  thyroid: "Thyroid",
  vitamins: "Vitamins",
  minerals: "Minerals",
  other: "Other",
};

/** Effective flag: printed H/L wins; otherwise derived from the printed range. */
export function effectiveFlag(m: Measurement): "H" | "L" | null {
  if (m.flag === "H" || m.flag === "L") return m.flag;
  const v = Number(m.value);
  if (m.ref_high != null && v > Number(m.ref_high)) return "H";
  if (m.ref_low != null && v < Number(m.ref_low)) return "L";
  return null;
}

/** How far outside the printed range a measurement sits (0 = inside/unknown). */
export function deviation(m: Measurement): number {
  const v = Number(m.value);
  if (m.ref_high != null && v > Number(m.ref_high)) return v - Number(m.ref_high);
  if (m.ref_low != null && v < Number(m.ref_low)) return Number(m.ref_low) - v;
  return 0;
}

export interface MarkerSeries {
  marker: Marker;
  /** ascending by taken_on */
  points: Measurement[];
  latest: Measurement;
  previous: Measurement | null;
  latestFlag: "H" | "L" | null;
}

/** Group a person's measurements by marker, keeping marker sort order. */
export function seriesByMarker(
  markers: Marker[],
  measurements: Measurement[]
): MarkerSeries[] {
  const byMarker = new Map<string, Measurement[]>();
  for (const m of measurements) {
    const list = byMarker.get(m.marker_id);
    if (list) list.push(m);
    else byMarker.set(m.marker_id, [m]);
  }
  const out: MarkerSeries[] = [];
  for (const marker of markers) {
    const points = byMarker.get(marker.id);
    if (!points || points.length === 0) continue;
    const latest = points[points.length - 1];
    out.push({
      marker,
      points,
      latest,
      previous: points.length > 1 ? points[points.length - 2] : null,
      latestFlag: effectiveFlag(latest),
    });
  }
  return out;
}

export function groupByCategory(
  series: MarkerSeries[]
): { category: MarkerCategory; series: MarkerSeries[] }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    series: series.filter(
      (s) => ((s.marker.category ?? "other") as MarkerCategory) === category
    ),
  })).filter((g) => g.series.length > 0);
}

export type Trend = "worsening" | "improving" | "flat";

/** Attention entries: latest reading per marker that is flagged/out of range. */
export interface AttentionEntry {
  series: MarkerSeries;
  flag: "H" | "L";
  delta: number | null; // latest - previous
  trend: Trend;
}

export function attentionEntries(series: MarkerSeries[]): AttentionEntry[] {
  const out: AttentionEntry[] = [];
  for (const s of series) {
    if (!s.latestFlag) continue;
    let delta: number | null = null;
    let trend: Trend = "flat";
    if (s.previous) {
      delta = Number(s.latest.value) - Number(s.previous.value);
      const now = deviation(s.latest);
      const before = deviation(s.previous);
      if (now > before) trend = "worsening";
      else if (now < before) trend = "improving";
    }
    out.push({ series: s, flag: s.latestFlag, delta, trend });
  }
  return out;
}

/** Findings that still need action (advice/abnormality in the text). */
export function actionableFindings(
  findings: QualitativeFinding[]
): QualitativeFinding[] {
  // Explicit action verbs always mean follow-up is needed.
  const action = /advis|recommend|refer|repeat|follow[- ]?up/i;
  // State words count only when not negated — "Impression: no clinically
  // significant abnormality detected" is a normal result, not an alert.
  const state = /impaired|abnormal|flagged|deficien/i;
  const negated = /\b(?:no|not|without|nil)\b[^.;]{0,60}/gi;
  return findings.filter((f) => {
    const text = `${f.title ?? ""} ${f.detail ?? ""}`;
    return action.test(text) || state.test(text.replace(negated, ""));
  });
}

// ---- formatting -----------------------------------------------------------

export function fmtValue(v: number | string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function fmtRange(m: Measurement): string | null {
  if (m.ref_low != null && m.ref_high != null)
    return `${fmtValue(m.ref_low)}–${fmtValue(m.ref_high)}`;
  if (m.ref_high != null) return `< ${fmtValue(m.ref_high)}`;
  if (m.ref_low != null) return `> ${fmtValue(m.ref_low)}`;
  return null;
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

// ---- Doing well -----------------------------------------------------------

export type PositiveKind = "recovered" | "improving" | "steady";

export interface PositiveEntry {
  series: MarkerSeries;
  kind: PositiveKind;
  delta: number | null; // latest - previous
}

/**
 * Markers worth celebrating: the latest reading is inside its printed range.
 * "recovered" = it was flagged last time and no longer is — the strongest
 * signal, so those sort first. "improving" = still in range but moved further
 * from the edge it was closest to. Everything else in range is "steady".
 */
export function positiveEntries(series: MarkerSeries[]): PositiveEntry[] {
  const out: PositiveEntry[] = [];
  for (const s of series) {
    if (s.latestFlag) continue; // flagged → belongs in Needs attention
    if (s.latest.ref_low == null && s.latest.ref_high == null) continue;

    let kind: PositiveKind = "steady";
    let delta: number | null = null;
    if (s.previous) {
      delta = Number(s.latest.value) - Number(s.previous.value);
      if (effectiveFlag(s.previous)) kind = "recovered";
      else if (headroom(s.latest) > headroom(s.previous)) kind = "improving";
    }
    out.push({ series: s, kind, delta });
  }
  const rank: Record<PositiveKind, number> = {
    recovered: 0,
    improving: 1,
    steady: 2,
  };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind]);
}

/** Distance from the nearest edge of the printed range (bigger = safer). */
function headroom(m: Measurement): number {
  const v = Number(m.value);
  const gaps: number[] = [];
  if (m.ref_high != null) gaps.push(Number(m.ref_high) - v);
  if (m.ref_low != null) gaps.push(v - Number(m.ref_low));
  return gaps.length ? Math.min(...gaps) : 0;
}

// ---- Dismissals -----------------------------------------------------------

export interface DismissalSet {
  has: (kind: Dismissal["kind"], refId: string) => boolean;
  size: number;
}

export function dismissalSet(dismissals: Dismissal[]): DismissalSet {
  const keys = new Set(dismissals.map((d) => `${d.kind}:${d.ref_id}`));
  return { has: (kind, refId) => keys.has(`${kind}:${refId}`), size: keys.size };
}

// ---- Filtering ------------------------------------------------------------

/**
 * Series as they stood at one report. Keeps the full history up to that date
 * (so sparklines and "vs previous" still work) but drops any marker that
 * report did not measure, and pins `latest` to that report's reading.
 */
export function seriesAsOf(
  markers: Marker[],
  measurements: Measurement[],
  takenOn: string | null
): MarkerSeries[] {
  if (!takenOn) return seriesByMarker(markers, measurements);
  const upTo = measurements.filter((m) => m.taken_on <= takenOn);
  return seriesByMarker(markers, upTo).filter(
    (s) => s.latest.taken_on === takenOn
  );
}

/** Case-insensitive match on the marker's display name or id. */
export function matchesQuery(s: MarkerSeries, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    (s.marker.name ?? "").toLowerCase().includes(q) ||
    s.marker.id.toLowerCase().includes(q) ||
    (s.marker.category ?? "").toLowerCase().includes(q)
  );
}

// ---- Narration & export ---------------------------------------------------

/** One or two plain sentences describing what the chart is showing. */
export function trendSummary(s: MarkerSeries): string {
  const { points, latest, marker } = s;
  const unit = latest.unit ?? marker.unit ?? "";
  const u = unit ? ` ${unit}` : "";
  const flag = effectiveFlag(latest);
  const where = flag
    ? `currently ${flag === "H" ? "above" : "below"} the printed range`
    : latest.ref_low != null || latest.ref_high != null
      ? "currently inside the printed range"
      : "no printed range to compare against";

  if (points.length < 2) {
    return `A single reading of ${fmtValue(latest.value)}${u} on ${fmtDate(
      latest.taken_on
    )} — ${where}. Another test is needed before a trend means anything.`;
  }

  const first = points[0];
  const change = Number(latest.value) - Number(first.value);
  const pct =
    Number(first.value) !== 0
      ? Math.round((change / Math.abs(Number(first.value))) * 100)
      : null;
  const dir = change > 0 ? "up" : change < 0 ? "down" : "unchanged";
  const move =
    change === 0
      ? "unchanged"
      : `${dir} ${fmtValue(Math.abs(change))}${u}${pct !== null ? ` (${Math.abs(pct)}%)` : ""}`;

  return `${points.length} readings from ${fmtDate(first.taken_on)} to ${fmtDate(
    latest.taken_on
  )} — ${move} overall, ${where}. The shaded band is the range that lab printed.`;
}

/** Plain-text dump of one marker, shaped for pasting into a chat with an AI. */
export function buildMarkerCopy(
  s: MarkerSeries,
  personLabel: string,
  labByDate?: Map<string, string>
): string {
  const { marker, latest, points } = s;
  const unit = latest.unit ?? marker.unit ?? "";
  const lines: string[] = [];

  lines.push(`${marker.name ?? marker.id} — ${personLabel}`);
  if (marker.description) lines.push(marker.description);
  lines.push("");
  lines.push(
    `Latest: ${fmtValue(latest.value)}${unit ? " " + unit : ""} on ${fmtDate(
      latest.taken_on
    )}${fmtRange(latest) ? ` (printed range ${fmtRange(latest)})` : ""}${
      effectiveFlag(latest) ? ` — flagged ${effectiveFlag(latest)}` : " — in range"
    }`
  );
  lines.push("");
  lines.push("All readings:");
  for (const p of points) {
    const lab = labByDate?.get(p.taken_on);
    const f = effectiveFlag(p);
    lines.push(
      `  ${fmtDate(p.taken_on)}: ${fmtValue(p.value)}${
        p.unit ?? unit ? " " + (p.unit ?? unit) : ""
      }${fmtRange(p) ? ` (range ${fmtRange(p)})` : ""}${f ? ` [${f}]` : ""}${
        lab ? ` — ${lab}` : ""
      }`
    );
  }
  lines.push("");
  lines.push(trendSummary(s));
  return lines.join("\n");
}

/** Compact date for cards: "28 Aug 26". */
export function fmtDateCompact(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}
