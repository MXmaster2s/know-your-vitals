-- Micronutrients, and the chicken swap.  Idempotent: safe to run twice.
--
-- Every *_per_unit figure is per ONE base unit AS PURCHASED, exactly like the
-- macros beside it: per kilo, per litre, or per piece.  Null means unknown and
-- never zero (R5), so a day total says how much of it is actually accounted
-- for rather than quietly under-reporting.

begin;

-- 1. Twelve micronutrients on every ingredient.  AI-owned, like the macros.
alter table foods
  add column if not exists iron_mg_per_unit      numeric,
  add column if not exists calcium_mg_per_unit   numeric,
  add column if not exists magnesium_mg_per_unit numeric,
  add column if not exists potassium_mg_per_unit numeric,
  add column if not exists zinc_mg_per_unit      numeric,
  add column if not exists selenium_ug_per_unit  numeric,
  add column if not exists folate_ug_per_unit    numeric,
  add column if not exists b12_ug_per_unit       numeric,
  add column if not exists vit_c_mg_per_unit     numeric,
  add column if not exists vit_d_ug_per_unit     numeric,
  add column if not exists vit_a_ug_per_unit     numeric,
  add column if not exists omega3_g_per_unit     numeric;

-- 2. A target for each, on the same row as the macro targets.
alter table nutrition_targets
  add column if not exists iron_mg      numeric,
  add column if not exists calcium_mg   numeric,
  add column if not exists magnesium_mg numeric,
  add column if not exists potassium_mg numeric,
  add column if not exists zinc_mg      numeric,
  add column if not exists selenium_ug  numeric,
  add column if not exists folate_ug    numeric,
  add column if not exists b12_ug       numeric,
  add column if not exists vit_c_mg     numeric,
  add column if not exists vit_d_ug     numeric,
  add column if not exists vit_a_ug     numeric,
  add column if not exists omega3_g     numeric;

-- 3. Chicken breast, boneless.  A new row rather than an edit to `chicken`,
--    so the bone-in figures stay intact and comparable.  It joins whichever
--    household the bone-in row belongs to, so no household is named here.
insert into foods (
  id, name, category, base_unit, sort, household,
  price_per_unit, kcal_per_unit, protein_g_per_unit,
  carb_g_per_unit, fat_g_per_unit, fiber_g_per_unit,
  nutrients
) values (
  'chicken-breast', 'Chicken breast, boneless', 'protein', 'kg', 0,
  (select household from public.foods where id = 'chicken-bone-in'),
  435, 1200, 225, 0, 26, 0,
  'Protein, B3, B6, Selenium, Phosphorus'
) on conflict (id) do nothing;

commit;

-- 4. Seed the twelve figures for every ingredient that appears in a meal.
--    Reference-table values, so they are ESTIMATES (R11) — none of these has a
--    product link.  `coalesce` means a re-run never overwrites a corrected
--    figure.  Anything not listed keeps null: unknown, not zero.
begin;

