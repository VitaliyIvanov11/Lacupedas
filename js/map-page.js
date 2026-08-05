// Standalone "map as a tool" page: full-bleed clustered map with type/time
// filters and a recency breakdown panel, sharing the same click-to-report
// flow (js/report-form.js) as the embedded map on index.html. Reachable
// directly or via index.html's mobile home feed ("Ziņot" links here with
// ?report=1, which auto-starts picking mode on load).
(function () {
  let sightings = [];
  let leafletMap = null;

  const el = {
    typeFilter: document.getElementById("sightings-type-filter"),
    timeFilter: document.getElementById("sightings-time-filter"),
  };

  function matchesTimeFilter(dateStr, filterValue) {
    if (filterValue === "all") return true;
    // "T00:00:00" forces local-time parsing for the year check -- a bare
    // "YYYY-MM-DD" parses as UTC midnight, which rolls back to the
    // previous local calendar year for any visitor west of UTC on Jan 1.
    if (filterValue === "year") return new Date(dateStr + "T00:00:00").getFullYear() === new Date().getFullYear();
    if (filterValue === "30d") return Date.now() - new Date(dateStr).getTime() <= 30 * 24 * 60 * 60 * 1000;
    return true;
  }

  function getFilteredSightings() {
    const type = el.typeFilter.value;
    const time = el.timeFilter.value;
    return sightings.filter((s) => (type === "all" || s.type === type) && matchesTimeFilter(s.date, time));
  }

  // Mirrors the age buckets a visitor would care about when gauging how
  // "live" the current map view is — computed from the same filtered set
  // feeding the markers, so the panel and the map always agree.
  function buildRecencyPanel() {
    const panel = document.getElementById("map-recency-panel");
    if (!panel) return;

    const dates = getFilteredSightings()
      .map((s) => s.date)
      .concat(typeof getFilteredNews === "function" ? getFilteredNews().map((n) => n.pubDate.slice(0, 10)) : []);

    const now = Date.now();
    let within7 = 0;
    let within30 = 0;
    let older = 0;
    dates.forEach((dateStr) => {
      const d = new Date(dateStr);
      if (isNaN(d)) return;
      const ageMs = now - d.getTime();
      if (ageMs <= 7 * 24 * 60 * 60 * 1000) within7++;
      else if (ageMs <= 30 * 24 * 60 * 60 * 1000) within30++;
      else older++;
    });

    panel.innerHTML = "";
    [
      { key: "recency7d", count: within7 },
      { key: "recency30d", count: within30 },
      { key: "recencyOlder", count: older },
    ].forEach((row) => {
      const rowEl = document.createElement("div");
      rowEl.className = "legend-row";
      const label = document.createElement("span");
      label.textContent = `${t(row.key)}: ${row.count}`;
      rowEl.appendChild(label);
      panel.appendChild(rowEl);
    });
  }

  function wireRecencyToggle() {
    const toggle = document.getElementById("map-recency-toggle");
    const panel = document.getElementById("map-recency-panel");
    if (!toggle || !panel) return;
    toggle.addEventListener("click", () => {
      const willOpen = panel.hidden;
      panel.hidden = !willOpen;
      toggle.setAttribute("aria-expanded", String(willOpen));
    });
  }

  // Mobile-only (see the 900px query in css/map-page.css) — on desktop the
  // toggle button is display:none and the panel is always visibly inline,
  // so this class toggle has nothing to do there.
  function wireFiltersToggle() {
    const toggle = document.getElementById("map-filters-toggle");
    const panel = document.getElementById("map-filters-panel");
    if (!toggle || !panel) return;
    toggle.addEventListener("click", () => {
      const willOpen = !panel.classList.contains("open");
      panel.classList.toggle("open", willOpen);
      toggle.setAttribute("aria-expanded", String(willOpen));
    });
  }

  function render() {
    renderMarkers(getFilteredSightings());
    buildRecencyPanel();
  }

  async function refreshMapView() {
    sightings = await loadSightings();
    render();
  }

  async function init() {
    leafletMap = initMap();
    applyTranslations();
    initReportForm(leafletMap, { onSaved: refreshMapView });
    initNews(leafletMap, () => buildRecencyPanel());

    initLangSwitcher(render);

    el.typeFilter.addEventListener("change", render);
    el.timeFilter.addEventListener("change", render);

    wireRecencyToggle();
    wireFiltersToggle();

    await refreshMapView();

    const params = new URLSearchParams(location.search);
    if (params.get("report") === "1" && typeof startPicking === "function") {
      startPicking();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
