// Wires together the map, form, list, stats and chart on index.html. List/
// stats/chart rendering itself lives in js/sightings-panel.js (shared with
// stats.html); this file owns only what's specific to this page: the map,
// the report-form/news init calls, and reacting to filter changes by
// re-rendering markers.
(function () {
  const SIGHTINGS_POLL_MS = 2 * 60 * 1000; // 2 minutes

  const el = {
    typeFilter: document.getElementById("sightings-type-filter"),
    timeFilter: document.getElementById("sightings-time-filter"),
    photoFilter: document.getElementById("sightings-photo-filter"),
  };

  async function refreshAll() {
    await refreshSightingsPanel();
    renderMarkers(getFilteredSightings(), (s) => openDetailsFromMarker(s));
  }

  function init() {
    // Below 900px, index.html shows a mobile home feed instead of the
    // embedded map — .map-pane (and its #map/#modal-overlay/picking flow)
    // is hidden via CSS, so there's nothing for initMap()/initReportForm()
    // to attach to. Reporting there happens on the standalone map.html
    // instead (see .mobile-quick-actions / .mobile-bottom-nav links).
    const isMobile = typeof MOBILE_QUERY !== "undefined" && MOBILE_QUERY.matches;
    const leafletMap = isMobile ? null : initMap();
    applyTranslations();
    if (!isMobile && typeof initReportForm === "function") {
      initReportForm(leafletMap, { onSaved: refreshAll });
    }
    if (typeof initNews === "function") {
      initNews(leafletMap, (newsItems) => setSightingsPanelNews(newsItems));
    }
    initSightingsPanel();

    initLangSwitcher(() => {
      if (typeof applyCompactStatLabels === "function") applyCompactStatLabels();
      renderList(getFilteredSightings());
      renderStatsAndChart();
      if (typeof renderNewsList === "function") renderNewsList();
    });

    // The list/stats side of these filters is wired inside
    // initSightingsPanel() — this only re-renders the map markers.
    [el.typeFilter, el.timeFilter, el.photoFilter].forEach((field) => {
      field.addEventListener("change", () => {
        renderMarkers(getFilteredSightings(), (s) => openDetailsFromMarker(s));
      });
    });

    refreshAll();
    setInterval(refreshAll, SIGHTINGS_POLL_MS);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