with v (id, iron, ca, mg, k, zn, se, fol, b12, vitc, vitd, vita, o3) as (values
  -- per PIECE
  ('lemon',           0.02,    1.4,   1.4,     25,   0.01,   0.05,    4.8,    0,     9.3,  0,    0.2,     0),
  ('egg',             0.88,     28,     6,     69,   0.65,   15.4,     24, 0.56,       0,  1,     80,  0.05),
  ('cucumber',         0.5,     29,    23,    265,   0.36,    0.5,   12.6,    0,       5,  0,      9,  0.01),
  ('tomato',          0.26,    9.5,  10.5,    225,   0.16,      0,     14,    0,      13,  0,     40,     0),
  ('orange',          0.14,     56,    14,    253,    0.1,    0.7,     42,    0,    74.5,  0,     15,     0),
  -- per KG, as purchased
  ('moong-dry',       67.4,   1320,  1890,  12460,   26.8,     82,   6250,    0,      48,  0,     60,   2.8),
  ('hung-curd-2',      0.4,   1100,   110,   1410,    5.2,     97,     70,  7.5,       0,  0,     10,     0),
  ('hung-curd',        0.4,   1100,   110,   1410,    5.2,     97,     70,  7.5,       0,  0,     10,     0),
  ('soy-milk',         6.4,    250,   250,   1180,    1.2,     13,    180,    0,       0,  0,      0,     2),
  ('cocoa',            139,   1280,  4990,  15240,   68.1,    143,    320,    0,       0,  0,      0,     1),
  ('chia',              50,   2500,  3000,   6000,     35,    100,    600,    0,       0,  0,      0,    50),
  ('isapgol',           15,   1800,   150,   2000,      3,      0,      0,    0,       0,  0,      0,     0),
  ('chicken-bone-in',  5.9,     78,   162,   1430,    8.5,    110,     33,  2.3,       0, 0.7,    98,   0.7),
  ('chicken-breast',     7,     50,   270,   3340,    6.8,    228,     40,    2,       0,   1,    90,   0.3),
  ('chicken-liver',   89.9,     80,   190,   2300,   26.7,    546,   5880, 165.8,    179,   4,  32960,    1),
  ('rice-raw',           8,    280,   250,   1150,   10.9,    151,     80,    0,       0,  0,      0,     0),
  ('toor-dal',        52.3,   1300,  1830,  13920,   27.6,     82,   4560,    0,       0,  0,      0,     0),
  ('mustard-oil',        0,      0,     0,      0,      0,      0,      0,    0,       0, 14,   8400,     5)
)
update foods f set
  iron_mg_per_unit      = coalesce(f.iron_mg_per_unit,      v.iron),
  calcium_mg_per_unit   = coalesce(f.calcium_mg_per_unit,   v.ca),
  magnesium_mg_per_unit = coalesce(f.magnesium_mg_per_unit, v.mg),
  potassium_mg_per_unit = coalesce(f.potassium_mg_per_unit, v.k),
  zinc_mg_per_unit      = coalesce(f.zinc_mg_per_unit,      v.zn),
  selenium_ug_per_unit  = coalesce(f.selenium_ug_per_unit,  v.se),
  folate_ug_per_unit    = coalesce(f.folate_ug_per_unit,    v.fol),
  b12_ug_per_unit       = coalesce(f.b12_ug_per_unit,       v.b12),
  vit_c_mg_per_unit     = coalesce(f.vit_c_mg_per_unit,     v.vitc),
  vit_d_ug_per_unit     = coalesce(f.vit_d_ug_per_unit,     v.vitd),
  vit_a_ug_per_unit     = coalesce(f.vit_a_ug_per_unit,     v.vita),
  omega3_g_per_unit     = coalesce(f.omega3_g_per_unit,     v.o3)
from v where v.id = f.id;

-- 5. Targets.  ICMR-NIN 2020: the adult-man set by default, the lactating
--    set on any target row whose label says so.  The owner's to change, like
--    every other target on the row; `coalesce` leaves a set value alone.
update nutrition_targets n set
  iron_mg      = coalesce(n.iron_mg,      case when n.label ilike '%breastfeed%' then 21   else 19   end),
  calcium_mg   = coalesce(n.calcium_mg,   case when n.label ilike '%breastfeed%' then 1200 else 1000 end),
  magnesium_mg = coalesce(n.magnesium_mg, 440),
  potassium_mg = coalesce(n.potassium_mg, 3500),
  zinc_mg      = coalesce(n.zinc_mg,      case when n.label ilike '%breastfeed%' then 14   else 17   end),
  selenium_ug  = coalesce(n.selenium_ug,  case when n.label ilike '%breastfeed%' then 70   else 40   end),
  folate_ug    = coalesce(n.folate_ug,    case when n.label ilike '%breastfeed%' then 330  else 300  end),
  b12_ug       = coalesce(n.b12_ug,       case when n.label ilike '%breastfeed%' then 3.2  else 2.2  end),
  vit_c_mg     = coalesce(n.vit_c_mg,     case when n.label ilike '%breastfeed%' then 115  else 80   end),
  vit_d_ug     = coalesce(n.vit_d_ug,     15),
  vit_a_ug     = coalesce(n.vit_a_ug,     case when n.label ilike '%breastfeed%' then 950  else 1000 end),
  omega3_g     = coalesce(n.omega3_g,     1.6);

commit;
