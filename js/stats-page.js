// Standalone stats page: the chart + full filterable sightings list moved
// here from index.html's mobile home feed (see .stats-detail-link in
// style.css). Reuses js/sightings-panel.js for all the actual rendering —
// this file only wires page-level concerns (language switching, news data
// for the stats calc, polling).
(function () {
  const STATS_POLL_MS = 2 * 60 * 1000; // 2 minutes

  async function refresh() {
    await refreshSightingsPanel();
  }

  function init() {
    applyTranslations();
    initSightingsPanel();
    if (typeof initNews === "function") {
      initNews(null, (newsItems) => setSightingsPanelNews(newsItems));
    }

    document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setLang(btn.getAttribute("data-lang-btn"));
        applyTranslations();
        renderList(getFilteredSightings());
        renderStatsAndChart();
      });
    });

    refresh();
    setInterval(refresh, STATS_POLL_MS);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
