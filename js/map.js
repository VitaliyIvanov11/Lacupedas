// Leaflet map setup: bounded to Latvia, click-to-report, colored markers by
// observation type (categorical palette, fixed slot order).
const LATVIA_CENTER = [56.85, 24.7];
const LATVIA_BOUNDS = [
  [55.5, 20.5],
  [58.3, 28.5],
];

const TYPE_COLORS = {
  sighting: "#2a78d6", // categorical slot 1 (blue)
  tracks: "#eb6834", // categorical slot 2 (orange)
  damage: "#e34948", // categorical slot 8 (red)
  dna_sample: "#1baf7a", // categorical slot 3 (aqua)
  dead: "#eda100", // categorical slot 4 (yellow)
};

// News-mention markers use a fixed diamond/indigo style (see .news-marker-diamond
// in style.css and the matching type-dot color in news.js) since scraped news
// items aren't classified into a sighting/tracks/damage/etc. type.
const NEWS_MARKER_COLOR = "#4a3aa7";

// eventCountry EE/LT ("border area" — see classifyLocation() in
// scripts/fetch-news.js) gets its own color instead of the default indigo:
// still worth showing (bears don't know borders), but visually not a
// Latvia-side item. Distinct from every TYPE_COLORS/NEWS_MARKER_COLOR hue.
const NEWS_BORDER_COLOR = "#5f7a8f";

const LEGEND_ROWS = [
  { color: TYPE_COLORS.sighting, shape: "dot", key: "typeSighting" },
  { color: TYPE_COLORS.tracks, shape: "dot", key: "typeTracks" },
  { color: TYPE_COLORS.damage, shape: "dot", key: "typeDamage" },
  { color: TYPE_COLORS.dna_sample, shape: "dot", key: "typeDnaSample" },
  { color: TYPE_COLORS.dead, shape: "dot", key: "typeDead" },
  { color: NEWS_MARKER_COLOR, shape: "diamond", key: "legendNews" },
  { color: NEWS_BORDER_COLOR, shape: "diamond", key: "legendNewsBorder" },
  // Same diamond/color as legendNews — the green ring is the only
  // difference (see .news-marker-diamond.verified in style.css), so it
  // gets its own swatch class instead of a different color.
  { color: NEWS_MARKER_COLOR, shape: "diamond", extraClass: "legend-verified", key: "legendNewsVerified" },
];

function buildLegend() {
  const toggle = document.getElementById("map-legend-toggle");
  const panel = document.getElementById("map-legend-panel");
  if (!toggle || !panel) return;

  LEGEND_ROWS.forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "legend-row";

    const swatch = document.createElement("span");
    swatch.className =
      "legend-swatch " + (row.shape === "diamond" ? "legend-diamond" : "legend-dot") + (row.extraClass ? " " + row.extraClass : "");
    swatch.style.background = row.color;
    rowEl.appendChild(swatch);

    const label = document.createElement("span");
    label.setAttribute("data-i18n", row.key);
    label.textContent = t(row.key);
    rowEl.appendChild(label);

    panel.appendChild(rowEl);
  });

  toggle.addEventListener("click", () => {
    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    toggle.setAttribute("aria-expanded", String(willOpen));
  });
}

// "Where am I" map orientation only — flies/zooms the view to the visitor's
// current position with a marker, nothing more. Deliberately NOT wired into
// the report flow: a sighting is reported after the fact, so "where the
// phone is right now" isn't "where the bear was" — placing the pin still
// always requires an explicit map click (see js/report-form.js).
function buildLocateControl(mapInstance) {
  let locateMarker = null;
  let locating = false;

  const LocateControl = L.Control.extend({
    options: { position: "topleft" },
    onAdd: function () {
      const container = L.DomUtil.create("div", "leaflet-bar leaflet-control locate-control");
      const button = L.DomUtil.create("a", "locate-control-btn", container);
      button.href = "#";
      button.setAttribute("role", "button");
      const label = t("locateMeBtn");
      button.title = label;
      button.setAttribute("aria-label", label);
      button.innerHTML = "📍";

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(button, "click", (e) => {
        L.DomEvent.preventDefault(e);
        if (locating || !navigator.geolocation) return;
        locating = true;
        button.classList.add("locating");
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            locating = false;
            button.classList.remove("locating");
            const { latitude, longitude } = pos.coords;
            if (locateMarker) mapInstance.removeLayer(locateMarker);
            locateMarker = L.circleMarker([latitude, longitude], {
              radius: 8,
              color: "#fff",
              weight: 2,
              fillColor: "#2a78d6",
              fillOpacity: 1,
            }).addTo(mapInstance);
            mapInstance.flyTo([latitude, longitude], Math.max(mapInstance.getZoom(), 13), { duration: 0.6 });
          },
          () => {
            // Denied/unavailable/timed out — the browser's own permission
            // UI already told the visitor why; nothing more to add here.
            locating = false;
            button.classList.remove("locating");
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });

      return container;
    },
  });

  new LocateControl().addTo(mapInstance);
}

