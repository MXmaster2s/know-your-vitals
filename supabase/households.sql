-- Know Your Vitals — households, self-registration, uploaded reports
--
-- Run after schema.sql (and analytics.sql if you use it). This is the layer
-- that lets strangers sign in without seeing each other:
--
--   * a HOUSEHOLD is the unit of privacy. The people who set the vault up
--     share one; everyone who signs in afterwards gets their own, keyed to
--     their auth id. Reads are scoped to your household plus the demo one.
--   * ensure_me() creates the caller's own person row on first sign-in. It
--     is the only way a person row appears without an admin, and it can only
--     ever create the caller's own.
--   * is_admin() replaces "has a row in people" as the gate for anything that
--     matters — once everyone has a row, that test means nothing.
--   * uploaded reports go to a private bucket under the uploader's own folder,
--     with a ledger table the Analytics page reads.

alter table public.people add column if not exists household text;
alter table public.people add column if not exists is_admin  boolean not null default false;
alter table public.app_settings add column if not exists value text;

-- Written by the payment webhook (see the edge function), read by
-- slots_status() and the Analytics page. Idempotent, so file order does not
-- matter.
alter table public.readers add column if not exists paid_at    timestamptz;
alter table public.readers add column if not exists payment_id text;

-- Tells the signed-in browser whether IT has paid — nothing about anyone else.
create or replace function public.my_status()
  returns table (paid boolean, paid_at timestamptz)
  language sql stable security definer set search_path = public as $$
  select r.paid_at is not null, r.paid_at from public.readers r
   where lower(r.email) = lower(auth.jwt() ->> 'email') limit 1
$$;

-- 👇 SET THESE: your household's name, and which household /preview shows
update public.people set household = 'home' where household is null;
insert into public.app_settings (key, enabled, value, note) values
  ('demo_household', true, 'home', 'Which household /preview shows to everyone'),
  ('slots',          true, '20',   'How many people the tool is open to right now'),
  -- Seats spoken for outside the payment flow. Separate from the real paid
  -- count so the two never get confused; slots_status() adds them.
  ('slots_offset',   true, '0',    'Seats taken before the counter went live')
on conflict (key) do nothing;

-- /preview shows real people to strangers, so it names them by role. Their own
-- view keeps display_name; leave this null for anyone not in the demo.
alter table public.people add column if not exists demo_label text;

create or replace function public.my_household() returns text
  language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.household from public.people p
      where lower(p.email) = lower(auth.jwt() ->> 'email') limit 1),
    auth.uid()::text)
$$;

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin from public.people p
                    where lower(p.email) = lower(auth.jwt() ->> 'email') limit 1), false)
$$;

create or replace function public.demo_household() returns text
  language sql stable security definer set search_path = public as $$
  select s.value from public.app_settings s where s.key = 'demo_household'
$$;

create or replace function public.ensure_me() returns public.people
  language plpgsql security definer set search_path = public as $$
declare
  em  text := lower(auth.jwt() ->> 'email');
  uid text := auth.uid()::text;
  nm  text := coalesce(
                nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
                nullif(auth.jwt() -> 'user_metadata' ->> 'name', ''),
                split_part(coalesce(em, ''), '@', 1));
  r   public.people;
begin
  if em is null or uid is null then raise exception 'not signed in'; end if;
  select * into r from public.people where lower(email) = em limit 1;
  if found then return r; end if;
  insert into public.people (id, display_name, email, household)
  values (uid, nm, em, uid) returning * into r;
  return r;
end $$;

create or replace function public.my_people() returns setof public.people
  language sql stable security definer set search_path = public as $$
  select * from public.people where household = public.my_household() order by id
$$;

create or replace function public.demo_people() returns setof public.people
  language sql stable security definer set search_path = public as $$
  select * from public.people where household = public.demo_household() order by id
$$;

create or replace function public.can_see(target text) returns boolean
  language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.people p
     where p.id = target
       and (p.household = public.my_household() or p.household = public.demo_household()))
$$;

create or replace function public.slots_status()
  returns table (served bigint, total int)
  language sql stable security definer set search_path = public as $$
  select coalesce((select s.value::bigint from public.app_settings s
                    where s.key = 'slots_offset'), 0)
         + (select count(*) from public.readers where paid_at is not null),
         coalesce((select s.value::int from public.app_settings s
                    where s.key = 'slots'), 20)
$$;

-- ------------------------------------------------------- policies ----
do $$
declare t text;
begin
  execute 'drop policy if exists read_allowed on public.people';
  execute 'drop policy if exists write_own on public.people';
  execute 'drop policy if exists update_own on public.people';
  execute 'drop policy if exists admin_insert on public.people';
  execute 'drop policy if exists admin_delete on public.people';
  execute $p$ create policy read_allowed on public.people for select to authenticated
    using (public.can_read() and (public.is_admin()
           or household = public.my_household() or household = public.demo_household())) $p$;
  execute $p$ create policy update_own on public.people for update to authenticated
    using (public.can_write(id)) with check (public.can_write(id)) $p$;
  execute $p$ create policy admin_insert on public.people for insert to authenticated
    with check (public.is_admin()) $p$;
  execute $p$ create policy admin_delete on public.people for delete to authenticated
    using (public.is_admin()) $p$;

  foreach t in array array['reports','measurements','qualitative_findings','dismissals',
                           'meals','nutrition_targets','activity_targets'] loop
    execute format('drop policy if exists read_allowed on public.%I', t);
    execute format($p$ create policy read_allowed on public.%I for select to authenticated
      using (public.can_read() and public.can_see(person_id)) $p$, t);
  end loop;

  foreach t in array array['meal_foods','meal_items'] loop
    execute format('drop policy if exists read_allowed on public.%I', t);
    execute format($p$ create policy read_allowed on public.%I for select to authenticated
      using (public.can_read() and exists (select 1 from public.meals m
              where m.id = %I.meal_id and public.can_see(m.person_id))) $p$, t, t);
  end loop;
