-- Know Your Vitals — page views and the Analytics section
--
-- Optional add-on. Run after schema.sql, whose can_read() / is_owner() helpers
-- this depends on.
--
--   psql "$DATABASE_URL" -f supabase/analytics.sql

-- ------------------------------------------------------------ page views ----
-- One row per page load. The email is recorded so a visitor is attributable;
-- the app only ever displays counts.
create table if not exists public.page_views (
  id        bigserial primary key,
  path      text not null,
  viewer    text,
  viewed_at timestamptz not null default now()
);
create index if not exists page_views_time_idx on public.page_views (viewed_at desc);

-- Locked down with NO policies at all: nothing reaches this table except the
-- security-definer functions below. A visitor can add to the log and cannot
-- read, forge or delete it.
alter table public.page_views enable row level security;
revoke all on public.page_views from anon, authenticated;
revoke all on sequence public.page_views_id_seq from anon, authenticated;

-- ------------------------------------------------------------- functions ----
-- Each of these runs as the definer and therefore bypasses RLS. That is the
-- only way to reach page_views and auth.users — and it is exactly why the
-- read functions check is_owner() in their own body. Remove that check and any
-- signed-in visitor can list every other visitor's email address.

create or replace function public.record_view(p text) returns void
  language sql security definer set search_path = public as $$
  insert into public.page_views (path, viewer)
  values (left(p, 200), auth.jwt() ->> 'email')
$$;

create or replace function public.view_counts()
  returns table (last_24h bigint, lifetime bigint)
  language sql stable security definer set search_path = public as $$
  select count(*) filter (where viewed_at > now() - interval '24 hours'),
         count(*)
    from public.page_views
$$;

-- households.sql later widens this with a paid_at column, and Postgres will
-- not let `create or replace` change a return signature — drop first so the
-- two files are idempotent in either order.
drop function if exists public.visitor_log();
create function public.visitor_log()
  returns table (email text, name text, provider text,
                 first_seen timestamptz, last_seen timestamptz, visits bigint)
  language sql stable security definer set search_path = public, auth as $$
  select u.email::text,
         nullif(u.raw_user_meta_data ->> 'full_name', '')::text,
         (u.raw_app_meta_data ->> 'provider')::text,
         least(u.created_at, min(v.viewed_at)),
         greatest(u.last_sign_in_at, max(v.viewed_at)),
         count(v.id)
    from auth.users u
    left join public.page_views v on lower(v.viewer) = lower(u.email)
   where public.is_owner()
   group by u.id, u.email, u.raw_user_meta_data, u.raw_app_meta_data,
            u.created_at, u.last_sign_in_at
   order by greatest(u.last_sign_in_at, max(v.viewed_at)) desc nulls last
$$;

create or replace function public.visit_times()
  returns table (email text, path text, viewed_at timestamptz)
  language sql stable security definer set search_path = public as $$
  select lower(v.viewer)::text, v.path::text, v.viewed_at
    from public.page_views v
   where public.is_owner() and v.viewer is not null
   order by v.viewed_at desc
   limit 3000
$$;

create or replace function public.page_totals()
  returns table (path text, views bigint)
  language sql stable security definer set search_path = public as $$
  select v.path::text, count(*)
    from public.page_views v
   where public.is_owner()
   group by v.path
   order by count(*) desc
$$;

-- ⚠️  `revoke ... from public` does NOT cover `anon`: Supabase grants that role
--     EXECUTE explicitly, so it survives the PUBLIC revoke. Name it. The anon
--     key ships in the browser bundle, so anything anon may execute is
--     effectively open to the internet.
do $$
declare f text;
begin
  foreach f in array array['record_view(text)','view_counts()','visitor_log()',
                           'visit_times()','page_totals()']
  loop
    execute format('revoke all on function public.%s from anon, public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
