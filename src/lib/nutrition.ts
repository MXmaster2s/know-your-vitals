import { supabase } from "@/lib/supabase";

// ---- Row types (mirror supabase/nutrition.sql) ----------------------------

export interface Food {
  id: string;
  name: string;
  category: string | null;
  kcal: number | null;
  protein_g: number | null;
  carb_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  /** ₹ per kg as purchased. */
  price_per_unit: number | null;
  /** @deprecated Read by nothing. Kept as the source the per-unit figures
   *  were seeded from. `edible_g_per_unit` is the live one. */
  edible_yield: number;
  /** How this ingredient is bought and measured. Every figure below is per
   *  ONE of these — per kilo, per litre, or per piece — and a serving says how
   *  many g / ml / pieces of it were eaten. */
  base_unit: BaseUnit;
  /** Per one base unit, AS PURCHASED: bone, shell and peel included. */
  kcal_per_unit: number | null;
  carb_g_per_unit: number | null;
  fat_g_per_unit: number | null;
  fiber_g_per_unit: number | null;
  /** Protein in one kg AS PURCHASED — bone, shell and peel included, which is
   *  what makes cost ÷ protein an honest comparison between two things on a
   *  price board. Null until looked up; never zero. */
  protein_g_per_unit: number | null;
  /** How much of a purchased kg is food rather than waste. Read by nothing —
   *  it measures the buy, it does not enter any calculation. */
  edible_g_per_unit: number | null;
  /** Micronutrients, same basis as the macros: per ONE base unit as purchased.
   *  Null is unknown and never zero, so a day total can say how much of itself
   *  is actually accounted for. */
  iron_mg_per_unit: number | null;
  calcium_mg_per_unit: number | null;
  magnesium_mg_per_unit: number | null;
  potassium_mg_per_unit: number | null;
  zinc_mg_per_unit: number | null;
  selenium_ug_per_unit: number | null;
  folate_ug_per_unit: number | null;
  b12_ug_per_unit: number | null;
  vit_c_mg_per_unit: number | null;
  vit_d_ug_per_unit: number | null;
  vit_a_ug_per_unit: number | null;
  omega3_g_per_unit: number | null;
  /** What one piece weighs, when this is a thing you count rather than weigh. */
  grams_per_piece: number | null;
  /** What one ml weighs. Most liquids are ~1; oil is ~0.91. */
  grams_per_ml: number | null;
  /** What this food is worth eating FOR, in plain words — the Nutrition
   *  column. Curated, not computed. */
  nutrients: string | null;
  /** Where the numbers came from, so they can be re-checked. */
  source_url: string | null;
  notes: string | null;
  sort: number | null;
}

export interface Meal {
  id: string;
  person_id: string;
  name: string;
  time_note: string | null;
  /** 24h clock, "HH:MM:SS". The day sorts on this. */
  at_time: string | null;
  /** What the day table's Food column shows. Adding or removing a Food keeps
   *  it in step, but it is free text and the owner's to overwrite. */
  food_summary: string | null;
  sort: number | null;
}

/** A named thing inside a meal — "Salad", "Smoothie" — holding ingredients. */
export interface MealFood {
  id: string;
  meal_id: string;
  name: string;
  sort: number | null;
}

/** What one of an ingredient is. Chosen on the ingredient, not the serving —
 *  an egg is counted however often you eat it. */
export type BaseUnit = "kg" | "l" | "piece";

export const BASE_UNITS: {
  value: BaseUnit;
  label: string;
  /** What the figures are stated per. */
  rate: string;
  /** What a serving of it is counted in. */
  amount: string;
  hint: string;
}[] = [
  { value: "kg", label: "Weight", rate: "kg", amount: "g", hint: "Figures per kilo, servings in grams" },
  { value: "l", label: "Volume", rate: "litre", amount: "ml", hint: "Figures per litre, servings in millilitres" },
  { value: "piece", label: "Count", rate: "piece", amount: "pieces", hint: "Figures per piece, servings in pieces" },
];

