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

The design decision that makes it useful: **an ingredient is measured in one
unit — a kilo, a litre or a piece — and every figure on it is per one of
those**, as purchased. A serving says how many grams, millilitres or pieces
were eaten, and its figures are that amount times the rate. Chicken is priced
and counted per kilo, oil per litre, eggs per egg. No bridging factor, and no
question about whether the 160 g of chicken on the row is the bone-in weight or
the meat: it is the bone-in weight, and the rate already knows.

That replaced a two-basis design (nutrition per 100 g *edible*, price per kg
*as purchased*, `edible_yield` bridging them) which was arithmetically fine and
impossible to read. Worse, `edible_yield` defaulted to 1, so every food nobody
had measured silently claimed zero waste and the totals believed it.
`edible_g_per_kg` now records the same fact for interest only — it is read by
nothing, because it is a number that has to be measured by hand and most rows
will never have it.

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

Price and nutrition per serving are **derived**, never typed. The ingredient is
the single place either is stated, so the same fact cannot be entered in two
tables and left to disagree with itself. A row in **Edit food** owns exactly one
thing — how much of the ingredient was eaten — and tapping it opens the
ingredient rather than a second copy of its figures.

Ingredients are added by typing a name, not picking from a list — write down
what you ate now, look the numbers up later. A food with no figures says so
rather than counting as zero.

**Nothing edits in The day.** A row opens *Edit food*, which owns the meal's
name, time and contents; a serving row there opens *Edit ingredient*, which owns
everything about the thing itself. Each module has a back arrow that lands on
the one beneath rather than dismissing the stack, and each is capped short of
the viewport so there is always somewhere to tap out of it.

Fields marked **✳** are the AI's to keep current — nutrients and the five macro
figures. The same list reaches a connected AI over MCP as rule R12.

**Ingredients** at the foot of the page is the same pantry priced the way you
shop: per kilo, as purchased. Name, what it is worth eating for, cost per kilo,
protein per kilo, edible per kilo, and the number the table exists for — **₹ per
gram of protein**.

That last column is derived from the two beside it and never stored, so it
cannot drift out of step with them. It is deliberately *not* yield-adjusted:
both figures are per kilo as purchased, so the bone and the shell are already
priced into each, and dividing by the edible fraction as well would charge you
for the waste twice. `edible_g_per_kg` is therefore read by nothing at all — it
measures the buy, not the maths, and is kept apart from `edible_yield` (which
does drive meal nutrition) so filling it in can never move a day's calories.

Blank means not looked up yet. It is never treated as zero, and the footer says
how many rows are still waiting on a figure.

Name, nutrients and every figure edit in place; the link icon beside a name
opens the same product-link dialog Edit food uses. Removing an ingredient is
the one destructive control on the page, so it says what else goes:
`meal_items.food_id` is `ON DELETE CASCADE`, meaning a food you delete takes
every ingredient line built on it — and the days those sat in quietly lose the
calories, protein and cost they contributed. The confirmation counts them
first.

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

## Connect an AI (MCP)

Run `supabase/mcp.sql` and the site gains an MCP server at `/mcp/<token>`, so
ChatGPT or Claude can read a household's data without anyone copying and
pasting. The server is a Cloudflare Pages Function (`functions/mcp/`) — it
deploys with the static site and needs two secrets, set once:

```bash
wrangler pages secret put SUPABASE_URL --project-name=<your project>
wrangler pages secret put SUPABASE_SERVICE_KEY --project-name=<your project>
```

The token is the whole credential, and the design leans on three things:

- **Minted by the owner, shown once, stored as a hash.** `mcp_token_create()`
  returns the plaintext to the signed-in browser and keeps only its SHA-256, so
  a copy of the database contains no working key. The browser is not even
  granted the hash column, and no one — not an admin — can list another
  account's tokens.
- **One function, service role only.** The server hashes the token and calls
  `mcp_call(hash, tool, args)`, which nothing in the browser bundle can execute
  — revoked from `anon`, `authenticated` and `public` by name, and checked
  again inside the function. It resolves the owner, stamps `last_used_at`, and
  answers scoped to that household. Read-only.
- **Stateless transport.** Streamable HTTP without sessions or SSE: one POST,
  one JSON reply. `initialize` verifies the token, so a wrong address fails
  when it is added rather than at the first question.

Five tools — `overview`, `marker`, `nutrition`, `ingredients`, `reports`. The
signed-in page at `/chatgpt` mints and revokes addresses and carries the setup
steps for both apps.

`ingredients` is the pantry rather than the plan, and it is the one tool with a
different denominator: **per kilo as purchased**, waste on both sides, so
`cost / protein` compares a price board fairly without any yield adjustment.
Its payload says so, because an AI that helpfully divides by `edible_g_per_kg`
as well has charged for the bone twice.

### Telling the AI how to read the data

`public/mcp-guidelines.md` is the standing brief for any connected AI: ten
numbered rules, how the data is shaped, and what the server does *not* contain.
It has one copy, served three ways, so no client misses it and nothing drifts:

| Where | What it carries |
|---|---|
| `instructions` on `initialize` | The rules section — the binding part, ~850 tokens |
| Resource `health://guidelines` | The whole document, on demand |
| `/mcp-guidelines.md` | The same file, readable by a person |

The Function reads it through the Pages `ASSETS` binding and caches it per
isolate, so adding a rule is an edit to one Markdown file and a redeploy — no
code change. `/llms.txt` points at it, and `robots.txt` allows those two paths
while disallowing everything else.

The rule that prompted it is **R1**: an AI may record facts, never commentary.
A note written into a data row is indistinguishable from the owner's own words,
so it reads as authoritative and contradicts the field beside it. **R11** is the
other one worth knowing: where a food carries a product link, that page is the
authority for its figures — estimating is what you do when there is no link, and
an estimate has to say that it is one.

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
  `.env.local`. The MCP function uses it server-side, as a Pages secret that
  never reaches a browser.

### RLS is the floor, not the filter

A policy answers "may this person touch this row at all". It is not the same
question as "what does this screen mean", and on this schema the two come apart
for exactly one person: every `is_admin()` clause widens an admin's policies to
the whole database. So a query that names no scope returns the roster for most
people and everything for an admin.

`report_uploads` is the worked example. Its select policy is
`uid = auth.uid() OR is_admin()` — correct for the table, because the Analytics
download needs to reach a guest's file — but an unfiltered read put another
account's upload under a heading reading "your reports". The fix is not to
narrow the policy; it is for the query to say what it means:
`getMyUploads()` resolves the session and filters on `uid`, and the
person-scoped reads (`getAllReports`, `getMeasurementsForMarker`, `getFoods`)
take the ids or households they are for.

**So: never let "whatever RLS returns" stand in for a scope.** Pass the ids.
The policy then catches the mistake you did not make, which is its job.

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
Supabase (Postgres + Auth) · one Cloudflare Pages Function for MCP.

## Licence

MIT — see [LICENSE](LICENSE).