end $$;

-- A row policy says WHICH rows you may update, nothing about which columns.
-- Without this a person could set is_admin on their own row.
revoke update on public.people from authenticated;
grant update (display_name, dob) on public.people to authenticated;

-- Once everyone has a people row, these must be admin-only or anyone could
-- mark themselves paid or open the whole vault.
drop policy if exists write_own on public.readers;
create policy write_own on public.readers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists write_own on public.app_settings;
create policy write_own on public.app_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists write_own on public.markers;
create policy write_own on public.markers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- foods become per-household; null means shared reference data
alter table public.foods add column if not exists household text default public.my_household();
update public.foods set household = (select value from public.app_settings where key='demo_household')
 where household is null;
drop policy if exists read_allowed on public.foods;
drop policy if exists write_own on public.foods;
create policy read_allowed on public.foods for select to authenticated
  using (public.can_read() and (household is null or public.is_admin()
         or household = public.my_household() or household = public.demo_household()));
create policy write_own on public.foods for all to authenticated
  using (public.is_admin() or household = public.my_household())
  with check (public.is_admin() or household = public.my_household());

-- ------------------------------------------------ uploaded reports ----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reports', 'reports', false, 5242880, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = 5242880, allowed_mime_types = array['application/pdf'];

drop policy if exists "reports: upload own" on storage.objects;
drop policy if exists "reports: read own or admin" on storage.objects;
drop policy if exists "reports: delete own" on storage.objects;
create policy "reports: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'reports' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "reports: read own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'reports'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "reports: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'reports' and (storage.foldername(name))[1] = auth.uid()::text);

create table if not exists public.report_uploads (
  id          uuid primary key default gen_random_uuid(),
  uid         text not null,
  email       text not null,
  path        text not null unique,
  file_name   text not null,
  size_bytes  bigint,
  uploaded_at timestamptz not null default now()
);
create index if not exists report_uploads_uid_idx on public.report_uploads (uid, uploaded_at desc);
alter table public.report_uploads enable row level security;
drop policy if exists insert_own on public.report_uploads;
drop policy if exists read_own_or_admin on public.report_uploads;
create policy insert_own on public.report_uploads for insert to authenticated
  with check (uid = auth.uid()::text and lower(email) = lower(auth.jwt() ->> 'email')
              and split_part(path, '/', 1) = auth.uid()::text);
create policy read_own_or_admin on public.report_uploads for select to authenticated
  using (uid = auth.uid()::text or public.is_admin());
-- Deleting a report removes the file AND its ledger row; without this the list
-- keeps showing something that is no longer there.
drop policy if exists delete_own on public.report_uploads;
create policy delete_own on public.report_uploads for delete to authenticated
  using (uid = auth.uid()::text);
revoke all on public.report_uploads from anon;
grant select, insert, delete on public.report_uploads to authenticated;

create or replace function public.all_uploads()
  returns table (email text, path text, file_name text, size_bytes bigint, uploaded_at timestamptz)
  language sql stable security definer set search_path = public as $$
  select lower(u.email), u.path, u.file_name, u.size_bytes, u.uploaded_at
    from public.report_uploads u where public.is_admin() order by u.uploaded_at desc
$$;

-- analytics gates move from is_owner() to is_admin(). visitor_log() also
-- gains a paid_at column, and Postgres will not let `create or replace`
-- change a return signature — so it is dropped first.
drop function if exists public.visitor_log();
create function public.visitor_log()
  returns table (email text, name text, provider text, first_seen timestamptz,
                 last_seen timestamptz, visits bigint, paid_at timestamptz)
  language sql stable security definer set search_path = public, auth as $$
  select u.email::text, nullif(u.raw_user_meta_data ->> 'full_name', '')::text,
         (u.raw_app_meta_data ->> 'provider')::text,
         least(u.created_at, min(v.viewed_at)), greatest(u.last_sign_in_at, max(v.viewed_at)),
         count(v.id), max(r.paid_at)
    from auth.users u
    left join public.page_views v on lower(v.viewer) = lower(u.email)
    left join public.readers r    on lower(r.email)  = lower(u.email)
   where public.is_admin()
   group by u.id, u.email, u.raw_user_meta_data, u.raw_app_meta_data, u.created_at, u.last_sign_in_at
   order by max(r.paid_at) desc nulls last, greatest(u.last_sign_in_at, max(v.viewed_at)) desc nulls last
$$;
create or replace function public.visit_times()
  returns table (email text, path text, viewed_at timestamptz)
  language sql stable security definer set search_path = public as $$
  select lower(v.viewer)::text, v.path::text, v.viewed_at from public.page_views v
   where public.is_admin() and v.viewer is not null order by v.viewed_at desc limit 3000
$$;
create or replace function public.page_totals()
  returns table (path text, views bigint)
  language sql stable security definer set search_path = public as $$
  select v.path::text, count(*) from public.page_views v
   where public.is_admin() group by v.path order by count(*) desc
$$;

-- anon is granted EXECUTE explicitly by Supabase; name it in every revoke
do $$
declare f text;
begin
  foreach f in array array['my_household()','is_admin()','demo_household()','ensure_me()',
                           'my_people()','demo_people()','can_see(text)','slots_status()',
                           'my_status()','all_uploads()','visitor_log()','visit_times()',
                           'page_totals()'] loop
    execute format('revoke all on function public.%s from anon, public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