export function unitOf(base: BaseUnit) {
  return BASE_UNITS.find((u) => u.value === base) ?? BASE_UNITS[0];
}

/** How many base units a serving is. Grams and millilitres are thousandths of
 *  their unit; a piece is the unit. */
export function unitsIn(qty: number, base: BaseUnit): number {
  return base === "piece" ? qty : qty / 1000;
}

/** Legacy: still the column name on meal_items for the old gram amount. */
export type AmountUnit = "g" | "ml" | "piece";

export interface MealItem {
  id: string;
  meal_id: string;
  food_id: string;
  /** How much of the ingredient this serving is, in whatever the ingredient
   *  is measured in: grams, millilitres, or pieces. */
  qty: number | null;
  /** @deprecated The gram amount `qty` was migrated from. */
  qty_g: number;
  /** What this item cost in this meal, in rupees. A fact the owner states —
   *  never derived from a rate, because the rate is the vaguer number. */
  price: number | null;
  /** How the amount is entered and shown. Grams stay canonical either way. */
  amount_unit: AmountUnit;
  comments: string | null;
  /** Which Food inside the meal this ingredient belongs to. */
  meal_food_id: string | null;
  sort: number | null;
}

export interface NutritionTarget {
  id: string;
  person_id: string;
  label: string;
  starts_on: string | null;
  ends_on: string | null;
  kcal: number | null;
  protein_g: number | null;
  carb_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  iron_mg: number | null;
  calcium_mg: number | null;
  magnesium_mg: number | null;
  potassium_mg: number | null;
  zinc_mg: number | null;
  selenium_ug: number | null;
  folate_ug: number | null;
  b12_ug: number | null;
  vit_c_mg: number | null;
  vit_d_ug: number | null;
  vit_a_ug: number | null;
  omega3_g: number | null;
  is_active: boolean;
  notes: string | null;
  sort: number | null;
}

export interface ActivityTarget {
  id: string;
  person_id: string;
  label: string;
  target: string | null;
  current: string | null;
  due_on: string | null;
  sort: number | null;
}

// ---- Fetch ---------------------------------------------------------------

interface QueryResult<T> {
  data: T | null;
  error: { message: string } | null;
}

