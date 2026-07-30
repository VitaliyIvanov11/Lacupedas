# Lacupedas — Lāču Novērojumi Latvijā / Bear Sightings in Latvia

A small, bilingual (Latvian / English) static web app for tracking bear
sightings, tracks/signs, and livestock/beehive damage across Latvia on an
interactive map.

- Pure static site: HTML/CSS/vanilla JS, no build step, no backend.
- Map powered by [Leaflet](https://leafletjs.com/) + OpenStreetMap tiles (loaded from CDN).
- Data is stored **only in the visitor's own browser** (`localStorage`) — nothing
  is sent to a server. Use **Export (JSON)** to back up or share a dataset, and
  **Import** to load one back in.
- Ships with 3 clearly-labeled example entries so the map isn't empty on first
  load; delete them or `Clear all data` to start fresh.

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

## Deploy to GitHub Pages (lacupedas.lv)

1. Push this repository to GitHub.
2. In the repo, go to **Settings → Pages**, set **Source** to the `main`
   branch, root folder (`/`).
3. The `CNAME` file in this repo already contains `lacupedas.lv`, so GitHub
   Pages will serve the site on that custom domain once DNS is set up (step 4).
4. At your DNS provider, point the **apex domain** `lacupedas.lv` at GitHub
   Pages. Since apex domains can't use a plain `CNAME` record, use one of:
   - Four `A` records for `lacupedas.lv` pointing to GitHub Pages' IPs:
     `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
     (and matching `AAAA` records if you want IPv6), **or**
   - An `ALIAS`/`ANAME` record at the apex pointing to `<your-github-username>.github.io`,
     if your DNS provider supports it.
   - If you also want `www.lacupedas.lv` to work, add a `CNAME` record for
     `www` pointing to `<your-github-username>.github.io`.
5. Back in **Settings → Pages**, once DNS resolves, tick **Enforce HTTPS**.

DNS propagation can take anywhere from a few minutes to ~24 hours.

## Project structure

```
index.html          Page markup
css/style.css        Styling (light + dark mode via prefers-color-scheme)
js/i18n.js            LV/EN translation strings + language switching
js/storage.js         localStorage persistence for sightings
js/map.js             Leaflet map, markers, click-to-report
js/chart.js            Monthly sightings bar chart (inline SVG)
js/app.js               Wires everything together
CNAME                 Custom domain for GitHub Pages (lacupedas.lv)
```

## Note

This is a community/hobby project, not an official government tool. For
official large-carnivore reporting in Latvia, contact the Nature Conservation
Agency (Dabas aizsardzības pārvalde).
