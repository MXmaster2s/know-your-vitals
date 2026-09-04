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

- **Doing well / Outside range** — the good news first, then anything outside
  its printed range, each with the change since your last test. It reports what
  the numbers did; what to do about them is a conversation with a doctor.
- **Every visit in full**, at the foot of the same page — the cards are what you
  check, the report list is what you scroll to when a card raises a question.
- **Trends** — every marker charted over time with the lab's reference range
  drawn as a band, so you can see whether a value is drifting.
- **Two-person comparison** — useful for couples or a parent and child.
- **Per-report filter** — see one visit in isolation, with the history up to
  that date preserved.
- **Editing is a mode** — off by default, turned on with the pencil in the
  header, so a stray tap on a phone scrolls the page instead of opening a field.
  It also decides how much is on screen: reading gives you the cards, and the
  pencil brings out the things you only need while working on the data —
  dismissing a card, restoring one, and the full report archive.
- **Search** — by marker name, id, or category.
- **Copy for AI** — every card copies a clean text block (what the marker is,
  every reading with its date, lab and range, plus a trend summary) ready to
  paste into a chat or an email to your GP.
- **Dismissals** — hide a flagged reading you have already dealt with. Keyed to
  that specific reading, so a *new* flagged result surfaces again on its own.

## Nutrition (optional)

Run `supabase/nutrition.sql` to add a **Nutrition** tab: an ingredient library
priced the way you actually shop, meal plans built from it, and macro / activity
targets to measure the plan against.

The design decision that makes it useful: nutrition is stored per 100 g of
**edible** weight, price is per kg **as purchased**, and `edible_yield` bridges
the two. Bone-in chicken at 0.65 means a kilo off the scale leaves 650 g you can
eat — so cost-per-gram-of-protein counts the bone you paid for but not the
protein you didn't get. `meal_items.share` covers dishes split between people:
enter the 400 g you cooked once, and each person's day picks up their fraction.

**The day** reads as a timetable: time, event, what was eaten, and the derived
calories, protein and cost. The first three edit in place; the totals do not,
because they are summed from the ingredients.

Tapping a row opens **Edit food**, where a meal is broken into the *Foods* it is
made of — "Salad", "Smoothie", "Dal" — each a box with its own name, totals and
ingredients, because Salad is one thing you eat and five things you bought.
Inside a box: item, amount, unit, comments, nutrition, link, price. Amounts are
in grams, millilitres or pieces — grams stay canonical, and because "half a
cucumber" means nothing without knowing what a cucumber weighs, the unit picker
asks for that conversion in the same breath.

Price is entered per item per meal, not as a per-kg rate. What a thing cost in
a meal is something you know; what it costs per kilo is a rate you would have
to work out, and per-meal is what adds up to a weekly or monthly food bill
anyway.

Ingredients are added by typing a name, not picking from a list — write down
what you ate now, look the numbers up later. A food with no figures says so
rather than counting as zero.

Every number is editable inline — reference tables are approximations and your
butcher's price is not.

## Analytics

With more than one reader, an **Analytics** section appears in the nav — but
only while editing is on, because it is about the people looking at the page
rather than the records themselves.

A two-column table: when each guest last visited, and who they are. Clicking a
row opens **Guest analytics** for that person — how many visits, first and last
seen, how they signed in, which pages they opened, and every visit with its
timestamp. There is no profile and no avatar; they followed a link, and that is
the whole relationship.

Run `supabase/analytics.sql` to enable it. Reads go through `visitor_log()` and
`visit_times()`, both `security definer`. Each checks `is_owner()` **inside the
function body**, because definer bypasses RLS — without that check any
signed-in visitor could list every other visitor's email address.

One trap worth knowing: `revoke ... from public` does **not** cover the `anon`
role, which Supabase grants EXECUTE explicitly. Since the anon key ships in the
browser bundle, any function `anon` can execute is open to the internet. Revoke
from `anon` by name.

## More than one household

Run `supabase/households.sql` to let strangers sign in without seeing each
other. A *household* is the unit of privacy: the people who set the vault up
share one, and everyone who signs in afterwards gets their own, keyed to their
auth id. Reads are scoped to your household plus one *demo* household, which
`/preview` shows to everyone as the worked example.

`ensure_me()` creates the caller's own person row on first sign-in — it is the
only path that creates a person without an admin, and it can only ever create
the caller's own. Once everyone has a row, "has a row in `people`" stops
meaning anything, so everything that matters is gated on `is_admin()` instead.
Two details that are easy to miss: a row policy says which rows you may update
and nothing about which columns, so `is_admin` and `household` are protected
with a column-level grant; and `readers` and `app_settings` must be admin-only,
or a visitor could mark themselves paid or open the whole vault.

Uploaded reports go to a private `reports` bucket under the uploader's own
folder — PDF only, 5 MB each, enforced by the bucket as well as the page — and
a `report_uploads` ledger records who sent what, so the Analytics page can list
them and mint a short-lived download link.

## Who may edit what

With more than one person in the vault, read is shared and writes are not: by
default a sign-in may change only its own rows. `people.email` maps a sign-in
to a person, `public.me()` resolves it, and `public.can_write()` decides —
your own rows always, everyone's when `people.can_edit_all` is set, which is
how one person keeps the records for a household. Every person-scoped table
carries a `read_allowed` select policy plus a `write_own` policy. `foods` stays
shared — the ingredient library belongs to the household.

Add both policies to any new person-scoped table, or it will be writable by
everyone on the allowlist.

## Planned reports

A row in `reports` with `planned = true` is a visit you intend to take. It shows
greyed out in the report filter and in a "Scheduled" list, so the next test stays
visible. Entering any measurement on that date flips it to a real report.

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
- Anyone can sign up for an account → **their email is not in `readers`, so RLS
  still returns nothing.** (Self-hosted GoTrue ships with signup enabled, so do
  not assume "authenticated" means "invited".)
- The service-role key is never used by the app and must never be put in
  `.env.local`.

### Readers, owners and viewers

Three levels, and the difference between the last two is whether you have a row
in `people`:

| | in `readers` | in `people` | can read | can write |
|---|---|---|---|---|
| Owner | yes | yes | everything | their own rows, or everyone's with `can_edit_all` |
| Viewer | yes | no | everything | nothing |
| Anyone else | no | — | nothing | nothing |

A viewer is how you give someone read access — a partner, a parent, a doctor —
without giving them a way to change anything. Add their address to `readers`,
create them a Supabase user, done. No policy changes.

There is deliberately **no anonymous read**. Because the anon key is in the
bundle, granting `select` to `anon` would not mean "people can see the page" —
it would mean anyone who loads the page can lift the key and query the whole
database directly. If you want a public link, publish a demo dataset rather
than opening the real one.

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
