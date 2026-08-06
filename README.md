# Lacupedas — Lāču Novērojumi Latvijā / Bear Sightings in Latvia

A small, bilingual (Latvian / English) static web app for tracking bear
sightings, tracks/signs, and livestock/beehive damage across Latvia on an
interactive map.

- Static frontend (HTML/CSS/vanilla JS, no build step) backed by
  [Supabase](https://supabase.com/) (hosted Postgres + REST API) for
  community reports — every visitor sees everyone else's reports, not just
  their own. See [Community reports storage](#community-reports-storage)
  below for the schema and security model.
- Map powered by [Leaflet](https://leafletjs.com/) + OpenStreetMap tiles (loaded from CDN).
- There's no export/import or delete UI by design, to keep the surface area
  small — the reports table is shared, so public deletion isn't offered.
- The map starts empty of community reports for every new visitor (no seeded
  demo data).
- A scheduled GitHub Action also collects bear-related mentions from public
  Latvian (+ border-area Estonian/Lithuanian) news sources and shows them on
  the map as a "News mentions" layer — see
  [News auto-collection](#news-auto-collection) below. The stats panel and
  monthly chart reflect community reports **and** news mentions combined.
- Single-viewport layout on desktop (≥900px): the app fills the screen with
  no page-level scroll — the sightings list and news list each scroll inside
  their own card. Below 900px it reverts to a normal stacked, scrollable
  mobile layout, since cramming a map + four cards into one small screen
  isn't realistic.
- Both lists have compact type/source + time filters that affect the list
  **and** the map markers together — the news source dropdown is populated
  dynamically from whatever sources are actually present in the loaded
  `public.news` rows rather than a hardcoded list. Filters are purely
  client-side (re-filter already-loaded data, no re-fetch) and don't
  affect the stats panel/chart,
  which stay totals-over-everything.
- Sighting and news markers cluster on the map (`leaflet.markercluster`) as
  independent groups per layer (brand green for sightings, indigo for news)
  so a cluster bubble's count and color never blend the two meanings.
- Basic SEO: keyword-targeted title/description, Open Graph tags,
  `WebSite`/`Organization`/`Dataset`/`FAQPage` JSON-LD blocks,
  `robots.txt`/`sitemap.xml`, and a collapsed-by-default FAQ (`<details>`,
  real static text with source citations linked inline, capped-height +
  internally scrollable so it can't blow out the no-scroll desktop layout)
  answering the exact queries this is meant to rank for ("kur dzīvo lācis",
  "lāča pēdas"). There's deliberately no `SearchAction` JSON-LD — the site
  has no real text-search endpoint (only the report-form's `?report=1`
  query param), and Google's guidance is explicit that the action must
  correspond to something the site actually does; a non-functional
  `SearchAction` is worse than none. Submitting the site to Google Search
  Console itself is a manual, account-owner-only step — not something
  committed here.

## Run locally

Any static file server works. From this folder:

```bash
# Python
python -m http.server 8000

# Node
npx serve .
```

Then open `http://localhost:8000`. (Opening `index.html` directly via
`file://` mostly works too, but the "use my current location" button needs a
secure context — `http://localhost` or `https://` — to get geolocation
permission from the browser.)

## Deploy to GitHub Pages

The site is currently live at the default GitHub Pages URL. The
`lacupedas.lv` domain isn't registered/pointed yet — once it is:

1. Add a `CNAME` file to the repo root containing `lacupedas.lv` (or set the
   custom domain in **Settings → Pages → Custom domain** — either way does
   the same thing and keeps the two in sync).
2. At your DNS provider, point the **apex domain** `lacupedas.lv` at GitHub
   Pages. Since apex domains can't use a plain `CNAME` record, use one of:
   - Four `A` records for `lacupedas.lv` pointing to GitHub Pages' IPs:
     `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
     (and matching `AAAA` records if you want IPv6), **or**
   - An `ALIAS`/`ANAME` record at the apex pointing to `<your-github-username>.github.io`,
     if your DNS provider supports it.
   - If you also want `www.lacupedas.lv` to work, add a `CNAME` record for
     `www` pointing to `<your-github-username>.github.io`.
3. Back in **Settings → Pages**, once DNS resolves, tick **Enforce HTTPS**.

DNS propagation can take anywhere from a few minutes to ~24 hours. Until the
domain resolves, keep the `CNAME` file **out** of the repo — GitHub Pages
redirects the default `github.io` URL to whatever domain that file names,
which breaks the default URL while the custom domain isn't resolving yet.

## Community reports storage

`js/storage.js` talks directly to a Supabase project's auto-generated REST
API from the browser — no server code of ours in between. The `SUPABASE_URL`
and `SUPABASE_ANON_KEY` constants at the top of that file are meant to be
public: Supabase's security model is Row Level Security (RLS) policies on
the table, not a secret key. The `sightings` table's policies allow the
public role to `SELECT` and `INSERT` only — no `UPDATE`/`DELETE` — so:

- Anyone can submit a report through the site (no login), and everyone sees
  it (polled every 2 minutes, same pattern as the news layer).
- Nobody can edit or delete a report through the site, including their own.
  Moderation (removing spam/bad data) happens by hand in the Supabase Table
  Editor.
- Because the anon key is public by design, the table is technically
  writable by anyone who extracts it from the page source, not only through
  this UI. That's an accepted trade-off for a keyless, no-login community
  tool. The report form has two client-side anti-spam measures — a hidden
  honeypot field (`name="website"` on `#sighting-form`; a filled-in value
  makes the submit silently no-op instead of inserting) and a 30-second
  per-browser submit cooldown (`REPORT_COOLDOWN_MS` in `js/report-form.js`,
  tracked via `localStorage`) — but neither stops someone hitting the
  Supabase REST API directly. If spam becomes a real problem, the next
  steps are a real CAPTCHA challenge (e.g. Cloudflare Turnstile) verified
  by a Supabase Edge Function before insert, or turning on the moderation
  queue described below.

Table schema (`sightings`): `id uuid`, `lat float8`, `lng float8`,
`date date`, `type text` (`sighting`/`tracks`/`damage`/`dead`/`dna_sample`),
`count int`, `description text`, `reporter text`, `photo_url text`,
`created_at timestamptz`. The `type` values are enforced by a `CHECK`
constraint (`sightings_type_check`) — adding a new type means an `ALTER
TABLE ... DROP/ADD CONSTRAINT` in Supabase, not just a front-end change.

Exact coordinates are stored and shown for every type. That's normally a
concern for location-sensitive reports (e.g. a den/burrow, which poachers
could target), but none of the current five types represent a fixed,
revisitable location like that — `sighting`/`tracks`/`damage`/`dead` are
one-off encounters, and `dna_sample` is a collected sample, not a site. If
a den/migas-type report is ever added, its coordinates should be rounded
(e.g. to ~1km) before display, same reasoning as the EXIF stripping above.

### Planned: extended report fields (not yet built)

Two fields would add real value without inventing new `type` categories:
a **time of day** (morning/day/evening/night) and a **cub count** separate
from the total headcount — DAP's own guidance specifically calls out
females with cubs as a population-growth signal (already reflected in the
FAQ's "lācenes ar mazuļiem" note), and time-of-day is standard monitoring
metadata. Checked DAP's public bear-reporting guidance before writing this
(dabasdati.lv submissions, precise date + GPS + photo/video) — it doesn't
document a separate "how observed" field beyond what `type` already covers
(`tracks`/`pazīmes` already umbrellas footprints, fur, feces, and claw
marks/scratches per that guidance), so no new `type` values are proposed.

These aren't wired up yet, unlike `source`/`status` above, for a different
reason: those are read-only groundwork (`rowToSighting()` just defaults an
absent column, which is always safe), but a new form field needs to be
part of the `INSERT` payload — and PostgREST rejects an insert that
references a column the table doesn't have yet. Shipping the fields in
the form now, before the columns exist, would either break every
submission or (if the fields were UI-only and silently dropped) mislead
reporters into thinking data was saved that wasn't. So this stays
documentation until the migration is actually run:

```sql
ALTER TABLE sightings ADD COLUMN time_of_day text;
ALTER TABLE sightings ADD CONSTRAINT sightings_time_of_day_check
  CHECK (time_of_day IS NULL OR time_of_day IN ('morning', 'day', 'evening', 'night'));
ALTER TABLE sightings ADD COLUMN cub_count int;
ALTER TABLE sightings ADD CONSTRAINT sightings_cub_count_check
  CHECK (cub_count IS NULL OR (cub_count >= 0 AND cub_count <= count));
```

Once that's run: add two optional fields to `#sighting-form` in both
index.html and map.html (time-of-day `<select>`, cub-count `<input
type="number">` shown alongside the existing `count` field), include them
in `submitReportForm()`'s `sighting` object and `addSighting()`'s payload,
and read them back in `rowToSighting()`.

### Historical/official data (not yet imported)

`js/storage.js`'s `rowToSighting()` and the front end already understand a
`source` column (`"community"` by default, `"silava"` or `"dap"` shown as a
small badge next to the sighting — see `sourceLabel()` in
`js/sightings-panel.js`) — but the column doesn't exist in the live table
yet, since this repo has no direct database access to run the migration
(Supabase schema changes go through the dashboard's SQL editor, by hand):

```sql
ALTER TABLE sightings ADD COLUMN source text NOT NULL DEFAULT 'community';
ALTER TABLE sightings ADD CONSTRAINT sightings_source_check
  CHECK (source IN ('community', 'silava', 'dap'));
```

Until that's run (and actual historical points from LVMI Silava's "Lāču
monitorings 2023.–2025." report or DAP's ~827 2025 observation reports are
hand-imported with the matching `source` value), every row is implicitly
`"community"` and no badge appears — this is groundwork, not a populated
feature. Import only real, verifiable points — see the "verify the specific
claim" note under News auto-collection for why a plausible-looking but
unverified data point is worse than no data point.

### Moderation (groundwork only — queue not active)

`rowToSighting()` also already understands a `status` column
(`"pending"`/`"approved"`/`"rejected"`) and `loadSightings()` only returns
rows where `status === "approved"`. Like `source` above, the column
doesn't exist in the live table yet, so `row.status` is always `undefined`
and defaults to `"approved"` — every existing and new row stays instantly
visible, exactly like today. Nothing changes until the column is added:

```sql
ALTER TABLE sightings ADD COLUMN status text NOT NULL DEFAULT 'approved';
ALTER TABLE sightings ADD CONSTRAINT sightings_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));
```

To actually turn moderation on later: change that column's `DEFAULT` to
`'pending'`, then approve/reject new reports by hand in the Supabase Table
Editor (same place the 🚩 `reports` queue is already reviewed — see
"Reported issues" below). Also tighten the public `SELECT` RLS policy to
`status = 'approved'` at the same time — the client-side filter above is a
display nicety, not access control, since the anon key can read the raw
table directly regardless of what this JS does with the result.

### Public data export

stats.html's sightings list has a "⬇ CSV" button
(`downloadSightingsCsv()` in `js/sightings-panel.js`) that exports the
currently-loaded community sightings as a CSV file, client-side, no
server involved. This isn't new data exposure — it's the same fields
`rowToSighting()` already returns from the public (anon-key) Supabase
REST endpoint, just packaged as a convenient bulk download instead of
requiring someone to script against the API themselves.

Push notifications and full PWA offline mode were considered and
deliberately skipped for now: push needs a subscription-storing backend
and a paid/registered push service this project doesn't have, and an
offline cache mostly buys nothing here since the whole point of every
page is live, Supabase-backed data — a cached shell would just show
stale or empty content. Neither is worth the added complexity yet.

**Self-service deletion (GDPR, deferred):** privacy.html is honest that
this isn't available today — deletion happens by email request, which is
GDPR-compliant, just not self-service. Full design (schema, grants, RLS
policy, and — the part easy to miss — actually deleting the uploaded
photo from Storage too, not just the database row) is in
`docs/deletion-token-plan.md`. Proposal only; nothing here is built until
that migration is confirmed applied.

### Confirm/dispute voting

A second table, `sighting_votes` (`id uuid`, `sighting_id uuid` references
`sightings`, `device_id text`, `vote_type text` — `confirm`/`dispute`,
`created_at`), lets visitors confirm or dispute a report without touching
the `sightings` row itself — the row stays insert-only, votes are counted
by a `sighting_vote_counts` view (`GROUP BY sighting_id`) that the front end
queries for the per-sighting tallies.

One vote per browser per sighting is enforced with a `UNIQUE (sighting_id,
device_id)` constraint in the database, not just by hiding the buttons
client-side — a duplicate insert gets a real `409` from Postgres, so
clearing `localStorage` doesn't let the same visitor vote again. `device_id`
is a random UUID generated on first use and kept in `localStorage`
(`js/storage.js`'s `getDeviceId()`) — it identifies a browser, not a person,
and isn't tied to any other identity.

### Photo uploads

`js/photo.js` handles the optional photo attachment: it downscales the
image client-side (canvas, max 1600px on the long edge, JPEG quality 0.82)
before uploading straight to a public Supabase Storage bucket named
`sighting-photos`, then stores the resulting public URL in the sighting's
`photo_url`. Compressing client-side matters here specifically because the
free Storage tier is capped at 1GB — a few hundred uncompressed phone
photos would eat through that fast, compressed JPEGs get a lot more mileage.

The bucket needs its own `storage.objects` RLS policies (public
`INSERT`/`SELECT`, scoped to `bucket_id = 'sighting-photos'`) — the bucket
name is load-bearing: it must match exactly between the Supabase dashboard,
the SQL policies, and `PHOTO_BUCKET` in `js/photo.js`, or uploads fail with
a generic RLS "row violates policy" error that gives no hint the actual
cause is a bucket-name mismatch. If a photo fails to upload, the sighting
still saves without it — a bad photo shouldn't lose the whole report.

The canvas resize step also strips EXIF as a side effect, not just an
optimization — `canvas.toBlob()` re-encodes from the decoded pixel buffer
only, so metadata from the original file (GPS coordinates, camera
make/model, timestamp) never makes it into the uploaded copy. There's no
separate stripping step because there doesn't need to be one; verified by
round-tripping a JPEG with injected GPS EXIF through the actual
`compressImage()` function and confirming the output has none. This
matters specifically because a reporter's photo could otherwise leak where
*they* were standing (e.g. their home) via GPS EXIF, which has nothing to
do with the sighting's own location field.

`processAndUploadPhoto()`'s type/size checks (`file.type.startsWith("image/")`,
`PHOTO_MAX_SOURCE_BYTES`) are client-side only, since uploads go straight
from the browser to Storage using the public anon key — there's no server
of ours in the path to add a second check to. A visitor could bypass the
JS entirely and `POST` an arbitrary file straight to the Storage REST
endpoint. The actual enforcement point for that is the bucket's own
settings, not app code — set a **file size limit** and **allowed MIME
types** on the `sighting-photos` bucket itself (Supabase dashboard →
Storage → bucket → Edit bucket → "Restrict file upload size" and "Allowed
MIME types", or equivalently `update storage.buckets set
file_size_limit = 8388608, allowed_mime_types = array['image/jpeg',
'image/png', 'image/webp'] where id = 'sighting-photos';` in the SQL
editor). This isn't configured yet — same manual-dashboard-step caveat as
the `source` column above.

### Reported issues (fake/duplicate flags)

A third table, `reports` (`id uuid`, `target_type text` —
`sighting`/`news`, `target_id text`, `reason text`, `created_at`), backs the
🚩 button on every sightings-list and news-list entry. Unlike `sightings`
and `sighting_votes`, its RLS policy grants the anon role `INSERT` only —
no `SELECT` at all, not even an aggregate — so flagged items form a private
moderation queue that only the project owner can read, via the Supabase
Table Editor (using dashboard auth, not the anon key). This is deliberate:
unlike vote counts, there's no legitimate front-end reason to expose how
many times an entry has been flagged or by what device, since that could
be used to gauge whether mass-flagging a real sighting is "working".

```sql
create table reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('sighting', 'news')),
  target_id text not null,
  reason text,
  created_at timestamptz not null default now()
);

alter table reports enable row level security;

create policy "Public can insert reports"
  on reports for insert
  to anon
  with check (true);
```

## News auto-collection

`.github/workflows/news-scan.yml` runs `scripts/fetch-news.js` on a schedule
(every 2 hours) and on manual dispatch. It:

1. Fetches the RSS feeds of the major Latvian news portals (LSM.lv,
   Apollo.lv, TVNET, Delfi.lv, LA.lv, Diena.lv, 1188.lv), two regional ones
   (gorod.lv — Russian-language, Daugavpils/Latgale; kodols.lv — Riga
   region) that between them caught sightings the national portals missed
   (Silene nature park, Garkalne), LATMA (the Latvian Hunters' Association's
   own site — hunters are a named data source behind the official
   population monitoring, and LATMA occasionally publishes bear-specific
   stories directly), plus three Estonian (ERR.ee,
   Postimees.ee, Õhtuleht.ee) and three Lithuanian (15min.lt, LRT.lt,
   Lrytas.lt) portals for border-area coverage — bears cross borders, and a
   sighting just over the line is still relevant context near Latvia.
   Delfi.lt has no combined "all news" RSS feed, so it's scanned via its
   "Lietuvoje" (general Lithuania/regional) category feed instead — the
   closest match to the other portals' general coverage, and the section
   most likely to carry a local animal story. Delfi.ee was investigated but
   doesn't appear to publish a public RSS feed at all anymore.
2. Keeps only items whose title/description contain a whole-word match for
   "bear"/"bear cub" in that specific feed's language — Latvian "lācis"/
   "lāči"/"lācēns", Estonian "karu", Lithuanian "lokys"/"lokiukas", Russian
   "медведь"/"медвежонок", all case forms. Word-boundary matching, not a
   substring, so it doesn't fire on unrelated words that happen to contain
   the same letters (e.g. Latvian "Lāčplēsis", the national epic hero, or
   place names like "Lāčusils"; Lithuanian "lokalus", meaning "local";
   Russian surname "Медведев"). Each feed is only tested against its own
   language's word list (`FEEDS[].lang` in the script) rather than all four
   at once — Latvian "karu" (accusative of "karš", "war", ubiquitous in
   Ukraine-war coverage) is spelled identically to Estonian "karu" (bear).
   Testing every feed against every language turned every Latvian war
   article into a false bear match the moment general-news LV portals were
   added; this was caught before it ever reached `public.news`.
3. Best-effort matches a town/region name mentioned in the text against a
   small built-in gazetteer (`GAZETTEER` in the script — all of Latvia, plus
   only the Estonian/Lithuanian towns within roughly 50-70km of the Latvian
   border) to place an approximate map pin — exact coordinates can't be
   extracted from article text, so this is a "nearest known town/region"
   pin, not the precise location.
4. Upserts the result into Supabase's `public.news` table as
   `status='pending'` (dedup by article link, via its id hash) — nothing
   commits to git for this part anymore, review happens in the Supabase
   dashboard, see "Manual review queue" below for why.

Official government sources (Dabas aizsardzības pārvalde, Valsts meža
dienests) were investigated but not wired in: neither publishes an RSS feed,
and both are unreachable (TLS connections time out) from the environment
this was built in, so their HTML structure couldn't be verified well enough
to write a scraper with any confidence it'd keep working. Confirmed real
sightings from the initial research were instead backfilled by hand once
each — directly into `public.news` (status set to `approved` right away,
since these were already individually confirmed) — using the same
id-hashing scheme the script uses so future runs dedupe against them
correctly.

When backfilling by hand, verify the specific claim (place name especially)
actually appears in the linked article body, not just that the link resolves
— a batch of candidate entries from an earlier pass at this included a real,
working source URL for a general "bears are spreading into the Kurzeme
region" piece, paired with an invented specific village name that doesn't
appear anywhere in that article. The link being real doesn't mean the
attached claim is.

A whole-word keyword match also can't tell "this article is about a bear
sighting" apart from "this article mentions a bear in passing" — a restaurant
review that opens with a scene-setting line about bears changing
mushroom-pickers' habits, a foreign-country story a LV/EE/LT portal happened
to run (an Estonian portal covering Romania's bear problem), or a
funding/procurement announcement that recaps an old, already-recorded
sighting for context all matched and got treated as new sightings — one even
placed a map pin on a town for a funding story that had nothing to do with a
new encounter there. There's no practical way to catch this class
automatically without real NLP, so `EXCLUDED_LINKS` in `fetch-news.js` is a
manually-maintained denylist of specific article links found to be false
positives this way — keyed by link (not id) so it's readable/auditable, and
checked before the keyword test so excluded articles never re-enter
`public.news` on a later run even while they're still in a feed's rolling
window.

Word-boundary matching avoids some proper-noun collisions for free — a
Russian article about someone surnamed "Медведев" doesn't match, since that
surname's case forms don't line up with the bare word "медведь"'s. Latvian
"Lācis" and Estonian "Karu" aren't so lucky: both are also common surnames
(and "Lāči" is also a real bread/bakery brand, laci.lv), spelled/declined
identically to the animal word, so no spelling-based rule alone can tell
them apart. Three real cases found this way: a sports article headlined
"Treneris Lācis: Fināls ..." (an athletics coach); an ERR.ee piece naming
"kolonel Fredi Karu" (nothing to do with a bear); and an LSM.lv article
about a hockey coach's arrest that only matched because it named his club,
"Ogres novada Lāči" ("Ogre district Bears") — none of these were sightings.
`fetch-news.js`'s `looksLikeProperNounCollision()` catches the general
shape behind the first two (and would have caught the third too, since
"Lāči" was capitalized there): Latvian/Estonian never capitalize an
ordinary common noun mid-sentence, only at the very start of a
sentence/headline, so *any* word directly before a capitalized bear-word
form (a first name/title — "Jānis Lācis", "Fredi Karu" — or an
organization name — "novada Lāči") means it's a proper noun, not the
animal. A lowercase match mid-sentence is always the animal, and a
capitalized match with *nothing* before it (true sentence/headline start,
e.g. "Lācis iznācis pie ...") is left alone — that's what keeps this from
swallowing genuine headlines. `looksLikeBreadBrand()` is a narrower,
separate check for the one case that pattern can't reach: the bread brand
leading its own sentence as subject ("Lāči prezentē ...", nothing
preceding it at all) — checked via simple co-occurrence with "maiz-" rather
than capitalization, since a genuine bear article essentially never
discusses bread.

A hard "must also contain word X" requirement (e.g. "mež-"/"novēro-"/
"pēdas"/etc. somewhere nearby) was considered and tested against the 19
already-verified-genuine items live at the time — it would have wrongly
rejected 17 of them (attack/sighting headlines like "Lācis uzbrucis
sēņotājam Tukuma novadā" don't happen to contain any of those specific
stems). Not implemented for that reason: a false negative here is
*silent* — with the manual-review queue below, a false positive just sits
as `pending` for a human to reject, but an item a keyword filter drops
before that never gets a chance to be seen at all.

### Manual review queue

No keyword filter catches every false positive — three different classes
of one shipped live before being caught and fixed (surname collisions in
two languages, an organization-name collision), and the cost of one going
public isn't always just cosmetic (one of the three was an article about a
child-abuse arrest, which briefly showed up captioned as a bear-sighting
news item). So nothing reaches the live site automatically: `fetch-news.js`
upserts every match into Supabase's `public.news` table as
`status='pending'`, and `js/news.js` only ever reads rows where
`status='approved'` (see `docs/rls-audit.md`'s R7 for the exact table/RLS
shape — same "public reads, only the table owner's own dashboard session
approves" pattern `sightings` already uses). A human reviews new pending
rows in the Supabase Table Editor and flips `status` to `approved` to
publish or `rejected` to reject — no PR, no commit. `news-scan.yml` emails
a reminder (via Resend) whenever a run finds genuinely new candidates, so
checking Supabase isn't something that has to happen on a timer. Rejecting
a specific article *permanently* (so it stops reappearing as a fresh
`pending` row every time it's still in a feed's rolling window) still goes
through `EXCLUDED_LINKS` in `fetch-news.js`, same as before.

### Manual verification (separate from the review queue)

Approving a row above only confirms "this is genuinely a bear story, not a
false positive" — it doesn't confirm the auto-matched place name and date
actually appear in the article text rather than being a plausible-looking
coincidence (see the "verify the specific claim" note above, the same bar
already used for hand-backfilled historical entries). `public.news` has its
own `verified` boolean column for this stronger, separate check — the scan
script never writes to it (see R7's column-scoped grants), so it only ever
changes when a human opens the article, confirms the specific claim, and
flips it in the Table Editor. Verified items get a green ring on their map
marker (vs. the plain indigo diamond every other news mention gets), a "✓
Pārbaudīts" badge in the news list, and a count on stats.html's "Ziņu
pieminējumi" box. Empty (`false`) by default — nothing is verified until a
human actually does the work.

Verified items also appear in the "Novērojumu saraksts" (sightings list)
itself, not just the separate news list —
`verifiedNewsAsListEntries()`/`getFilteredListEntries()` in
`js/sightings-panel.js` reshape them to fit the same row rendering as a
real sighting, badged and linking out to the source article instead of
showing a vote row. Deliberately kept out of `getFilteredSightings()`
itself, which also feeds the map's sightings marker layer — a verified
item already has its own marker on the news layer, so blending it into
sightings there too would double-render the same item as two pins. The
"Kopienas novērojumi" *count* on the stats card stays community-
submissions-only regardless (see `renderStatsAndChart()`'s own comment on
why blending news into that number was misleading in the first place) —
only the browsable list blends in reliable non-community data, not the
headline number, which would repeat the exact problem being avoided there.

### Event country (Latvia / border / world)

`GAZETTEER` only contains Latvian and EE/LT border-town names, so it can
never place a pin *inside* e.g. Sweden — but it could still latch onto a
short stem (like "krievij"/"soom") that coincidentally appears in an article
that isn't about the Baltics at all, since a source portal's language says
nothing about where the story is set (see the "an Estonian portal covering
Romania's bear problem" example above — the exact same shape of story
applies to Sweden, Norway, Finland, Russia, Belarus, Poland, Germany,
Romania, and Slovakia, the countries `FOREIGN_COUNTRIES` in `fetch-news.js`
currently knows to name explicitly). `classifyLocation()` checks
`FOREIGN_COUNTRIES` first, per the article's own source language — if any of
those countries is named, that wins over any gazetteer stem match: no
`placeName`/`lat`/`lng` gets attached at all, however coincidental the stem
match would have been. Every matched item gets an `eventCountry` field this
way: `"LV"` (default), `"EE"`/`"LT"` (derived from which `GAZETTEER` entry
matched — those entries' names already end in "(Igaunija)"/"(Lietuva)"), or
a specific country code (`"SE"`, `"NO"`, ...) for anything else.

The front end treats `"LV"`/`"EE"`/`"LT"` as "local": shown on the map same
as before, with EE/LT getting a distinct marker color
(`.news-marker-diamond.border` in `style.css`) and the matched place name
(already including its "(Igaunija)"/"(Lietuva)" suffix) surfaced as a popup
line — bears don't know borders, so a sighting just across one is still
worth showing, just visibly marked as not-Latvia. Anything else never gets a
pin (`lat`/`lng` are always null for a `FOREIGN_COUNTRIES` match) and only
shows up in the news card's "Pasaulē" tab (`newsScope`/`getScopedNewsList()`
in `js/news.js`), separate from the default "Tuvumā" (local) tab — so a
foreign story is still browsable (with its country named, e.g. "🌍
Zviedrija") without ever implying it happened near Latvia.

This is still a best-effort keyword classifier, not a resolved "where did
this happen" — the same class of limitation `EXCLUDED_LINKS`/proper-noun
collision handling above already lives with. A story that merely *compares*
to a named country in passing (rather than being set there) would be
misclassified as foreign; extend `FOREIGN_COUNTRIES` the same incremental
way as everything else in this file when a new case turns up.

The front end (`js/news.js`) reads `public.news` (via the same public anon
key `js/storage.js` already uses, filtered to `status=eq.approved`) on load
and re-polls it every 10 minutes while the tab is open, so new mentions
appear on the map and in the "News mentions" list without a page reload.
Only the headline, source, date, and a link back to the original article
are shown — never the full article text — since copyright stays with the
original publisher.

An earlier version also showed a small preview thumbnail, pulled from
whatever `<enclosure>`/`<media:thumbnail>`/first-`<img>` a feed happened to
provide and hotlinked directly (the visitor's browser fetched it straight
from the publisher's server, not ours). Removed: that's real bandwidth cost
landing on the original publisher with no benefit to them, a broken-image
risk the moment they reorganize their media, and a rights question sitting
right next to the "never show the full article text" line above — caching a
copy on our own server instead would only trade the hotlinking problem for
a stronger one (re-publishing their photo file rather than linking to it).
Text-only is the version worth keeping.

To test the scanner locally: `node scripts/fetch-news.js` (writes/updates
`public.news` in Supabase directly — same public anon key as everything
else in this project, no separate API keys/dependencies required, Node
18+).

Each run also writes `feed.xml` — a standard RSS 2.0 feed of the currently
`approved` items (LV titles only; the feed itself has no per-visitor language
selection), linked from `index.html`'s `<head>` via `<link rel="alternate"
type="application/rss+xml">` and from the news list directly. This is the
"email digest" option from the audit checklist without building actual
email infrastructure: any RSS-to-email service (e.g. Blogtrottr) can turn
`https://lacupedas.lv/feed.xml` into an email subscription on the
visitor's own account, no backend of ours required.

## Project structure

```text
index.html                     Home feed (mobile) / embedded map + sidebar (desktop)
map.html                       Standalone full-bleed map page — clustering, filters, legend, report flow
stats.html                     Standalone stats page — totals, chart, sightings list, research/region cards
padomi.html                     Content hub — links to all pages below
guide.html                       "What to do if you meet a bear" content page
tracks.html                       "How to identify bear tracks/signs" content page
biology.html                       "Bear biology and status in Latvia" content page
advice.html                         "Advice by audience" content page (foragers, beekeepers, drivers)
stories.html                         "Sighting stories" — narrative write-ups of real cases
about.html                           "About this project" — who/why/how verification works/sources
privacy.html                         GDPR privacy policy
css/style.css                   Shared styling (design tokens, layout, light + dark mode)
css/guide.css                    Content-page styling (normal scroll, do/don't cards, hub grid)
css/map-page.css                 map.html-specific styling (full-bleed, recency panel)
css/stats-page.css               stats.html-specific styling (research/region cards)
js/i18n.js                       LV/EN/RU translation strings + language switching
js/storage.js                    Supabase-backed shared storage for community reports + votes + issue reports
js/report-issue.js               "Report an issue" modal shared by the sightings and news lists
js/report-form.js                Sighting-report modal + click-to-pick flow, shared by index.html/map.html
js/photo.js                       Client-side photo compression + EXIF-stripping Storage upload
js/map.js                        Leaflet map, marker clustering, click-to-report
js/chart.js                       Monthly chart (inline SVG) — combined data
js/news.js                         News-mentions layer: fetch, poll, render, filter, clustering
js/sightings-panel.js            Sightings list/stats/chart rendering, shared by index.html/stats.html
js/app.js                           Wires index.html together; desktop map vs. mobile home-feed split
js/map-page.js                   Wires map.html together (standalone)
js/stats-page.js                 Wires stats.html together (standalone)
js/guide-page.js                     Language switching for the standalone content pages
scripts/fetch-news.js         RSS scanner run by the GitHub Action (below); upserts to Supabase, also writes feed.xml
.github/workflows/news-scan.yml   Scheduled job that runs the scanner
feed.xml                       RSS 2.0 feed of the currently-approved public.news rows
favicon.ico                    Hand-built multi-frame (16/32px) icon — see note below
icons/                          Paw-print favicon/app icon set (PNG, 16px–512px) + apple-touch-icon + og-banner.png
site.webmanifest               PWA manifest (name, theme color, 192/512px icons)
```

`favicon.ico` embeds PNG frames directly rather than legacy BMP data — supported
by every current browser and by Windows since Vista, but not decodable via a
plain `<img src="...ico">` (Chromium's `<img>` element doesn't have an ICO
decoder; it only reads the format through the favicon-specific code path
`<link rel="icon">` uses). Verified with Python/Pillow rather than a browser
screenshot for that reason.

## Content pages

`padomi.html` is a hub linking to a set of static, SEO-indexable content
pages: `guide.html` (what to do if you meet a bear), `tracks.html` (how to
identify bear tracks/signs), `biology.html` (population, seasonality,
legal status), `advice.html` (audience-specific tips for foragers,
beekeepers/farmers, and drivers), and `stories.html` (short narrative
write-ups of real, sourced sightings — the same underlying cases the news
scanner already found, just told as short stories instead of a headline
list). Each page reuses `js/i18n.js` for LV/EN/RU but not the map/storage/
news modules — a standalone `js/guide-page.js` just wires up the language
switch. Navigation is map → hub → topic page, each with a "back one level"
link.

Content is grounded in the Nature Conservation Agency's (DAP) publicly
reported recommendations and the LVMI Silava "Bear Monitoring 2023–2025"
research project (silava.lv), not just generic bear-safety advice — worth
re-checking against DAP's current guidance if these pages are revised
later, since agency recommendations and figures (e.g. track measurements)
can be updated. Note that some source pages here render their body text
client-side, so `curl`/WebFetch may only retrieve metadata (title,
description) and not the full article — cross-check figures against a
second independent source when that happens, same as was done for the
paw-print measurements in `tracks.html`.

## Planned: multi-language indexing (not built)

Every page today serves one HTML document (`lang="lv"` in the source) and
translates it client-side via `js/i18n.js`'s `applyTranslations()` after
load. That means Google mostly only indexes the Latvian text that's
actually present in the served HTML — the RU/EN versions exist for human
visitors who switch the `<select>`, but there's no distinct crawlable URL
or `hreflang` signal telling search engines those versions exist at all.
Fixing this properly needs a build step, which this repo doesn't have
today (every page is hand-authored static HTML, deployed to GitHub Pages
as-is). Sketch of how it would work, without committing to it yet:

1. **New `scripts/build-i18n-pages.js`** (Node, no dependencies, same style
   as `scripts/fetch-news.js`): for each source page and each of `lv`/`en`/
   `ru`, parse the HTML, walk `[data-i18n]`/`[data-i18n-placeholder]`
   elements the same way `applyTranslations()` does client-side, and write
   out a fully pre-translated static copy — reusing `js/i18n.js`'s
   `translations` object as the single source of truth so there's still
   only one place to edit copy, not three.
2. **Output layout**: keep the existing LV pages at their current root
   paths (`/`, `/map.html`, ...) so no existing link/backlink/bookmark
   breaks, and emit the other two languages into sibling directories
   (`/en/`, `/en/map.html`, `/ru/map.html`, ...) — a directory-per-language
   split is the simplest scheme for a host with no server-side routing
   (GitHub Pages just serves files). Avoid a `?lang=` query param scheme —
   Google explicitly discourages that for hreflang.
3. Each generated page gets its own translated `<title>`/`<meta
   description>`/OG tags (new per-language i18n keys would be needed for
   these, since only the LV values are hardcoded in `<head>` today) plus
   `<link rel="alternate" hreflang="lv|en|ru" href="...">` pairs across all
   three versions, and an `hreflang="x-default"` pointing at the LV root.
4. Wire the build script into the GitHub Pages deploy workflow so `/en/`
   and `/ru/` are generated fresh on every deploy — build output, not
   something committed to git.
5. `sitemap.xml` gains entries for the new URLs.

What this does **not** fix: the live, Supabase-backed content (map
markers, sightings list, news list) is still rendered by JS after page
load either way, in every language — that's fine, since it's not the
content actually targeted for ranking; the static informational text
(FAQ, guide pages, titles) is. The client-side `<select>` language
switcher keeps working exactly as now on top of whichever pre-rendered
version a visitor lands on.

Per-sighting indexable pages (e.g. `/noverojums/{id}`) and a `/zinot`
vanity URL in place of `map.html?report=1` would need the same kind of
per-route static generation and are blocked on the same build-step
decision — not scoped further until that's decided.

## Note

This is a community/hobby project, not an official government tool. For
official large-carnivore reporting in Latvia, contact the Nature Conservation
Agency (Dabas aizsardzības pārvalde).
