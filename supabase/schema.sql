-- Know Your Vitals — database schema
--
-- Apply to a Supabase project (hosted or self-hosted):
--   psql "$DATABASE_URL" -f supabase/schema.sql
-- or paste into the Supabase SQL editor.
--
-- ⚠️  BEFORE YOU RUN THIS: edit ALLOWED_EMAILS below. Every table's row-level
--     security policy checks the signed-in user's email against that list, and
--     it is the only thing standing between your health data and anyone who
--     signs up against your Supabase URL with the public anon key.

-- ---------------------------------------------------------------- people ----
create table if not exists public.people (
  id           text primary key,          -- short slug, e.g. 'sam'
  display_name text,
  dob          date
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
-- key. These policies are what make that harmless: only the emails you list
-- can read or write anything.
do $$
declare
  t text;
  -- 👇 EDIT THIS LINE — your own addresses, comma separated
  allowed constant text := '''you@example.com'',''partner@example.com''';
begin
  foreach t in array array['people','markers','reports','measurements',
                           'qualitative_findings','dismissals']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists allowed_people_all on public.%I', t);
    execute format($f$
      create policy allowed_people_all on public.%I
        for all to authenticated
        using      ((auth.jwt() ->> 'email') in (%s))
        with check ((auth.jwt() ->> 'email') in (%s))
    $f$, t, allowed, allowed);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