async function unwrap<T>(query: PromiseLike<QueryResult<T[]>>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** PostgREST `in.(…)` list. Household names are slugs or auth ids, but quote
 *  them anyway so a value can never end the list early. */
function inList(values: string[]): string {
  return `(${values.map((v) => JSON.stringify(v)).join(",")})`;
}

/** Which households' ingredients this screen may show: the ones on screen,
 *  plus shared reference rows (`household is null`). Without the filter an
 *  admin's picker fills up with every other household's foods. */
function foodScope(households: string[]): string {
  const named = households.filter(Boolean);
  return named.length === 0
    ? "household.is.null"
    : `household.is.null,household.in.${inList(named)}`;
}

export function getFoods(households: string[]): Promise<Food[]> {
  return unwrap<Food>(
    supabase
      .from("foods")
      .select("*")
      .or(foodScope(households))
      .order("sort")
      .order("name")
  );
}

export function getMeals(personId: string): Promise<Meal[]> {
  return unwrap<Meal>(
    supabase
      .from("meals")
      .select("*")
      .eq("person_id", personId)
      .order("at_time", { ascending: true, nullsFirst: false })
      .order("sort")
  );
}

export function getMealFoods(mealIds: string[]): Promise<MealFood[]> {
  if (mealIds.length === 0) return Promise.resolve([]);
  return unwrap<MealFood>(
    supabase.from("meal_foods").select("*").in("meal_id", mealIds).order("sort")
  );
}

export function getMealItems(mealIds: string[]): Promise<MealItem[]> {
  if (mealIds.length === 0) return Promise.resolve([]);
  return unwrap<MealItem>(
    supabase.from("meal_items").select("*").in("meal_id", mealIds).order("sort")
  );
}

export function getNutritionTargets(
  personId: string
): Promise<NutritionTarget[]> {
  return unwrap<NutritionTarget>(
    supabase
      .from("nutrition_targets")
      .select("*")
      .eq("person_id", personId)
      .order("sort")
  );
}

export function getActivityTargets(
  personId: string
): Promise<ActivityTarget[]> {
  return unwrap<ActivityTarget>(
    supabase
      .from("activity_targets")
      .select("*")
      .eq("person_id", personId)
      .order("sort")
  );
}

// ---- Write ---------------------------------------------------------------

async function run(p: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await p;
  if (error) throw new Error(error.message);
}

export function updateFood(id: string, patch: Partial<Food>) {
  return run(supabase.from("foods").update(patch).eq("id", id));
}

export function insertFood(row: Partial<Food> & { id: string; name: string }) {
  return run(supabase.from("foods").insert(row));
}

export function deleteFood(id: string) {
  return run(supabase.from("foods").delete().eq("id", id));
}

export function updateMealItem(id: string, patch: Partial<MealItem>) {
  return run(supabase.from("meal_items").update(patch).eq("id", id));
}

export function updateMeal(id: string, patch: Partial<Meal>) {
  return run(supabase.from("meals").update(patch).eq("id", id));
}

export function insertMealItem(row: {
  meal_id: string;
  meal_food_id: string;
  food_id: string;
  qty: number;
  sort?: number;
  comments?: string | null;
}) {
  return run(supabase.from("meal_items").insert(row));
}

export function updateMealFood(id: string, patch: Partial<MealFood>) {
  return run(supabase.from("meal_foods").update(patch).eq("id", id));
}

export async function insertMealFood(row: {
  meal_id: string;
  name: string;
  sort?: number;
}): Promise<string> {
  const { data, error } = await supabase
    .from("meal_foods")
    .insert(row)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export function deleteMealFood(id: string) {
  return run(supabase.from("meal_foods").delete().eq("id", id));
}

export function deleteMealItem(id: string) {
  return run(supabase.from("meal_items").delete().eq("id", id));
}

export function updateNutritionTarget(id: string, patch: Partial<NutritionTarget>) {
  return run(supabase.from("nutrition_targets").update(patch).eq("id", id));
}

export function updateActivityTarget(id: string, patch: Partial<ActivityTarget>) {
  return run(supabase.from("activity_targets").update(patch).eq("id", id));
}

// ---- Derivations ---------------------------------------------------------

export interface Totals {
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number;
  cost: number;
  iron_mg: number;
  calcium_mg: number;
  magnesium_mg: number;
  potassium_mg: number;
  zinc_mg: number;
  selenium_ug: number;
  folate_ug: number;
  b12_ug: number;
  vit_c_mg: number;
  vit_d_ug: number;
  vit_a_ug: number;
  omega3_g: number;
}

/**
 * One row per thing the day is counted in. Everything that adds a day up —
 * the totals, the cards, the breakdown, the MCP payload — walks this list, so
 * a new nutrient is one entry here plus one column at each end, never a
 * thirteenth place to forget.
 */
export interface NutrientDef {
  key: keyof Totals;
  /** The per-unit rate on the ingredient. */
  col: keyof Food;
  /** The matching column on the target row; cost has none. */
  target: keyof NutritionTarget | null;
  label: string;
  unit: string;
  /** Decimals worth showing. Micrograms of B12 need one; calories need none. */
  dp: number;
  micro: boolean;
}

export const NUTRIENTS: NutrientDef[] = [
  { key: "kcal", col: "kcal_per_unit", target: "kcal", label: "Calories", unit: "kcal", dp: 0, micro: false },
  { key: "protein_g", col: "protein_g_per_unit", target: "protein_g", label: "Protein", unit: "g", dp: 0, micro: false },
  { key: "carb_g", col: "carb_g_per_unit", target: "carb_g", label: "Carbs", unit: "g", dp: 0, micro: false },
  { key: "fat_g", col: "fat_g_per_unit", target: "fat_g", label: "Fat", unit: "g", dp: 0, micro: false },
  { key: "fiber_g", col: "fiber_g_per_unit", target: "fiber_g", label: "Fibre", unit: "g", dp: 0, micro: false },
  { key: "cost", col: "price_per_unit", target: null, label: "Food cost", unit: "₹", dp: 0, micro: false },
  { key: "iron_mg", col: "iron_mg_per_unit", target: "iron_mg", label: "Iron", unit: "mg", dp: 1, micro: true },
  { key: "calcium_mg", col: "calcium_mg_per_unit", target: "calcium_mg", label: "Calcium", unit: "mg", dp: 0, micro: true },
  { key: "vit_d_ug", col: "vit_d_ug_per_unit", target: "vit_d_ug", label: "Vitamin D", unit: "µg", dp: 1, micro: true },
  { key: "b12_ug", col: "b12_ug_per_unit", target: "b12_ug", label: "Vitamin B12", unit: "µg", dp: 1, micro: true },
  { key: "folate_ug", col: "folate_ug_per_unit", target: "folate_ug", label: "Folate", unit: "µg", dp: 0, micro: true },
  { key: "magnesium_mg", col: "magnesium_mg_per_unit", target: "magnesium_mg", label: "Magnesium", unit: "mg", dp: 0, micro: true },
  { key: "potassium_mg", col: "potassium_mg_per_unit", target: "potassium_mg", label: "Potassium", unit: "mg", dp: 0, micro: true },
  { key: "zinc_mg", col: "zinc_mg_per_unit", target: "zinc_mg", label: "Zinc", unit: "mg", dp: 1, micro: true },
  { key: "selenium_ug", col: "selenium_ug_per_unit", target: "selenium_ug", label: "Selenium", unit: "µg", dp: 0, micro: true },
  { key: "vit_c_mg", col: "vit_c_mg_per_unit", target: "vit_c_mg", label: "Vitamin C", unit: "mg", dp: 0, micro: true },
  { key: "vit_a_ug", col: "vit_a_ug_per_unit", target: "vit_a_ug", label: "Vitamin A", unit: "µg", dp: 0, micro: true },
  { key: "omega3_g", col: "omega3_g_per_unit", target: "omega3_g", label: "Omega-3", unit: "g", dp: 1, micro: true },
];

export const nutrientBy = (key: string): NutrientDef | undefined =>
  NUTRIENTS.find((n) => n.key === key);

/** How a figure for this nutrient reads on its own. Cost is the one that
 *  wears its unit in front. */
export function nutrientValue(n: NutrientDef, v: number): string {
  if (n.key === "cost") return rupees(v);
  return `${v.toLocaleString("en-IN", { maximumFractionDigits: n.dp })} ${n.unit}`;
}

export const ZERO: Totals = Object.fromEntries(
  NUTRIENTS.map((n) => [n.key, 0])
) as unknown as Totals;

/**
 * What one serving contributes. `qty_g` is the weight that went on the scale
 * and every figure on the food is per kg of exactly that weight, so this is a
 * single multiplication with nothing hidden in it.
 *
 * Both nutrition and cost are derived. The ingredient is the one place either
 * is stated, which is what stops the same fact being edited in two tables and
 * disagreeing with itself.
 */
export function itemTotals(item: MealItem, food: Food | undefined): Totals {
  const out = { ...ZERO };
  if (!food) return out;
  const u = unitsIn(item.qty ?? 0, food.base_unit);
  const bag = out as unknown as Record<string, number>;
  for (const n of NUTRIENTS) {
    const rate = food[n.col] as number | null | undefined;
    if (rate !== null && rate !== undefined) bag[n.key] = rate * u;
  }
  return out;
}

/** What one serving contributes of one nutrient, or null when the ingredient
 *  has no figure for it. Null is the whole point: it is not zero, and a total
 *  that swallows it is quietly wrong (R5). */
export function itemOne(
  item: MealItem,
  food: Food | undefined,
  n: NutrientDef
): number | null {
  if (!food) return null;
  const rate = food[n.col] as number | null | undefined;
  if (rate === null || rate === undefined) return null;
  return rate * unitsIn(item.qty ?? 0, food.base_unit);
}

/** Lowercased, unaccented, and with every run of punctuation turned into a
 *  single space, so "Toor / masoor dal (dry)" tokenises the way it reads. */
function norm(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Ingredients matching what has been typed so far.
 *
 * Every whitespace-separated piece of the query has to appear somewhere in the
 * name, in any order — "bre chi" finds "Chicken breast, boneless" just as
 * "chicken br" does, because nobody reliably remembers whether they filed it
 * under the cut or the animal.
 *
 * Ranked by how early the match starts and whether it lands on a word
 * boundary, so typing "ch" puts "Chicken" above "Hung curd", then by the
 * shorter name, then alphabetically so the order never wobbles.
 */
export function matchFoods(foods: Food[], query: string, limit = 8): Food[] {
  const tokens = norm(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return [];
  const scored: { food: Food; score: number }[] = [];
  for (const food of foods) {
    const name = norm(food.name);
    let score = 0;
    let ok = true;
    for (const t of tokens) {
      const at = name.indexOf(t);
      if (at < 0) {
        ok = false;
        break;
      }
      const wordStart = at === 0 || name[at - 1] === " ";
      score += (at === 0 ? 0 : wordStart ? 40 : 120) + Math.min(at, 40);
    }
    if (ok) scored.push({ food, score: score / tokens.length });
  }
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      a.food.name.length - b.food.name.length ||
      a.food.name.localeCompare(b.food.name)
  );
  return scored.slice(0, limit).map((x) => x.food);
}

/** True when the ingredient has nutrition figures at all. A food added by name
 *  has none yet, and counting it as zero would quietly under-report the day. */
export function hasFigures(food: Food | undefined): boolean {
  return !!food && food.kcal_per_unit !== null;
}

/** True when a rupee rate exists to derive a serving price from. */
export function hasRate(food: Food | undefined): boolean {
  return !!food && food.price_per_unit !== null;
}

/** What a gram of protein costs. Derived, so it cannot disagree with the two
 *  figures beside it. */
export function perGramProtein(food: Food): number | null {
  const cost = food.price_per_unit;
  const protein = food.protein_g_per_unit;
  if (cost === null || protein === null || !protein) return null;
  return cost / protein;
}

/** ₹1.26 rather than ₹1 — at this scale the paise are the comparison. */
export const rupees2 = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function sumTotals(list: Totals[]): Totals {
  const out = { ...ZERO };
  const bag = out as unknown as Record<string, number>;
  for (const t of list) {
    const one = t as unknown as Record<string, number>;
    for (const n of NUTRIENTS) bag[n.key] += one[n.key] ?? 0;
  }
  return out;
}

export function mealTotals(
  items: MealItem[],
  foodById: Map<string, Food>
): Totals {
  return sumTotals(items.map((i) => itemTotals(i, foodById.get(i.food_id))));
}




export type Verdict = "under" | "on" | "over";

/** Within 7% counts as on target — tighter than that is false precision when
 *  the inputs are kitchen-scale weights and reference-table nutrition. */
export function verdict(actual: number, target: number | null): Verdict | null {
  if (!target) return null;
  const ratio = actual / target;
  if (ratio < 0.93) return "under";
  if (ratio > 1.07) return "over";
  return "on";
}

export const fmt1 = (n: number) =>
  n.toLocaleString("en-IN", { maximumFractionDigits: 1 });

export const fmt0 = (n: number) =>
  n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

export const rupees = (n: number) =>
  `₹${n.toLocaleString("en-IN", { maximumFractionDigits: n < 10 ? 2 : 0 })}`;

// ---- Display helpers -----------------------------------------------------

/** Grams in one of whatever unit this is. Null when the conversion is not
 *  known yet — a food counted in pieces nobody has weighed. */
export function unitFactor(
  unit: AmountUnit,
  food: Food | undefined
): number | null {
  if (unit === "g") return 1;
  if (unit === "ml") return food?.grams_per_ml ?? 1;
  return food?.grams_per_piece ?? null;
}

/** What the amount cell shows — grams, millilitres, or a count. */
export function displayAmount(item: MealItem, food: Food | undefined): number {
  const f = unitFactor(item.amount_unit, food);
  if (!f) return item.qty_g;
  return Math.round((item.qty_g / f) * 100) / 100;
}

/** Inverse of displayAmount — what to store when someone types "0.5 pieces". */
export function gramsFromAmount(
  amount: number,
  unit: AmountUnit,
  food: Food | undefined
): number {
  const f = unitFactor(unit, food) ?? 1;
  return Math.round(amount * f * 100) / 100;
}

/** A slug that is stable, readable, and safe as a primary key. */
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "item"
  );
}

/**
 * Adding an ingredient by typing its name. Reuses the food if the household
 * already has one by that name, otherwise creates a bare row — no nutrition,
 * no price — for the numbers to be filled in afterwards.
 */
export async function findOrCreateFood(
  rawName: string,
  households: string[]
): Promise<string> {
  const name = tidyLabel(rawName);
  if (!name) throw new Error("Name required");

  const { data: found, error: findErr } = await supabase
    .from("foods")
    .select("id")
    .or(foodScope(households))
    .ilike("name", name)
    .limit(1);
  if (findErr) throw new Error(findErr.message);
  if (found?.[0]) return found[0].id as string;

  const base = slugify(name);
  for (let n = 0; n < 20; n++) {
    const id = n === 0 ? base : `${base}-${n + 1}`;
    const { error } = await supabase.from("foods").insert({ id, name });
    if (!error) return id;
    // 23505 is a duplicate key — try the next suffix; anything else is real.
    if (!String(error.message).toLowerCase().includes("duplicate")) {
      throw new Error(error.message);
    }
  }
  throw new Error(`Could not find a free id for "${name}"`);
}

const SEP = " · ";

/** Keeps the day table's Food column in step when a Food is added or removed.
 *  It only ever appends or drops one name — whatever else the owner typed in
 *  there is left exactly as they typed it. */
export function summaryWith(summary: string | null, name: string): string {
  const parts = (summary ?? "")
    .split(SEP)
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.some((x) => x.toLowerCase() === name.toLowerCase())) {
    return parts.join(SEP);
  }
  return [...parts, name].join(SEP);
}

