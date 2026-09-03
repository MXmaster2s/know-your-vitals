-- Know Your Vitals — database schema
--
-- Apply to a Supabase project (hosted or self-hosted):
--   psql "$DATABASE_URL" -f supabase/schema.sql
-- or paste into the Supabase SQL editor.
--
-- ⚠️  BEFORE YOU RUN THIS: seed `readers` at the bottom with your own address.
--     Every table's row-level security policy checks the signed-in user's
--     email against that table, and it is the only thing standing between your
--     health data and anyone who signs up against your Supabase URL with the
--     public anon key — which ships in the browser bundle, by design.

-- ---------------------------------------------------------------- people ----
create table if not exists public.people (
  id           text primary key,          -- short slug, e.g. 'sam'
  display_name text,
  dob          date,
  email        text,                      -- which sign-in owns these rows
  -- Set for whoever keeps the household's records: lets them write everyone's
  -- rows, not only their own.
  can_edit_all boolean not null default false
);

-- ------------------------------------------------------------- readers ----
-- Who may READ anything at all. A row here without a matching row in `people`
-- is a viewer: they see everything and can change nothing.
create table if not exists public.readers (
  email    text primary key,
  note     text,
  added_at timestamptz not null default now()
);

-- --------------------------------------------------------------- markers ----
-- One row per thing you measure. `category` groups them on the dashboard;
-- `description` is the plain-language explainer shown in the detail dialog.
create table if not exists public.markers (
  id          text primary key,           -- e.g. 'hba1c'
  name        text,
  category    text,                       -- glycemic | lipids | liver | cbc |
                                          -- kidney | thyroid | vitamins |
                                          -- minerals | vitals | other
  unit        text,
  sort        int,
  description text
);

-- --------------------------------------------------------------- reports ----
-- One lab visit / document. Measurements hang off it.
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  person_id   text not null references public.people(id) on delete cascade,
  taken_on    date not null,
  lab         text,
  kind        text default 'blood',
  source_file text,
  notes       text
);

-- ---------------------------------------------------------- measurements ----
-- Reference ranges are stored PER MEASUREMENT, not per marker, because
-- different labs print different ranges for the same test.
create table if not exists public.measurements (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid not null references public.reports(id) on delete cascade,
  person_id  text not null references public.people(id) on delete cascade,
  marker_id  text not null references public.markers(id),
  value      numeric not null,
  unit       text,
  ref_low    numeric,
  ref_high   numeric,
  flag       text check (flag in ('H','L')),
  taken_on   date not null
);
create index if not exists measurements_person_marker_idx
  on public.measurements (person_id, marker_id, taken_on);

-- --------------------------------------------- non-numeric observations ----
-- Imaging impressions, ECG reads, dental notes — anything without a number.
create table if not exists public.qualitative_findings (
  id        uuid primary key default gen_random_uuid(),
  person_id text references public.people(id) on delete cascade,
  taken_on  date,
  kind      text,
  title     text,
  detail    text
);

-- ------------------------------------------------------------ dismissals ----
-- Hides one card from "Needs attention". Keyed on the specific measurement or
-- finding id, so a LATER flagged reading for the same marker reappears rather
-- than staying hidden for good.
create table if not exists public.dismissals (
  person_id    text not null references public.people(id) on delete cascade,
  kind         text not null check (kind in ('measurement','finding')),
  ref_id       text not null,
  dismissed_at timestamptz not null default now(),
  primary key (person_id, kind, ref_id)
);

-- ------------------------------------------------------------------ RLS ----
-- Anyone can create an account against a Supabase project with the public anon
-- key — self-hosted GoTrue ships with signup enabled — so "authenticated" is
-- not a boundary. These policies are what make that harmless.
--
-- Three levels:
--   owner  — in `readers` AND in `people`: reads everything, writes their own
--            rows (or everyone's, with can_edit_all)
--   viewer — in `readers` only: reads everything, writes nothing
--   anyone else — nothing
--
-- There is deliberately NO anonymous read. The anon key ships in the browser
-- bundle, so granting select to `anon` would not mean "visitors can see the
-- page" — it would mean anyone who loads the page can lift the key and query
-- the whole database. Publish a demo dataset instead.

-- One row decides whether reads are open to any signed-in account or limited
-- to the allowlist. It is a switch so the decision stays reversible.
create table if not exists public.app_settings (
  key        text primary key,
  enabled    boolean not null,
  note       text,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (key, enabled, note) values
  ('open_read', false,
   'Any signed-in account may read. Set false to fall back to the readers allowlist.')
on conflict (key) do nothing;

-- 👇 SEED YOUR OWN ADDRESS(ES) HERE
insert into public.readers (email, note) values
  ('you@example.com', 'owner')
on conflict (email) do nothing;

-- All four are security definer so a policy may call them without tripping RLS
-- on the table they read (and without `readers`' own policy recursing).
create or replace function public.can_read() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select s.enabled from public.app_settings s
                    where s.key = 'open_read'), false)
      or exists (select 1 from public.readers r
                  where lower(r.email) = lower(auth.jwt() ->> 'email'))
$$;

create or replace function public.me() returns text
  language sql stable security definer set search_path = public as $$
  select id from public.people
   where lower(email) = lower(auth.jwt() ->> 'email')
   limit 1
$$;

create or replace function public.is_owner() returns boolean
  language sql stable security definer set search_path = public as $$
  select public.me() is not null
$$;

create or replace function public.can_write(target text) returns boolean
  language sql stable security definer set search_path = public as $$
  select target = public.me()
      or coalesce((select p.can_edit_all from public.people p
                    where p.id = public.me()), false)
$$;

do $$
declare t text;
begin
  -- `from public` alone is not enough: Supabase grants `anon` EXECUTE
  -- explicitly, so it survives a PUBLIC revoke. The anon key ships in the
  -- browser bundle, so anything anon may execute is open to the internet.
  foreach t in array array['can_read()','me()','is_owner()','can_write(text)'] loop
    execute format('revoke all on function public.%s from anon, public', t);
    execute format('grant execute on function public.%s to authenticated', t);
  end loop;

  -- Shared reference tables: read if allowed in, write if you are an owner.
  foreach t in array array['people','markers','readers','app_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists allowed_people_all on public.%I', t);
    execute format('drop policy if exists read_allowed on public.%I', t);
    execute format('drop policy if exists write_own on public.%I', t);
    execute format('create policy read_allowed on public.%I for select to authenticated using (public.can_read())', t);
    execute format('create policy write_own on public.%I for all to authenticated using (public.is_owner()) with check (public.is_owner())', t);
  end loop;

  -- Person-scoped: read if allowed in, write only your own (or everyone's).
  foreach t in array array['reports','measurements','qualitative_findings',
                           'dismissals'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists allowed_people_all on public.%I', t);
    execute format('drop policy if exists read_allowed on public.%I', t);
    execute format('drop policy if exists write_own on public.%I', t);
    execute format('create policy read_allowed on public.%I for select to authenticated using (public.can_read())', t);
    execute format('create policy write_own on public.%I for all to authenticated using (public.can_write(person_id)) with check (public.can_write(person_id))', t);
  end loop;

  foreach t in array array['people','markers','readers','app_settings','reports',
                           'measurements','qualitative_findings','dismissals'] loop
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
