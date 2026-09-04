-- Know Your Vitals — an MCP server, so ChatGPT or Claude can read your data
--
-- Run after households.sql. The server itself is a Cloudflare Pages Function
-- (functions/mcp/) answering at /mcp/<token>; this file is everything it
-- needs from the database.
--
--   * A token is the whole credential. It is minted by the signed-in person,
--     shown once, and stored only as a SHA-256 hash — a copy of the database
--     does not contain a working key.
--   * The server hashes what it receives and calls mcp_call(), which only the
--     service role may execute. The keys in the browser bundle cannot reach it.
--   * Everything mcp_call() returns is scoped to the token owner's household,
--     read-only. The only write is the token's last-used stamp.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.mcp_tokens (
  id           uuid primary key default gen_random_uuid(),
  uid          text not null,               -- auth.uid() of the owner
  email        text not null,
  label        text not null default 'AI',  -- "ChatGPT", "Claude": the owner's word for it
  token_hash   text not null unique,        -- sha256(plaintext) as hex; the plaintext is never stored
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
create index if not exists mcp_tokens_uid_idx on public.mcp_tokens (uid, created_at desc);
alter table public.mcp_tokens enable row level security;

-- The owner sees their own rows and nobody else's — not even an admin. There
-- is no insert, update or delete policy at all; those go through the
-- functions below, which can only ever act on the caller's own rows.
drop policy if exists read_own on public.mcp_tokens;
create policy read_own on public.mcp_tokens for select to authenticated
  using (uid = auth.uid()::text);

-- A row policy says which rows, not which columns. The hash is not the
-- secret, but a browser has no reason to see it, so `select *` must fail.
revoke all on public.mcp_tokens from anon, authenticated, public;
grant select (id, label, created_at, last_used_at, revoked_at)
  on public.mcp_tokens to authenticated;

-- Mints one token and returns the plaintext — the only time it exists outside
-- the owner's screen. 24 random bytes as base64 with the two URL-unsafe
-- characters swapped, so it can sit in a path.
create or replace function public.mcp_token_create(p_label text default 'AI')
  returns text
  language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid   text := auth.uid()::text;
  v_email text := lower(auth.jwt() ->> 'email');
  v_tok   text;
begin
  if v_uid is null or v_email is null then raise exception 'not signed in'; end if;
  if (select count(*) from public.mcp_tokens t
       where t.uid = v_uid and t.revoked_at is null) >= 5 then
    raise exception 'five addresses already — revoke one first';
  end if;
  v_tok := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_');
  insert into public.mcp_tokens (uid, email, label, token_hash)
  values (v_uid, v_email, left(coalesce(nullif(btrim(p_label), ''), 'AI'), 40),
          encode(extensions.digest(v_tok, 'sha256'), 'hex'));
  return v_tok;
end $$;

create or replace function public.mcp_token_revoke(p_id uuid) returns void
  language sql security definer set search_path = public as $$
  update public.mcp_tokens set revoked_at = coalesce(revoked_at, now())
   where id = p_id and uid = auth.uid()::text
$$;

-- What the server calls. One round trip: resolve the token, stamp it, answer
-- the tool. Returns {"error": ...} rather than raising, so the server can
-- tell "bad token" (HTTP 401) from "bad question" (a tool error).
drop function if exists public.mcp_call(text, text, jsonb);
create function public.mcp_call(p_hash text, p_tool text, p_args jsonb default '{}'::jsonb)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_claims text := current_setting('request.jwt.claims', true);
  t        public.mcp_tokens;
  hh       text;
  ids      text[];
  v_paid   boolean;
  q        text;
  res      jsonb;
