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

Run date: 2026-08-03.

## 1. Tables actually present (empirical)

| Table | `SELECT` via anon key | Notes |
|---|---|---|
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

### ⚪ Not independently re-verified here (need the SQL in §4 to confirm)

- Whether `UPDATE`/`DELETE` on `sightings` are actually blocked for anon
  (the code assumes yes; the boundary test that would have confirmed it
  empirically was blocked by the sandbox's own safety classifier).
  Same for `sighting_votes` (the unique-constraint-per-device comment in
  `js/storage.js` is a statement of intent, not a confirmed constraint).
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
create policy reports_anon_insert on public.reports
  for insert to anon with check (true);
-- deliberately no SELECT policy for anon — flags are a private queue,
-- readable only via the dashboard (service_role bypasses RLS)

-- R2: stop anon from reading raw sighting_votes rows; keep INSERT
-- (adjust/drop only if a SELECT policy for anon currently exists —
-- confirm via the pg_policies query in §4 first)
drop policy if exists <existing_anon_select_policy_name> on public.sighting_votes;
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
