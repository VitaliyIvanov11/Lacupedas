// Opt-in, in-tab-only alert: while enabled, shows a toast when a sighting
// that wasn't there before appears within the chosen radius of the
// visitor's browser-reported location. One-shot geolocation read via
// getCurrentPosition(), not continuous watchPosition() — a visitor
// browsing this site isn't relocating mid-session, so there's no reason
// to pay the extra permission surface/battery cost of live tracking.
// Nothing is sent anywhere: the coordinate never leaves the browser: it's
// only ever compared client-side against sightings this page is already
// polling for the map/list (see SIGHTINGS_POLL_MS in js/app.js). Only
// works while this tab is open — real push notifications (working when
// the tab/phone is closed) would need a service worker + a push
// subscription stored server-side, a much bigger feature.

let nearbyEnabled = false;
let nearbyCoords = null;
let nearbySeenIds = null; // null until the next checkNearby() call captures a baseline
let nearbyRadiusKm = 25;

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function showNearbyToast(distanceKm) {
  const toast = document.getElementById("nearby-toast");
  if (!toast) return;
  toast.textContent = t("nearbyAlertToast").replace("{km}", distanceKm.toFixed(1));
  toast.hidden = false;
  clearTimeout(showNearbyToast._timer);
  showNearbyToast._timer = setTimeout(() => {
    toast.hidden = true;
  }, 10000);
}

// Called with the freshly-polled sightings list every refresh cycle (see
// refreshAll() in js/app.js). The first call after enabling only records
// which ids already exist — nothing "new" yet, so turning this on never
// alerts for sightings that were already on the map before you opted in.
function checkNearby(sightings) {
  if (!nearbyEnabled || !nearbyCoords || !Array.isArray(sightings)) return;
  if (nearbySeenIds === null) {
    nearbySeenIds = new Set(sightings.map((s) => s.id));
    return;
  }
  for (const s of sightings) {
    if (nearbySeenIds.has(s.id)) continue;
    nearbySeenIds.add(s.id);
    if (s.lat == null || s.lng == null) continue;
    const dist = haversineKm(nearbyCoords.lat, nearbyCoords.lng, s.lat, s.lng);
    if (dist <= nearbyRadiusKm) showNearbyToast(dist);
  }
}

function wireNearbyAlert() {
  const checkbox = document.getElementById("nearby-alert-checkbox");
  const radiusSelect = document.getElementById("nearby-alert-radius");
  if (!checkbox) return;

  if (radiusSelect) {
    nearbyRadiusKm = Number(radiusSelect.value) || 25;
    radiusSelect.addEventListener("change", () => {
      nearbyRadiusKm = Number(radiusSelect.value) || 25;
    });
  }

  checkbox.addEventListener("change", () => {
    if (!checkbox.checked) {
      nearbyEnabled = false;
      nearbyCoords = null;
      nearbySeenIds = null;
      return;
    }
    if (!navigator.geolocation) {
      checkbox.checked = false;
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        nearbyCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        nearbyEnabled = true;
        nearbySeenIds = null; // baseline captured on the next checkNearby() call
      },
      () => {
        // Permission denied or position unavailable — leave the box
        // unchecked rather than pretending it's on.
        checkbox.checked = false;
        nearbyEnabled = false;
      }
    );
  });
}
