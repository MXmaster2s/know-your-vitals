# Know Your Vitals

A private dashboard for your own lab results. Point it at a Supabase project you
control, put your blood work in, and see the trends instead of a drawer full of
PDFs.

Built as a static site — there is no server to run and nothing to keep patched.
It works offline as an installable PWA.

> **Not a medical device.** It shows you your own numbers against the reference
> ranges your lab printed. It does not diagnose anything, and it is not a
> substitute for a doctor reading your report.

## What it does

- **Doing well / Needs attention** — the good news first, then anything outside
  its printed range, each with the change since your last test.
- **Trends** — every marker charted over time with the lab's reference range
  drawn as a band, so you can see whether a value is drifting.
- **Two-person comparison** — useful for couples or a parent and child.
- **Per-report filter** — see one visit in isolation, with the history up to
  that date preserved.
- **Search** — by marker name, id, or category.
- **Copy for AI** — every card copies a clean text block (what the marker is,
  every reading with its date, lab and range, plus a trend summary) ready to
  paste into a chat or an email to your GP.
- **Dismissals** — hide a flagged reading you have already dealt with. Keyed to
  that specific reading, so a *new* flagged result surfaces again on its own.

## Why reference ranges are stored per measurement

Labs disagree. One prints an ALT ceiling of 50 U/L, another 55, a third splits
it by sex. Storing the range on the *measurement* rather than the *marker* means
each reading is judged against the range that was actually printed next to it —
which is the only comparison that means anything.

## Setup

**1. Database.** Create a Supabase project (the hosted free tier is fine, or
self-host). Open `supabase/schema.sql`, **edit the `allowed` email list near the
bottom**, then run it.

**2. Users.** Create accounts for the emails you allowlisted — Supabase Studio →
Authentication → Add user, with "auto confirm" on. There is no public sign-up
flow in the app by design.

**3. People and markers.** Seed at least one row in `people`, and the markers you
care about:

```sql
insert into people (id, display_name, dob) values ('sam', 'Sam', '1990-01-01');

insert into markers (id, name, category, unit, sort, description) values
  ('hba1c', 'HbA1c', 'glycemic', '%', 13,
   'Your average blood sugar over the last 8–12 weeks.'),
  ('tg', 'Triglycerides', 'lipids', 'mg/dL', 22,
   'Fats carried in your blood. Very high levels can inflame the pancreas.');
```

**4. Run it.**

```bash
cp .env.example .env.local   # fill in your Supabase URL and anon key
npm install
npm run dev
```

**5. Deploy.** `npm run build` emits a static site to `out/`. Push that anywhere
— Cloudflare Pages, Netlify, GitHub Pages, an S3 bucket.

## Entering data

Add readings through the **+ Add** dialog, or bulk-load with SQL — every
measurement needs a `report_id`, so create the report row first:

```sql
insert into reports (id, person_id, taken_on, lab)
values ('...uuid...', 'sam', '2026-08-28', 'Some Diagnostics');

insert into measurements
  (report_id, person_id, marker_id, value, unit, ref_low, ref_high, flag, taken_on)
values
  ('...uuid...', 'sam', 'hba1c', 5.7, '%', 4, 5.6, 'H', '2026-08-28');
```

Leave `flag` null and the app derives it from the range.

## Security

The anon key ships in the browser bundle. That is normal for Supabase and safe
**only because** row-level security gates every table by email. The threat model
is:

- Anyone can hit your Supabase URL with the anon key → **RLS returns nothing.**
- Anyone can sign up for an account → **their email is not allowlisted, so RLS
  still returns nothing.**
- The service-role key is never used by the app and must never be put in
  `.env.local`.

Verify it yourself after setup — this should be `permission denied`:

```bash
curl "$SUPABASE_URL/rest/v1/measurements?select=count" -H "apikey: $ANON_KEY"
```

The service worker deliberately never caches API or auth responses, so a signed
-out phone holds no health data in its cache.

## Stack

Next.js 16 (static export) · React 19 · Tailwind 4 · shadcn/ui · Recharts ·
Supabase (Postgres + Auth).

## Licence

MIT — see [LICENSE](LICENSE).
