# Self-service deletion via token (GDPR) — plan, not applied

Status: **proposal only**. No migration has been run, no code has been
written. Per Task 4's own instruction: this gets described and reviewed
first; code follows only after the migration below is confirmed applied.

This is a revision of an earlier, incomplete draft — six real problems
were found in that draft on review (missing `GRANT`, unrestricted
`INSERT`, `authenticated` role not considered, nullable token, a cast
that throws instead of failing closed, and — the important one — deleting
the row was never going to delete the uploaded photo). All six are fixed
below.

## 1. Schema

```sql
-- sightings currently has zero rows (confirmed in docs/rls-audit.md), so
-- a plain NOT NULL with no default is safe to add directly. If this ever
-- runs against a populated table, add `default gen_random_uuid()` to
-- backfill existing rows, then drop the default again immediately after
-- so future inserts are forced to supply their own token explicitly.
alter table sightings add column delete_token uuid not null;
```

`NOT NULL`, no default: the token is generated client-side
(`crypto.randomUUID()`) and must be part of every insert. A default would
let a malformed or deliberately stripped request create a row with no
token — one nobody, including its own reporter, could ever self-delete.
Combined with the column-scoped `INSERT` grant in §2, the client has no
way to omit it.

## 2. Grants and policies

```sql
-- SELECT: explicit column allowlist for anon, excluding delete_token.
-- Also revoke from authenticated -- this app never authenticates anyone
-- (no login UI), so authenticated should end up with nothing on this
-- table at all. Worth confirming via docs/rls-audit.md's grant queries
-- whether authenticated currently has something broader than anon does;
-- Supabase's default project setup sometimes grants both roles together.
revoke select on sightings from anon, authenticated;
grant select (id, lat, lng, date, type, count, description, reporter,
              photo_url, created_at, source, status)
  on sightings to anon;

-- INSERT: explicit column allowlist too -- without this, anon has
-- unrestricted INSERT on the whole row, meaning a submission could set
-- status = 'approved' or source = 'silava' directly and pass itself off
-- as official/verified data. status, source, id, created_at stay
-- server-side defaults; nothing in the client payload can touch them.
revoke insert on sightings from anon, authenticated;
grant insert (lat, lng, date, type, count, description, reporter,
              photo_url, delete_token)
  on sightings to anon;

-- UPDATE: stays fully revoked for both roles. Nobody edits a row after
-- submission, including its own reporter -- this also closes the
-- obvious attack of overwriting someone else's delete_token to hijack
-- their row.
revoke update on sightings from anon, authenticated;

-- DELETE: the base grant is required -- a CREATE POLICY on a role with
-- no GRANT DELETE just gets "permission denied" before the policy's
-- USING clause is ever evaluated. The policy is what actually narrows
-- it to "only the matching row."
grant delete on sightings to anon;

create policy sightings_delete_by_token on sightings
for delete to anon
using (
  -- Compared as text on both sides, not cast to ::uuid. A malformed or
  -- absent header would make `(...)::uuid` throw error 22P02 --
  -- correctness bug, not a security hole, but it turns an ordinary
  -- "wrong/missing token" request into a request-level 500 instead of
  -- matching zero rows and failing closed quietly.
  delete_token::text = current_setting('request.headers', true)::json->>'x-delete-token'
);
```

The token is deliberately **not** filterable via a normal URL query param
(`?delete_token=eq.<uuid>`) — Postgres requires `SELECT` privilege on a
column to reference it in *any* clause, including a `WHERE`/filter, not
just to return it. If `delete_token` had that grant, `GET
/rest/v1/sightings?select=delete_token` would dump every row's token in
one request, defeating the whole point. Routing the check through a
request header instead keeps the column completely unreadable via the
REST API while still letting RLS compare it server-side.

## 3. Photo cleanup — the part the first draft missed entirely

Deleting the `sightings` row does not delete the uploaded file from the
`sighting-photos` Storage bucket — the photo stays reachable at its
existing public URL forever. Since the photo is very plausibly the actual
personal data in play here (a person's face, vehicle, property — EXIF is
already stripped, but the image content itself isn't), a "deletion" that
only removes the database row while the photo stays live doesn't actually
fulfill the request. Anon must not get a direct Storage `DELETE`
policy — the file removal has to go through something privileged. Two
ways to do it:

**Option A — Supabase Edge Function.** A small Deno function
(`delete-sighting`) that:
1. Takes `{ id, token }` from the client.
2. Using the service-role key (stored as a function secret, never shipped
   to the browser), reads the row's `photo_url`, checks `delete_token`
   matches.
3. Deletes the Storage object first, then the database row.
4. Client calls it once: `POST
   https://<project>.functions.supabase.co/delete-sighting`.

Pros: one call from the client, straightforward TypeScript, testable
locally (`supabase functions serve`), readable logs in the dashboard. It
only covers *this* deletion path, though — a manual moderation delete
done by hand in the Table Editor wouldn't trigger it, and the photo would
need to be removed by hand in that case too.

**Option B — a database trigger.** An `AFTER DELETE` trigger on
`sightings` that fires on *any* row deletion — including manual ones done
via the dashboard — and calls the Storage REST API (via the `pg_net`
extension for an async HTTP call) using a service-role key held in
Supabase Vault.

Pros: catches every deletion path, not just the token flow, with nothing
to remember to do by hand. Cons: needs `pg_net` enabled and a secret
provisioned in Vault, is meaningfully harder to test/debug than a
function with real tooling around it, and a synchronous failure mode
inside a trigger firing on every `DELETE` is a worse place for something
to go quietly wrong than an isolated function call.

**Recommendation: Option A.** This project has no backend code at all
today — an Edge Function is a smaller, more contained addition, easier to
read and maintain solo, and the gap it leaves (manual dashboard deletes
not auto-cleaning Storage) is a rare, deliberate admin action rather than
something that needs to be airtight the way the unattended self-service
flow does. Worth remembering to delete the photo by hand on those
occasions, not worth the added complexity of Vault + `pg_net` to close
automatically.

## 4. Frontend, once the migration above is confirmed applied

- `crypto.randomUUID()` client-side at submit time; include as
  `delete_token` in the `addSighting()` payload.
- Success toast shows `https://lacupedas.lv/?delete=<id>:<token>` (both
  parts needed — the token alone can't be looked up, since it isn't
  readable via SELECT; the id targets the row, the token goes in the
  `x-delete-token` header on the actual delete call to whichever of
  §3's two paths gets built).
- On load, if `?delete=` is present: show a confirmation UI, **then
  immediately clear it from the address bar** via
  `history.replaceState(null, "", location.pathname)` — a token sitting
  in the visible URL persists in browser history and would be sent as a
  `Referer` header if the confirmation page loads anything external
  (images, fonts, analytics), leaking it well after the tab is closed.
- Update `privacy.html` to describe the mechanism and give
  `lacupedas@gmail.com` as the fallback for a lost link.

None of this — frontend or the Edge Function — gets built until the
migration in §1–§2 is confirmed applied.