let map;
let markersLayer;
let pickingMode = false;
let onMapPick = null;

// Shared mobile breakpoint check, used by app.js to gate the desktop-only
// embedded map/report-form init on the mobile-restructured home page.
const MOBILE_QUERY = window.matchMedia("(max-width: 900px)");

function pawIcon(type) {
  const color = TYPE_COLORS[type] || TYPE_COLORS.sighting;
  return L.divIcon({
    className: "bear-marker",
    html: `<span class="bear-marker-dot" style="background:${color}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -9],
  });
}

function initMap() {
  map = L.map("map", {
    center: LATVIA_CENTER,
    zoom: 7,
    minZoom: 6,
    maxZoom: 17,
    maxBounds: [
      [54.5, 18.5],
      [59.5, 30.5],
    ],
    maxBoundsViscosity: 0.6,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);

  map.fitBounds(LATVIA_BOUNDS);

  markersLayer = L.markerClusterGroup({
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
  }).addTo(map);

  buildLegend();
  buildLocateControl(map);

  // A raw DOM listener, not map.on("click", ...): Leaflet marker/cluster
  // clicks don't call stopPropagation(), so this also fires when clicking a
  // marker while in picking mode (pre-existing edge case, not addressed
  // here).
  map.getContainer().addEventListener("click", (domEvent) => {
    if (pickingMode && onMapPick) {
      const rect = map.getContainer().getBoundingClientRect();
      const point = L.point(domEvent.clientX - rect.left, domEvent.clientY - rect.top);
      const latlng = map.containerPointToLatLng(point);
      onMapPick(latlng.lat, latlng.lng);
    }
  });

  return map;
}

function setPickingMode(active, callback) {
  pickingMode = active;
  onMapPick = callback || null;
  const mapEl = document.getElementById("map");
  mapEl.classList.toggle("picking", active);
}

function mapEscapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function mapTypeLabel(type) {
  if (type === "tracks") return t("typeTracks");
  if (type === "damage") return t("typeDamage");
  if (type === "dead") return t("typeDead");
  if (type === "dna_sample") return t("typeDnaSample");
  return t("typeSighting");
}

function sightingPopupHtml(s) {
  const photo = s.photoUrl
    ? `<img src="${mapEscapeHtml(s.photoUrl)}" alt="" class="popup-photo" />`
    : "";
  const desc = s.description
    ? `<div class="popup-meta">${mapEscapeHtml(s.description)}</div>`
    : "";
  return (
    photo +
    `<strong>${mapEscapeHtml(mapTypeLabel(s.type))}</strong> · ${mapEscapeHtml(s.date)}` +
    desc
  );
}

function renderMarkers(sightings, onMarkerClick) {
  // No-op on the mobile home feed, where initMap() is skipped and there's
  // no #map to render into (see the isMobile gating in app.js's init()).
  if (!markersLayer) return;
  markersLayer.clearLayers();
  sightings.forEach((s) => {
    const marker = L.marker([s.lat, s.lng], { icon: pawIcon(s.type) });
    marker.bindPopup(sightingPopupHtml(s));
    marker.on("mouseover", () => marker.openPopup());
    marker.on("mouseout", () => marker.closePopup());
    marker.on("click", () => onMarkerClick && onMarkerClick(s));
    marker.addTo(markersLayer);
  });
}

function flyToSighting(s) {
  // No-op on the mobile home feed, where there's no embedded map to fly.
  if (!map) return;
  map.flyTo([s.lat, s.lng], Math.max(map.getZoom(), 11), { duration: 0.6 });
}
