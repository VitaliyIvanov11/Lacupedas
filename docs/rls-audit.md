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
in a single run.

**Status: not yet closed.** Everything in this file past §1 is either
inferred from code or is a *proposed* fix — none of it confirms what's
actually configured on the live database. Closing it needs §4's query
block run once in the Supabase SQL editor, with the output brought back
here — that's the only remaining step; nothing else requires more
investigation first.

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

- Whether `UPDATE`/`DELETE` on `sightings` are actually blocked for anon
  **at the grant level**, not just whether a policy exists (see R4) — the
  boundary test that would have confirmed this empirically was blocked by
  the sandbox's own safety classifier. Same for `sighting_votes` (the
  unique-constraint-per-device comment in `js/storage.js` is a statement
  of intent, not a confirmed constraint).
- Whether `authenticated` has broader grants on `sightings`/
  `sighting_votes` than `anon` does — this project never authenticates
  anyone (no login UI), but Supabase's default project setup sometimes
  grants both roles together, which would leave a real gap invisible from
  the app's own behavior. Explicitly check both roles, not just anon.
- Exact `USING`/`WITH CHECK` clause text for every existing policy.
- Whether any column beyond what `rowToSighting()` reads
  (`id, lat, lng, date, type, count, description, reporter, photo_url,
  created_at, source, status`) exists on `sightings` and gets exposed via
  `select=*` — the table being empty means there's no live row to inspect
  the shape of; `information_schema.columns` (§4) answers this directly.

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

Two separate things bundled here: creating the missing `reports` table
(R1), and tightening `sighting_votes` (R2). Apply as separate migrations,
one at a time, per the task's own instruction — not run yet.

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

-- R2: stop anon (and authenticated, if it turns out to have the same
-- grant -- check via the role_table_grants query in §4 first) from
-- reading raw sighting_votes rows. Drop the RLS policy AND revoke the
-- base grant -- a table-level GRANT SELECT with no matching policy would
-- still return zero rows under RLS, but leaving the unused grant in
-- place is needless surface, and DELETE-then-DROP-policy without the
-- REVOKE would leave a client able to see the table shape via an
-- explicit empty-result query. Fill in the actual policy name(s) found
-- via the pg_policies query in §4 -- name is a placeholder.
drop policy if exists <existing_select_policy_name> on public.sighting_votes;
revoke select on public.sighting_votes from anon, authenticated;
-- keep INSERT (needed for casting a vote) -- confirm its grant/policy
-- survives this unchanged, don't run a blanket REVOKE ALL here
```

## 6. What this audit did *not* do

- Did not attempt any `INSERT`/`UPDATE`/`DELETE` against live tables,
  including zero-match-filter tests (blocked by the sandbox, and correctly
  so — not worth arguing around for a read-only audit).
- Did not test the Storage upload/delete endpoints directly (would need a
  real file upload to observe behavior; out of scope for "don't change
  anything").
- Did not check `auth.*` tables/policies — this project doesn't use
  Supabase Auth (no login), so there's nothing there to audit.
