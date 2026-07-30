// localStorage-backed persistence for bear sightings. No backend — everything
// stays in the visitor's own browser.
const STORAGE_KEY = "lacupedas.sightings";

function uid() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function demoSightings() {
  return [
    {
      id: uid(),
      lat: 57.245,
      lng: 25.02,
      date: "2026-05-14",
      type: "sighting",
      count: 1,
      description:
        "Šis ir piemēra ieraksts — dzēsiet vai aizstājiet ar reāliem novērojumiem. / This is example data — delete it or replace it with real sightings.",
      reporter: "Piemērs / Example",
      isDemo: true,
      createdAt: "2026-05-14T08:00:00.000Z",
    },
    {
      id: uid(),
      lat: 56.65,
      lng: 27.55,
      date: "2026-06-02",
      type: "tracks",
      count: 2,
      description:
        "Šis ir piemēra ieraksts — dzēsiet vai aizstājiet ar reāliem novērojumiem. / This is example data — delete it or replace it with real sightings.",
      reporter: "Piemērs / Example",
      isDemo: true,
      createdAt: "2026-06-02T08:00:00.000Z",
    },
    {
      id: uid(),
      lat: 57.05,
      lng: 25.9,
      date: "2026-07-10",
      type: "damage",
      count: 1,
      description:
        "Šis ir piemēra ieraksts — dzēsiet vai aizstājiet ar reāliem novērojumiem. / This is example data — delete it or replace it with real sightings.",
      reporter: "Piemērs / Example",
      isDemo: true,
      createdAt: "2026-07-10T08:00:00.000Z",
    },
  ];
}

function loadSightings() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seed = demoSightings();
    saveSightings(seed);
    return seed;
  }
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
  const withFreshIds = newOnes.map((s) => ({ ...s, id: uid(), isDemo: false }));
  const merged = existing.concat(withFreshIds);
  saveSightings(merged);
  return merged;
}
