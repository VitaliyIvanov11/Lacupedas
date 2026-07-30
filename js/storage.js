// localStorage-backed persistence for bear sightings. No backend — everything
// stays in the visitor's own browser.
const STORAGE_KEY = "lacupedas.sightings";

function uid() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function loadSightings() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("not an array");
    return parsed;
  } catch (e) {
    return [];
  }
}

function saveSightings(sightings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sightings));
}

function addSighting(sighting) {
  const sightings = loadSightings();
  sightings.push(sighting);
  saveSightings(sightings);
  return sightings;
}

function deleteSighting(id) {
  const sightings = loadSightings().filter((s) => s.id !== id);
  saveSightings(sightings);
  return sightings;
}

function clearAllSightings() {
  saveSightings([]);
}

function importSightings(newOnes) {
  const existing = loadSightings();
  const withFreshIds = newOnes.map((s) => ({ ...s, id: uid() }));
  const merged = existing.concat(withFreshIds);
  saveSightings(merged);
  return merged;
}
