# Lacupedas — Lāču Novērojumi Latvijā / Bear Sightings in Latvia

A small, bilingual (Latvian / English) static web app for tracking bear
sightings, tracks/signs, and livestock/beehive damage across Latvia on an
interactive map.

- Pure static site: HTML/CSS/vanilla JS, no build step, no backend.
- Map powered by [Leaflet](https://leafletjs.com/) + OpenStreetMap tiles (loaded from CDN).
- Data is stored **only in the visitor's own browser** (`localStorage`) — nothing
  is sent to a server. Use **Export (JSON)** to back up or share a dataset, and
  **Import** to load one back in.
- The map starts empty for every new visitor (no seeded demo data) — real
  entries only, straight from `localStorage`.
- A scheduled GitHub Action also collects bear-related mentions from public
  Latvian news RSS feeds and shows them on the map as a separate "News
  mentions" layer — see [News auto-collection](#news-auto-collection) below.

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

## News auto-collection

`.github/workflows/news-scan.yml` runs `scripts/fetch-news.js` on a schedule
(every 2 hours) and on manual dispatch. It:

1. Fetches the RSS feeds of a few major Latvian news portals (LSM.lv,
   Apollo.lv, TVNET).
2. Keeps only items whose title/description contain a whole-word match for
   "lācis"/"lāči"/"lācēns" (bear/bear cub, all case forms) — word-boundary
   matching, not a substring, so it doesn't fire on unrelated words that
   happen to contain the same letters (e.g. "Lāčplēsis", Latvia's national
   epic hero, or place names like "Lāčusils").
3. Best-effort matches a Latvian town/region name mentioned in the text
   against a small built-in gazetteer (`GAZETTEER` in the script) to place an
   approximate map pin — exact coordinates can't be extracted from article
   text, so this is a "nearest known town/region" pin, not the precise
   location.
4. Merges the result into `data/news.json` (dedup by article link, 60-day
   window, capped at 150 items) and commits it if it changed.

The front end (`js/news.js`) fetches `data/news.json` on load and re-polls it
every 10 minutes while the tab is open, so new mentions appear on the map and
in the "News mentions" list without a page reload. Only the headline, source,
date, and a link back to the original article are shown — never the full
article text — since copyright stays with the original publisher.

To test the scanner locally: `node scripts/fetch-news.js` (writes/updates
`data/news.json`; no API keys or dependencies required, Node 18+).

## Project structure

```text
index.html                     Page markup
css/style.css                   Styling (light + dark mode via prefers-color-scheme)
js/i18n.js                       LV/EN translation strings + language switching
js/storage.js                    localStorage persistence for sightings
js/map.js                        Leaflet map, markers, click-to-report
js/chart.js                       Monthly sightings bar chart (inline SVG)
js/news.js                         News-mentions layer: fetch, poll, render
js/app.js                           Wires everything together
scripts/fetch-news.js         RSS scanner run by the GitHub Action (below)
.github/workflows/news-scan.yml   Scheduled job that runs the scanner
data/news.json                 Output of the scanner, served to the front end
```

## Note

This is a community/hobby project, not an official government tool. For
official large-carnivore reporting in Latvia, contact the Nature Conservation
Agency (Dabas aizsardzības pārvalde).
