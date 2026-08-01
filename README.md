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
  dynamically from whatever sources are actually present in `data/news.json`
  rather than a hardcoded list. Filters are purely client-side (re-filter
  already-loaded data, no re-fetch) and don't affect the stats panel/chart,
  which stay totals-over-everything.
- A "🔥 density map" toggle in the map toolbar overlays a
  [Leaflet.heat](https://github.com/Leaflet/Leaflet.heat) heatmap built from
  every community sighting + news mention's coordinates (weighted by bear
  count for sightings). It's additive over the pins, not a replacement, and
  always reflects the full dataset regardless of the list filters — it
  answers "where overall," not "where in my current filter view."
- Basic SEO: keyword-targeted title/description, Open Graph tags, a
  `WebSite` JSON-LD block, `robots.txt`/`sitemap.xml`, and a collapsed-by-
  default FAQ (`<details>`, real static text, capped-height + internally
  scrollable so it can't blow out the no-scroll desktop layout) answering
  the exact queries this is meant to rank for ("kur dzīvo lācis", "lāča
  pēdas"). Submitting the site to Google Search Console itself is a manual,
  account-owner-only step — not something committed here.

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
  tool — if spam becomes a real problem, options include adding a CAPTCHA
  challenge before insert, or a Supabase Edge Function that validates
  submissions server-side instead of inserting directly from the client.

Table schema (`sightings`): `id uuid`, `lat float8`, `lng float8`,
`date date`, `type text` (`sighting`/`tracks`/`damage`/`dead`/`dna_sample`),
`count int`, `description text`, `reporter text`, `photo_url text`,
`created_at timestamptz`. The `type` values are enforced by a `CHECK`
constraint (`sightings_type_check`) — adding a new type means an `ALTER
TABLE ... DROP/ADD CONSTRAINT` in Supabase, not just a front-end change.

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

## News auto-collection

`.github/workflows/news-scan.yml` runs `scripts/fetch-news.js` on a schedule
(every 2 hours) and on manual dispatch. It:

1. Fetches the RSS feeds of the major Latvian news portals (LSM.lv,
   Apollo.lv, TVNET, Delfi.lv, LA.lv, Diena.lv, 1188.lv), two regional ones
   (gorod.lv — Russian-language, Daugavpils/Latgale; kodols.lv — Riga
   region) that between them caught sightings the national portals missed
   (Silene nature park, Garkalne), plus one Estonian (ERR.ee) and one
   Lithuanian (15min.lt) portal for border-area coverage — bears cross
   borders, and a sighting just over the line is still relevant context
   near Latvia.
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
   added; this was caught before it ever reached `data/news.json`.
3. Best-effort matches a town/region name mentioned in the text against a
   small built-in gazetteer (`GAZETTEER` in the script — all of Latvia, plus
   only the Estonian/Lithuanian towns within roughly 50-70km of the Latvian
   border) to place an approximate map pin — exact coordinates can't be
   extracted from article text, so this is a "nearest known town/region"
   pin, not the precise location.
4. Merges the result into `data/news.json` (dedup by article link, 2-year
   window, capped at 150 items) and commits it if it changed.

Official government sources (Dabas aizsardzības pārvalde, Valsts meža
dienests) were investigated but not wired in: neither publishes an RSS feed,
and both are unreachable (TLS connections time out) from the environment
this was built in, so their HTML structure couldn't be verified well enough
to write a scraper with any confidence it'd keep working. Confirmed real
sightings from the initial research were instead backfilled by hand into
`data/news.json` once each, using the same id-hashing scheme the script
uses so future runs dedupe against them correctly.

When backfilling by hand, verify the specific claim (place name especially)
actually appears in the linked article body, not just that the link resolves
— a batch of candidate entries from an earlier pass at this included a real,
working source URL for a general "bears are spreading into the Kurzeme
region" piece, paired with an invented specific village name that doesn't
appear anywhere in that article. The link being real doesn't mean the
attached claim is.

The front end (`js/news.js`) fetches `data/news.json` on load and re-polls it
every 10 minutes while the tab is open, so new mentions appear on the map and
in the "News mentions" list without a page reload. Only the headline, source,
date, and a link back to the original article are shown — never the full
article text — since copyright stays with the original publisher.

To test the scanner locally: `node scripts/fetch-news.js` (writes/updates
`data/news.json`; no API keys or dependencies required, Node 18+).

## Project structure

```text
index.html                     Map page markup
padomi.html                     Content hub — links to all pages below
guide.html                       "What to do if you meet a bear" content page
tracks.html                       "How to identify bear tracks/signs" content page
biology.html                       "Bear biology and status in Latvia" content page
advice.html                         "Advice by audience" content page (foragers, beekeepers, drivers)
stories.html                         "Sighting stories" — narrative write-ups of real cases
css/style.css                   Styling (single-viewport layout, light + dark mode)
css/guide.css                    Content-page styling (normal scroll, do/don't cards, hub grid)
js/i18n.js                       LV/EN/RU translation strings + language switching
js/storage.js                    Supabase-backed shared storage for community reports + votes
js/photo.js                       Client-side photo compression + Storage upload
js/map.js                        Leaflet map, markers, click-to-report, heatmap, mobile sleep/wake
js/chart.js                       Monthly chart (inline SVG) — combined data
js/news.js                         News-mentions layer: fetch, poll, render, filter
js/app.js                           Wires everything together; combined stats, filters, voting
js/guide-page.js                     Language switching for the standalone guide page
scripts/fetch-news.js         RSS scanner run by the GitHub Action (below)
.github/workflows/news-scan.yml   Scheduled job that runs the scanner
data/news.json                 Output of the scanner, served to the front end
favicon.ico                    Hand-built multi-frame (16/32px) icon — see note below
icons/                          Paw-print favicon/app icon set (PNG, 16px–512px) + apple-touch-icon
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

## Note

This is a community/hobby project, not an official government tool. For
official large-carnivore reporting in Latvia, contact the Nature Conservation
Agency (Dabas aizsardzības pārvalde).