begin
  -- Executable only by the service role by grant; checked again here because
  -- a definer function must never trust the grant alone.
  if coalesce(v_claims, '') <> ''
     and (v_claims::jsonb ->> 'role') is distinct from 'service_role' then
    raise exception 'service role only';
  end if;

  select * into t from public.mcp_tokens
   where token_hash = p_hash and revoked_at is null;
  if not found then return jsonb_build_object('error', 'invalid token'); end if;
  update public.mcp_tokens set last_used_at = now() where id = t.id;

  -- The same read gate the browser has: open_read, or the owner is a reader.
  if not (coalesce((select s.enabled from public.app_settings s where s.key = 'open_read'), false)
          or exists (select 1 from public.readers r where lower(r.email) = t.email)) then
    return jsonb_build_object('error', 'this account has no read access');
  end if;

  -- The owner's household: by email for the founding household, by auth id
  -- for everyone ensure_me() created.
  select coalesce(p.household, t.uid) into hh from public.people p
   where lower(p.email) = t.email or p.id = t.uid
   order by (lower(p.email) = t.email) desc limit 1;
  hh := coalesce(hh, t.uid);
  select coalesce(array_agg(p.id), '{}'::text[]) into ids
    from public.people p where p.household = hh;
  v_paid := exists (select 1 from public.readers r
                     where lower(r.email) = t.email and r.paid_at is not null);

  if p_tool = 'ping' then
    return jsonb_build_object('ok', true, 'label', t.label,
      'people', (select coalesce(jsonb_agg(coalesce(p.display_name, p.id) order by p.id), '[]'::jsonb)
                   from public.people p where p.id = any(ids)));
  end if;

  if p_tool = 'overview' then
    select jsonb_build_object(
      'people', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'id', p.id, 'name', coalesce(p.display_name, p.id), 'dob', p.dob,
                 'age', case when p.dob is null then null
                             else extract(year from age(current_date, p.dob))::int end)
               order by p.id), '[]'::jsonb)
          from public.people p where p.id = any(ids)),
      'latest_readings', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'person', coalesce(p.display_name, p.id),
                 'marker', mk.id, 'name', mk.name, 'category', mk.category,
                 'value', m.value, 'unit', coalesce(m.unit, mk.unit),
                 'ref_low', m.ref_low, 'ref_high', m.ref_high,
                 'flag', case when m.flag in ('H', 'L') then m.flag
                              when m.ref_high is not null and m.value > m.ref_high then 'H'
                              when m.ref_low  is not null and m.value < m.ref_low  then 'L' end,
                 'taken_on', m.taken_on,
                 'previous', prev.j,
                 'dismissed', exists (select 1 from public.dismissals d
                                       where d.person_id = m.person_id and d.kind = 'measurement'
                                         and d.ref_id = m.id::text))
               order by p.id, mk.sort, mk.id), '[]'::jsonb)
          from (select distinct on (person_id, marker_id) *
                  from public.measurements
                 where person_id = any(ids)
                 order by person_id, marker_id, taken_on desc) m
          join public.people  p  on p.id  = m.person_id
          join public.markers mk on mk.id = m.marker_id
          left join lateral (
            select jsonb_build_object('value', m2.value, 'taken_on', m2.taken_on) as j
              from public.measurements m2
             where m2.person_id = m.person_id and m2.marker_id = m.marker_id
               and m2.taken_on < m.taken_on
             order by m2.taken_on desc limit 1) prev on true),
      'findings', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'person', coalesce(p.display_name, p.id), 'taken_on', f.taken_on,
                 'kind', f.kind, 'title', f.title, 'detail', f.detail)
               order by f.taken_on desc), '[]'::jsonb)
          from public.qualitative_findings f join public.people p on p.id = f.person_id
         where f.person_id = any(ids)),
      'nutrition_targets', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'person', coalesce(p.display_name, p.id), 'label', nt.label,
                 'kcal', nt.kcal, 'protein_g', nt.protein_g, 'carb_g', nt.carb_g,
                 'fat_g', nt.fat_g, 'fiber_g', nt.fiber_g, 'notes', nt.notes)
               order by p.id, nt.sort), '[]'::jsonb)
          from public.nutrition_targets nt join public.people p on p.id = nt.person_id
         where nt.person_id = any(ids) and nt.is_active),
      'reports', (
        select jsonb_build_object(
                 'count', count(*) filter (where not coalesce(r.planned, false)),
                 'first', min(r.taken_on) filter (where not coalesce(r.planned, false)),
                 'last',  max(r.taken_on) filter (where not coalesce(r.planned, false)),
                 'planned', (select coalesce(jsonb_agg(r2.taken_on order by r2.taken_on), '[]'::jsonb)
                               from public.reports r2
                              where r2.person_id = any(ids) and coalesce(r2.planned, false)))
          from public.reports r where r.person_id = any(ids))
    ) into res;
    return res;
  end if;

  if p_tool = 'marker' then
    q := left(btrim(coalesce(p_args ->> 'name', '')), 60);
    if q = '' then return jsonb_build_object('error', 'name is required'); end if;
    select coalesce(jsonb_agg(jsonb_build_object(
             'marker', mk.id, 'name', mk.name, 'category', mk.category, 'unit', mk.unit,
             'description', mk.description,
             'readings', (
               select coalesce(jsonb_agg(jsonb_build_object(
                        'person', coalesce(p.display_name, p.id), 'taken_on', m.taken_on,
                        'value', m.value, 'unit', coalesce(m.unit, mk.unit),
                        'ref_low', m.ref_low, 'ref_high', m.ref_high,
                        'flag', case when m.flag in ('H', 'L') then m.flag
                                     when m.ref_high is not null and m.value > m.ref_high then 'H'
                                     when m.ref_low  is not null and m.value < m.ref_low  then 'L' end,
                        'lab', r.lab)
                      order by m.taken_on, p.id), '[]'::jsonb)
                 from public.measurements m
                 join public.people p on p.id = m.person_id
                 left join public.reports r on r.id = m.report_id
                where m.marker_id = mk.id and m.person_id = any(ids)))
           order by mk.sort, mk.id), '[]'::jsonb) into res
      from public.markers mk
     where (mk.id ilike '%' || q || '%' or mk.name ilike '%' || q || '%')
       and exists (select 1 from public.measurements m
                    where m.marker_id = mk.id and m.person_id = any(ids));
    if res = '[]'::jsonb then
      return jsonb_build_object(
        'error', format('no marker matches "%s"', q),
        'available', (select coalesce(jsonb_agg(distinct mk.name), '[]'::jsonb)
                        from public.markers mk
                       where exists (select 1 from public.measurements m
                                      where m.marker_id = mk.id and m.person_id = any(ids))));
    end if;
    return res;
  end if;

  if p_tool = 'nutrition' then
    -- Same arithmetic as the page: nutrition per 100 g of edible weight,
    -- grams as weighed, price as entered for the item in that meal.
    with items as (
      select ml.id as meal_id, ml.person_id, mf.name as food, mf.sort as food_sort, mi.sort,
             f.name as ingredient, mi.amount_unit, mi.qty_g, f.grams_per_ml, f.grams_per_piece,
             mi.price, mi.comments, f.nutrients, f.source_url, f.kcal is not null as figures_known,
             coalesce(f.kcal, 0)      * e.k as kcal,
             coalesce(f.protein_g, 0) * e.k as protein_g,
             coalesce(f.carb_g, 0)    * e.k as carb_g,
             coalesce(f.fat_g, 0)     * e.k as fat_g,
             coalesce(f.fiber_g, 0)   * e.k as fiber_g
        from public.meals ml
        join public.meal_items mi on mi.meal_id = ml.id
        join public.foods f on f.id = mi.food_id
        left join public.meal_foods mf on mf.id = mi.meal_food_id
        cross join lateral (select mi.qty_g * coalesce(f.edible_yield, 1) / 100 as k) e
       where ml.person_id = any(ids))
    select coalesce(jsonb_agg(jsonb_build_object(
      'person', coalesce(p.display_name, p.id),
      'targets', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'label', nt.label, 'active', nt.is_active, 'from', nt.starts_on, 'to', nt.ends_on,
                 'kcal', nt.kcal, 'protein_g', nt.protein_g, 'carb_g', nt.carb_g,
                 'fat_g', nt.fat_g, 'fiber_g', nt.fiber_g, 'notes', nt.notes)
               order by nt.is_active desc, nt.sort), '[]'::jsonb)
          from public.nutrition_targets nt where nt.person_id = p.id),
      'activity', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'label', a.label, 'target', a.target, 'current', a.current, 'due_on', a.due_on)
               order by a.sort), '[]'::jsonb)
          from public.activity_targets a where a.person_id = p.id),
      'meals', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'time', to_char(ml.at_time, 'HH24:MI'), 'meal', ml.name, 'note', nullif(ml.time_note, ''),
                 'food', ml.food_summary,
                 'items', (
                   select coalesce(jsonb_agg(jsonb_build_object(
                            'food', i.food, 'ingredient', i.ingredient,
                            'amount', case i.amount_unit
                                        when 'ml' then round(i.qty_g / coalesce(nullif(i.grams_per_ml, 0), 1), 2)
                                        when 'piece' then case when coalesce(i.grams_per_piece, 0) = 0 then i.qty_g
                                                               else round(i.qty_g / i.grams_per_piece, 2) end
                                        else i.qty_g end,
                            'unit', case when i.amount_unit = 'piece' and coalesce(i.grams_per_piece, 0) = 0 then 'g'
                                         else coalesce(i.amount_unit, 'g') end,
                            'grams', i.qty_g,
                            'kcal', round(i.kcal, 1), 'protein_g', round(i.protein_g, 1),
                            'carb_g', round(i.carb_g, 1), 'fat_g', round(i.fat_g, 1),
                            'fiber_g', round(i.fiber_g, 1),
                            'price_inr', i.price, 'comments', nullif(i.comments, ''),
                            'nutrition', nullif(i.nutrients, ''), 'source', nullif(i.source_url, ''),
                            'figures_known', i.figures_known)
                          order by i.food_sort, i.sort), '[]'::jsonb)
                     from items i where i.meal_id = ml.id),
                 'totals', (
                   select jsonb_build_object(
                            'kcal', round(coalesce(sum(i.kcal), 0)),
                            'protein_g', round(coalesce(sum(i.protein_g), 0), 1),
                            'carb_g', round(coalesce(sum(i.carb_g), 0), 1),
                            'fat_g', round(coalesce(sum(i.fat_g), 0), 1),
                            'fiber_g', round(coalesce(sum(i.fiber_g), 0), 1),
                            'cost_inr', coalesce(sum(i.price), 0))
                     from items i where i.meal_id = ml.id))
               order by ml.at_time nulls last, ml.sort), '[]'::jsonb)
          from public.meals ml where ml.person_id = p.id),
      'day_totals', (
        select jsonb_build_object(
                 'kcal', round(coalesce(sum(i.kcal), 0)),
                 'protein_g', round(coalesce(sum(i.protein_g), 0), 1),
                 'carb_g', round(coalesce(sum(i.carb_g), 0), 1),
                 'fat_g', round(coalesce(sum(i.fat_g), 0), 1),
                 'fiber_g', round(coalesce(sum(i.fiber_g), 0), 1),
                 'cost_inr', coalesce(sum(i.price), 0))
          from items i where i.person_id = p.id)
    ) order by p.id), '[]'::jsonb) into res
      from public.people p where p.id = any(ids);
    return jsonb_build_object(
      'note', 'A planned standard day for each person, not a log of what was eaten on a date. '
              'Nutrition is per 100 g of edible weight, grams are as weighed, and prices are '
              'what the item cost in that meal, in rupees.',
      'people', res);
  end if;

  if p_tool = 'reports' then
    select jsonb_build_object(
      'reports', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'person', coalesce(p.display_name, p.id), 'taken_on', r.taken_on, 'lab', r.lab,
                 'kind', r.kind, 'planned', coalesce(r.planned, false), 'notes', r.notes,
                 'readings', (select count(*) from public.measurements m where m.report_id = r.id))
               order by r.taken_on desc, p.id), '[]'::jsonb)
          from public.reports r join public.people p on p.id = r.person_id
         where r.person_id = any(ids)),
      'findings', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'person', coalesce(p.display_name, p.id), 'taken_on', f.taken_on,
                 'kind', f.kind, 'title', f.title, 'detail', f.detail)
               order by f.taken_on desc), '[]'::jsonb)
          from public.qualitative_findings f join public.people p on p.id = f.person_id
         where f.person_id = any(ids)),
      'uploads', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'file', u.file_name, 'uploaded_at', u.uploaded_at,
                 'status', case when u.analysed_at is not null then 'analysed'
                                when v_paid then 'paid, being analysed'
                                else 'not analysed' end)
               order by u.uploaded_at desc), '[]'::jsonb)
          from public.report_uploads u where u.uid = t.uid)
    ) into res;
    return res;
  end if;

  return jsonb_build_object('error', format('unknown tool "%s"', p_tool));
end $$;

-- anon is granted EXECUTE explicitly by Supabase; name it in every revoke.
-- mcp_call() goes further: nobody but the service role.
revoke all on function public.mcp_call(text, text, jsonb) from anon, authenticated, public;
grant execute on function public.mcp_call(text, text, jsonb) to service_role;
do $$
declare f text;
begin
  foreach f in array array['mcp_token_create(text)', 'mcp_token_revoke(uuid)'] loop
    execute format('revoke all on function public.%s from anon, public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
