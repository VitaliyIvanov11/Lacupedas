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

let map;
let markersLayer;
let heatLayer = null;
let pickingMode = false;
let onMapPick = null;

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

  markersLayer = L.layerGroup().addTo(map);

  map.on("click", (e) => {
    if (pickingMode && onMapPick) {
      onMapPick(e.latlng.lat, e.latlng.lng);
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
  map.flyTo([s.lat, s.lng], Math.max(map.getZoom(), 11), { duration: 0.6 });
}

// Density overlay across all confirmed sightings + news mentions (not
// affected by the sidebar list filters — this is meant to read as the
// overall picture, not "current filter view").
function setHeatmap(active, points) {
  if (heatLayer) {
    map.removeLayer(heatLayer);
    heatLayer = null;
  }
  if (active && points.length > 0) {
    heatLayer = L.heatLayer(
      points.map((p) => [p.lat, p.lng, p.weight || 1]),
      { radius: 26, blur: 20, maxZoom: 13, minOpacity: 0.35 }
    );
    heatLayer.addTo(map);
  }
}