export function summaryWithout(summary: string | null, name: string): string {
  return (summary ?? "")
    .split(SEP)
    .map((x) => x.trim())
    .filter((x) => x && x.toLowerCase() !== name.toLowerCase())
    .join(SEP);
}

export function summaryRenamed(
  summary: string | null,
  from: string,
  to: string
): string {
  return (summary ?? "")
    .split(SEP)
    .map((x) => (x.trim().toLowerCase() === from.toLowerCase() ? to : x.trim()))
    .filter(Boolean)
    .join(SEP);
}

/** "09:30:00" → "9:30am". Falls back to whatever it was given. */
export function fmtClock(t: string | null): string {
  if (!t) return "—";
  const [hRaw, m] = t.split(":");
  const h = Number(hRaw);
  if (!Number.isFinite(h)) return t;
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m}${suffix}`;
}

/** "9:30am", "0930", "9.30 pm" → "09:30:00". Null when it cannot be read. */
export function parseClock(input: string): string | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, "");
  const m = s.match(/^(\d{1,2})[:.]?(\d{2})?(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (min > 59) return null;
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (h > 23) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
}

/** Title-cases a hand-typed label without shouting acronyms down. */
export function tidyLabel(input: string): string {
  const t = input.trim().replace(/\s+/g, " ");
  if (!t) return t;
  return t[0].toUpperCase() + t.slice(1);
}
