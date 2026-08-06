# Supabase RLS audit

Read-only audit. No data was changed. Two sources of evidence, kept separate:

- **Empirical** — direct `curl` requests against the live REST API using the
  same public anon key already embedded in `js/storage.js` (the same key
  every visitor's browser sends). Only `SELECT`-shaped requests were run.
  An attempted `PATCH`/`DELETE` boundary test (targeting a row ID that
  matches nothing, `id=eq.00000000-0000-0000-0000-000000000000`, so it
  would touch zero rows either way) was blocked by this environment's own
  safety classifier before it reached the network — a reasonable call, since
  the classifier can't verify the filter is a no-op from the request alone.
  So mutation permissions below are **not** empirically confirmed here.
- **From code** — what `js/storage.js`/`js/photo.js` assume/rely on, which
  is a statement of intent, not proof of the live configuration.

Run date: 2026-08-03. Revised 2026-08-04 after review caught that this
audit's own §5 SQL had the exact class of bug it was meant to be finding
(R4) — proposing a `CREATE POLICY` without the `GRANT` it depends on. §4's
query list is now consolidated into one block below so this can be closed
in a single run. Revised again 2026-08-04 with the user's actual query
results (§1b) — the core question (task item 3: can anon actually
INSERT/UPDATE/DELETE) is now empirically answered.

**Status: core findings closed, R5 applied.** §1b below has real output
for the table/policy/column shape of `sightings`/`sighting_votes`. The
user ran R5's migration (§5) on 2026-08-04 — `source`/`status` now exist
on `sightings`, confirmed empirically (`select=source,status` returns
`200 []`, not a column-does-not-exist error). Task 5 is now unblocked.
Still open, lower priority (doesn't block Task 5): `sighting_votes`'
exact column list/unique-constraint text, and the Storage bucket/
object-policy queries in §4 — nobody has run those yet.

## 1b. Empirical results (from the user's own SQL Editor run, 2026-08-04)

**RLS is enabled** on both tables (`rowsecurity = true`). Only 4 policies
exist in the entire `public` schema:

| Table | Command | Roles | Condition |
| --- | --- | --- | --- |
| `sightings` | INSERT | public | unrestricted (`with_check = true`) |
| `sightings` | SELECT | public | unrestricted (`qual = true`) |
| `sighting_votes` | INSERT | public | unrestricted (`with_check = true`) |
| `sighting_votes` | SELECT | public | unrestricted (`qual = true`) |

**No UPDATE or DELETE policy exists for either table.** This resolves the
open question this audit flagged earlier: yes, `anon`/`authenticated` both
hold a table-level `UPDATE` *grant* on every column of both tables (see §1
below) — but with RLS enabled and zero UPDATE policies, Postgres denies
the command entirely regardless of the grant (a non-owner role with RLS
on gets zero rows for any command with no matching policy). **So UPDATE
is not actually exploitable today** — sloppy (the unused grant should
still be revoked, defense in depth), but not a live hole. Correcting the
alarm raised earlier in this same conversation before this data came in.

**`sightings`' real, live column list** (confirms/updates R1's context):
`id, lat, lng, date, type, count, description, reporter, created_at,
photo_url` — nine columns. **`source` and `status` do not exist.**
`js/storage.js`'s `rowToSighting()` already anticipated this (`row.source
|| "community"`, `row.status || "approved"`, with a comment explaining
exactly why), so nothing is broken today — but it does mean **Task 5
(historical Silava/DAP import) cannot mark anything as non-community
without a migration first** — see §5 R5 below for the proposed one.

## 1. Tables actually present (empirical)

| Table | `SELECT` via anon key | Notes |
| --- | --- | --- |
| `sightings` | `200 OK`, `[]` | Table exists, RLS allows anon `SELECT`, currently **zero rows** (matches Task 5's premise — the map has no historical data yet). |
| `sighting_votes` | `200 OK`, `[]` | Table exists, RLS allows anon `SELECT`. **This is worth double-checking against intent** — see risk R2 below. |
| `sighting_vote_counts` | `200 OK`, `[]` | Exists (view or table), anon `SELECT` works, currently no rows (follows from `sighting_votes` being empty). |
| `reports` | `404`, `PGRST205: Could not find the table 'public.reports' in the schema cache` | **The table does not exist in the live database.** README documents it as an existing INSERT-only moderation-flag table backing the 🚩 button — that documentation describes intent/design, not current reality. |

Exact commands run:

```bash
curl -s -o /tmp/resp.json -w "HTTP %{http_code}\n" \
  "https://rhmtifjbnqpikzdwgrre.supabase.co/rest/v1/<table>?select=*&limit=1" \
  -H "apikey: <anon key>" -H "Authorization: Bearer <anon key>"
```

(run once per table: `sightings`, `reports`, `sighting_votes`, `sighting_vote_counts`)

## 2. Findings and risks, by priority

### 🔴 R1 — `reports` table doesn't exist; the 🚩 "report an issue" feature is silently broken

`js/storage.js`'s `submitReport()` POSTs to `/rest/v1/reports`. Since that
table isn't in the schema cache, every submission gets a `404` from
PostgREST. `submitReport()` catches the error and returns `"error"` —
whatever `js/report-issue.js` does with that (worth a quick look, not
re-verified here) determines whether a visitor sees a clear failure or a
silent no-op. Either way, **no flag has ever actually reached storage**,
which also means the moderation workflow README describes for this table
has never had real data to act on.

**Fix**: run the `CREATE TABLE reports ...` migration (see §4) — this is
new, not a repair of something misconfigured.

### 🟡 R2 — anon can `SELECT` raw `sighting_votes`, not just the aggregate

The app only ever reads `sighting_vote_counts` (the aggregate) — nothing
in the front end needs row-level access to `sighting_votes`. But the
table itself answers `SELECT` for anon too, which means each individual
vote row (`sighting_id`, `device_id`, `vote_type`, whatever timestamp
column exists) is readable by anyone who queries `/rest/v1/sighting_votes`
directly, not just through the aggregate view. `device_id` is a
client-generated random UUID (not linked to any real identity), so this
isn't a personal-data leak, but it is more surface than the app needs —
someone could enumerate exact vote patterns per sighting instead of just
totals. Least-privilege says anon shouldn't have `SELECT` here at all,
only `INSERT`, with `sighting_vote_counts` as the sole public read path.

**Fix**: SQL in §4 to drop anon `SELECT` on `sighting_votes` — confirm
`sighting_vote_counts` still works for the front end after (it's read via
a separate endpoint, so it should be unaffected, but verify before
relying on it).

### 🟡 R3 — Storage bucket MIME/size policy: status unknown, not yet configured per earlier work

Already flagged in README (from earlier this session): `js/photo.js`'s
MIME-type and file-size checks (`file.type.startsWith("image/")`,
`PHOTO_MAX_SOURCE_BYTES`) are client-side only. Nothing here re-verifies
whether the `sighting-photos` bucket itself has `file_size_limit`/
`allowed_mime_types` set — that needs the SQL query in §4 (or the
dashboard) to check, since `storage.buckets` isn't reachable through the
same anon-key REST calls used for the table checks above.

### 🔴 R4 — RLS policies alone don't prove anything without checking the base grants

A caught gap in this audit's own methodology, worth stating plainly:
everything above (and the R1/R2 fixes proposed in §5, in their first
draft) checked `pg_policies`, but a `CREATE POLICY` is meaningless if the
role doesn't have the underlying `GRANT` — Postgres checks table/column
privileges *before* RLS is even evaluated. A policy permitting `DELETE`
on a role with no `GRANT DELETE` just gets `permission denied` before the
policy's `USING` clause runs at all. §4 now has queries against
`information_schema.role_table_grants`/`role_column_grants` to check this
directly — that's the actual missing piece for confirming "can anon
physically INSERT/UPDATE/DELETE" (task item 3), not just "is there a
policy that would allow it if the grant existed."

### ⚪ Not independently re-verified here (need the SQL in §4 to confirm)

Resolved by §1b: whether UPDATE/DELETE are actually blocked (yes, by RLS
default-deny), exact policy `qual`/`with_check` text (all unrestricted —
see table in §1b), and `sightings`' real column list (confirmed, no
`source`/`status`). `authenticated` was confirmed to hold the identical
grants to `anon` on every column checked — moot either way since this
project never authenticates anyone, but worth having confirmed rather
than assumed.

Still open, lower priority (doesn't block Task 5's prerequisite):

- `sighting_votes`' exact column list and whether a real `UNIQUE
  (sighting_id, device_id)` constraint backs the "already voted" `409`
  handling in `js/storage.js`, or whether that's just an assumption.
- Storage bucket config (`file_size_limit`/`allowed_mime_types` on
  `sighting-photos`) and Storage object policies — nobody's run those two
  queries from §4 yet.

## 3. Vote-counter integrity (task item 4)

Already matches the target architecture, which is good: votes live in a
separate `sighting_votes` table (`sighting_id`, `device_id`, `vote_type`,
per the comment in `js/storage.js`), not a directly-incremented column on
`sightings`. That means an anon client can't just `PATCH
sightings?id=eq.X` with `{"confirm_count": 9999}` even if it wanted to —
there's no such column for it to write to; `sighting_vote_counts` is
presumably a `COUNT(*) GROUP BY` view over the real vote rows. The
remaining open question is whether `sighting_votes` itself has a real
`UNIQUE (sighting_id, device_id)` constraint stopping the same device
from voting twice by replaying the same `POST` — `js/storage.js` handles
an HTTP `409` response as "already voted," which implies a unique
constraint conflict is expected, but this wasn't independently confirmed
against the live schema (see §4 to check).

## 4. SQL to run yourself in the Supabase SQL editor

Read-only — none of these change anything. Run each, and the answers fill
in every "not independently re-verified" gap above.

```sql
-- Which tables exist in public, and is RLS enabled on each
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public';

-- Every existing policy: table, command, role, using/with check
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd;

-- Full column list for sightings (catches anything rowToSighting() doesn't read)
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'sightings'
order by ordinal_position;

-- Same for sighting_votes
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'sighting_votes'
order by ordinal_position;

-- Confirm the unique-vote constraint actually exists
select conname, contype, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.sighting_votes'::regclass;

-- Storage bucket config: size limit, allowed MIME types
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'sighting-photos';

-- Storage object policies (who can INSERT/SELECT/UPDATE/DELETE objects)
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects';

-- Table-level grants for anon/authenticated -- the piece pg_policies
-- alone can't show (R4): does the role even have the base privilege a
-- policy would need to matter at all.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('sightings', 'sighting_votes', 'sighting_vote_counts', 'reports')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;

-- Column-level grants -- catches a table-level GRANT SELECT that's
-- broader than intended (e.g. exposing every column instead of an
-- explicit allowlist).
select grantee, table_name, column_name, privilege_type
from information_schema.role_column_grants
where table_schema = 'public'
  and table_name in ('sightings', 'sighting_votes')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, column_name, privilege_type;
```

## 5. Proposed policies (not applied — for review only)

Three separate things bundled here: creating the missing `reports` table
(R1), tightening `sighting_votes` (R2), and adding `source`/`status` to
`sightings` (R5, the actual prerequisite Task 5 is blocked on). Apply as
separate migrations, one at a time, per the task's own instruction — not
run yet.

```sql
-- R1: create the missing reports table (write-only from anon's side,
-- matching what README already describes as the intended design)
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('sighting', 'news')),
  target_id text not null,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;

-- A CREATE POLICY alone grants nothing (R4) -- this GRANT is the actual
-- privilege; the policy below only narrows it. Column-scoped so a
-- request can't set id/created_at itself.
grant insert (target_type, target_id, reason) on public.reports to anon;

create policy reports_anon_insert on public.reports
  for insert to anon with check (true);
-- Deliberately nothing else: no SELECT/UPDATE/DELETE grant *or* policy
-- for anon or authenticated -- flags are a private queue, readable only
-- via the dashboard (service_role bypasses RLS and grants entirely). A
-- brand-new table has no privileges for either role until explicitly
-- granted, so there's no legacy over-grant to worry about here, unlike
-- R2 below.

-- R2: stop anon/authenticated (§1b confirmed both hold the grant) from
-- reading raw sighting_votes rows. Drop the RLS policy AND revoke the
-- base grant -- a table-level GRANT SELECT with no matching policy would
-- still return zero rows under RLS, but leaving the unused grant in
-- place is needless surface, and DROP-policy-only without the REVOKE
-- would leave a client able to see the table shape via an explicit
-- empty-result query. Policy name confirmed via §1b's pg_policies run.
drop policy if exists "Public can read votes" on public.sighting_votes;
revoke select on public.sighting_votes from anon, authenticated;
-- keep INSERT (needed for casting a vote) -- confirm its grant/policy
-- survives this unchanged, don't run a blanket REVOKE ALL here

-- R5 (task 5's prerequisite): sightings has no source/status columns at
-- all yet (§1b) -- js/storage.js already defaults to "community"/
-- "approved" when they're absent, so adding them is additive, not a
-- behavior change for existing rows. The risk is what happens right
-- after: the existing "Public can insert sightings" policy has
-- with_check = true (unrestricted), and §1b's grants look table-level
-- (identical privilege set across every existing column) -- a
-- table-level GRANT auto-extends to columns added later, so without the
-- explicit revoke below, the report form's public INSERT would
-- immediately be able to set source='silava'/status='verified' on its
-- own submission, indistinguishable from a real import. Defaults still
-- make every *existing* insert path (the report form) keep working
-- unchanged; it just can no longer touch these two columns itself.
alter table public.sightings
  add column source text not null default 'community',
  add column status text not null default 'approved';

revoke insert (source, status) on public.sightings from anon, authenticated;
revoke update (source, status) on public.sightings from anon, authenticated;
-- No explicit grant select needed -- §1b shows SELECT is already a
-- table-level grant for both roles, which auto-extends to these new
-- columns the same way INSERT/UPDATE would have without the revokes
-- above. Confirm after running: SELECT still returns source/status,
-- and a normal report-form submission (a plain INSERT with only the
-- 8 form columns) still succeeds unchanged.

-- R6: verified_news -- moves the "human confirmed this news item's claim"
-- flag (formerly a hardcoded VERIFIED_LINKS array in scripts/fetch-news.js,
-- edited via commit) into a table the site owner edits directly in the
-- SQL Editor/Table Editor, no git required. scripts/fetch-news.js reads it
-- with the same public anon key js/storage.js already uses -- a brand-new
-- table starts with zero privileges for anon/authenticated until granted,
-- so only the explicit SELECT grant below is needed; there's no INSERT/
-- UPDATE/DELETE grant or policy for either role, matching R1's reports
-- table above -- marking a link verified only ever happens as the table
-- owner (dashboard/SQL Editor connection bypasses RLS), never through the
-- public key.
create table public.verified_news (
  link text primary key,
  verified_at timestamptz not null default now()
);
alter table public.verified_news enable row level security;

grant select on public.verified_news to anon, authenticated;
create policy "Public can read verified news" on public.verified_news
  for select using (true);

-- Seed with the 3 links that were verified under the old hardcoded list,
-- so nothing already-confirmed silently un-verifies on the first run
-- after this migration.
insert into public.verified_news (link) values
  ('https://kodols.lv/pieriga/ropazi/video-ropazu-novada-manits-lacis-ko-darit-ja-sastopies-ar-to-aci-pret-aci-203464'),
  ('https://gorod.lv/novosti/365549-pogranichniki-kaplavskogo-otdeleniya-zasnyali-medvedya-pytavshegosya-oboiti-ograzhdenie-video'),
  ('https://gorod.lv/novosti/357769-v-latvii-vpervye-zafiksirovali-napadenie-burogo-medvedya-na-loshad');
```

To mark a new link verified going forward, run:

```sql
insert into public.verified_news (link) values ('https://...') on conflict do nothing;
```

To un-verify one, `delete from public.verified_news where link = 'https://...';`

## 6. What this audit did *not* do

- Did not attempt any `INSERT`/`UPDATE`/`DELETE` against live tables,
  including zero-match-filter tests (blocked by the sandbox, and correctly
  so — not worth arguing around for a read-only audit).
- Did not test the Storage upload/delete endpoints directly (would need a
  real file upload to observe behavior; out of scope for "don't change
  anything").
- Did not check `auth.*` tables/policies — this project doesn't use
  Supabase Auth (no login), so there's nothing there to audit.
