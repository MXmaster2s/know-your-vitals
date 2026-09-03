-- Know Your Vitals — nutrition module
--
-- Optional add-on to schema.sql. Adds an ingredient library priced the way you
-- actually buy things, meal plans built from it, and the macro / activity
-- targets you are aiming at for a given stretch of time.
--
--   psql "$DATABASE_URL" -f supabase/nutrition.sql
--
-- Run schema.sql first: this reuses its `readers` table and its can_read() /
-- is_owner() / can_write() helpers rather than repeating an email list.

-- ----------------------------------------------------------------- foods ----
-- Nutrition is stored per 100 g of the EDIBLE portion; price is per kg AS
-- PURCHASED. `edible_yield` bridges the two — 0.65 for bone-in chicken means a
-- kilo off the scale leaves 650 g you can eat. That split is what makes
-- cost-per-gram-of-protein honest: you pay for the bone.
create table if not exists public.foods (
  id           text primary key,          -- 'chicken-bone-in'
  name         text not null,
  category     text,                      -- protein | grain | dairy | veg |
                                          -- fruit | fat | seed | supplement
  kcal         numeric,                   -- per 100 g edible
  protein_g    numeric,
  carb_g       numeric,
  fat_g        numeric,
  fiber_g      numeric,
  price_per_kg numeric,                   -- ₹ per kg as purchased
  edible_yield numeric not null default 1 check (edible_yield > 0 and edible_yield <= 1),
  grams_per_piece numeric,                -- set for things you count, not weigh
  grams_per_ml numeric,                   -- ~1 for most liquids, ~0.91 for oil
  -- What this food is worth eating FOR, in plain words. Shown in the meal row
  -- instead of a macro dump; the numbers above still drive the totals.
  nutrients    text,
  source_url   text,                      -- where the figures came from
  notes        text,
  sort         int default 0
);

-- ----------------------------------------------------------------- meals ----
create table if not exists public.meals (
  id        uuid primary key default gen_random_uuid(),
  person_id text not null references public.people(id) on delete cascade,
  name      text not null,                -- 'Breakfast'
  at_time   time,                          -- the day sorts on this
  time_note text,                          -- anything the clock cannot say
  -- What the day table's Food column shows. Adding or removing a Food keeps
  -- it in step, but it is free text and the owner's to overwrite.
  food_summary text,
  sort      int default 0
);

-- A Food is a named thing inside a meal — 'Salad', 'Smoothie' — that holds its
-- own ingredients. It is a row rather than a label repeated on every
-- ingredient, so renaming it is one edit and the name has somewhere to live.
create table if not exists public.meal_foods (
  id      uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  name    text not null,
  sort    int default 0
);
create index if not exists meal_foods_meal_idx on public.meal_foods (meal_id);

-- Quantities are AS PURCHASED (so "400 g chicken" is the bone-in weight you
-- put on the scale) — the yield above converts it to what you actually eat.
create table if not exists public.meal_items (
  id      uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  meal_food_id uuid references public.meal_foods(id) on delete cascade,
  food_id text not null references public.foods(id) on delete cascade,
  qty_g   numeric not null default 0,
  -- What this item cost in this meal. A fact the owner states, never derived
  -- from a per-kg rate: the rate is the softer number, and per-meal is what
  -- adds up to a weekly or monthly food bill.
  price   numeric,
  -- The unit only changes how the amount is shown; qty_g stays canonical,
  -- converted through grams_per_piece / grams_per_ml on the food.
  amount_unit text not null default 'g' check (amount_unit in ('g','ml','piece')),
  comments    text,
  sort    int default 0
);
create index if not exists meal_items_meal_idx on public.meal_items (meal_id);

-- --------------------------------------------------------------- targets ----
-- More than one row per person is fine and often right: a target that assumes
-- you are training and a lower one for weeks you are not.
create table if not exists public.nutrition_targets (
  id        uuid primary key default gen_random_uuid(),
  person_id text not null references public.people(id) on delete cascade,
  label     text not null,
  starts_on date,
  ends_on   date,
  kcal      numeric,
  protein_g numeric,
  carb_g    numeric,
  fat_g     numeric,
  fiber_g   numeric,
  is_active boolean not null default false,
  notes     text,
  sort      int default 0
);

-- Free-text on purpose: "45 min × 5–7/week" carries more than a number would.
create table if not exists public.activity_targets (
  id        uuid primary key default gen_random_uuid(),
  person_id text not null references public.people(id) on delete cascade,
  label     text not null,                -- 'Morning walk'
  target    text,                         -- '45 min × 5–7 / week'
  current   text,                         -- '1–2 / week'
  due_on    date,
  sort      int default 0
);

-- -------------------------------------------------- planned lab visits ----
-- A report row with planned = true is one you intend to take, not one you
-- have. It shows greyed out in the filter so the next test stays visible.
alter table public.reports
  add column if not exists planned boolean not null default false;

-- ------------------------------------------------------------------ RLS ----
-- Uses the identity helpers from schema.sql: can_read() for reads, is_owner()
-- for the shared pantry, can_write(person_id) for anything with an owner.
-- Run schema.sql first.
do $$
declare t text;
begin
  -- `foods` is the household's shared pantry, so any owner may edit it.
  execute 'alter table public.foods enable row level security';
  execute 'drop policy if exists allowed_people_all on public.foods';
  execute 'drop policy if exists read_allowed on public.foods';
  execute 'drop policy if exists write_own on public.foods';
  execute 'create policy read_allowed on public.foods for select to authenticated using (public.can_read())';
  execute 'create policy write_own on public.foods for all to authenticated using (public.is_owner()) with check (public.is_owner())';

  foreach t in array array['meals','nutrition_targets','activity_targets'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists allowed_people_all on public.%I', t);
    execute format('drop policy if exists read_allowed on public.%I', t);
    execute format('drop policy if exists write_own on public.%I', t);
    execute format('create policy read_allowed on public.%I for select to authenticated using (public.can_read())', t);
    execute format('create policy write_own on public.%I for all to authenticated using (public.can_write(person_id)) with check (public.can_write(person_id))', t);
  end loop;

  -- These two reach their owner through the meal.
  foreach t in array array['meal_foods','meal_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists allowed_people_all on public.%I', t);
    execute format('drop policy if exists read_allowed on public.%I', t);
    execute format('drop policy if exists write_own on public.%I', t);
    execute format('create policy read_allowed on public.%I for select to authenticated using (public.can_read())', t);
    execute format($f$
      create policy write_own on public.%I for all to authenticated
        using (exists (select 1 from public.meals m
                        where m.id = %I.meal_id and public.can_write(m.person_id)))
        with check (exists (select 1 from public.meals m
                        where m.id = %I.meal_id and public.can_write(m.person_id)))
    $f$, t, t, t);
  end loop;

  foreach t in array array['foods','meals','meal_foods','meal_items',
                           'nutrition_targets','activity_targets'] loop
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
