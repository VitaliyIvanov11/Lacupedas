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
    const sightings = await refreshSightingsPanel();
    renderMarkers(getFilteredSightings(), (s) => openDetailsFromMarker(s));
    if (typeof checkNearby === "function") checkNearby(sightings);
  }

  // Desktop-only tab system (Ziņas/Novērojumi/Statistika) for the sidebar —
  // see the [data-tab-panel] rules in style.css. Mobile ignores all of
  // this: .sidebar-tabbar is display:none there via CSS, and every panel
  // keeps showing in its original stacked order regardless of
  // data-active-tab, so this wiring has no effect on the mobile view.
  function wireSidebarTabs() {
    const sidebar = document.getElementById("sidebar");
    const tabs = document.querySelectorAll(".sidebar-tab");
    if (!sidebar || !tabs.length) return;
    tabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        sidebar.dataset.activeTab = btn.dataset.tab;
        tabs.forEach((b) => {
          const active = b === btn;
          b.classList.toggle("active", active);
          b.setAttribute("aria-selected", String(active));
        });
      });
    });
  }

  // Mobile-only (see the 900px query in style.css) — on desktop the toggle
  // is display:none and the panel is always visibly inline, so this class
  // toggle has nothing to do there. Mirrors wireFiltersToggle() in
  // js/map-page.js exactly.
  function wireNewsFiltersToggle() {
    const toggle = document.getElementById("news-filters-toggle");
    const panel = document.getElementById("news-filters-panel");
    if (!toggle || !panel) return;
    toggle.addEventListener("click", () => {
      const willOpen = !panel.classList.contains("open");
      panel.classList.toggle("open", willOpen);
      toggle.setAttribute("aria-expanded", String(willOpen));
    });
  }

  const SIDEBAR_COLLAPSED_KEY = "lacupedas-sidebar-collapsed";

  function wireSidebarCollapse(leafletMap) {
    const toggle = document.getElementById("sidebar-toggle-btn");
    const layout = document.querySelector(".layout");
    if (!toggle || !layout) return;
    // Leaflet caches its container's pixel size and doesn't notice a
    // CSS-driven resize on its own — without this, collapsing the
    // sidebar leaves the map's tiles at their old width, with a grey gap
    // where the sidebar used to be. .layout's own transition (see
    // style.css) is 0.2s, so this fires just after it settles.
    const resizeMap = () => {
      if (leafletMap) setTimeout(() => leafletMap.invalidateSize(), 220);
    };
    const setCollapsed = (collapsed) => {
      layout.classList.toggle("sidebar-collapsed", collapsed);
      toggle.setAttribute("aria-expanded", String(!collapsed));
      resizeMap();
    };
    setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    toggle.addEventListener("click", () => {
      const collapsed = !layout.classList.contains("sidebar-collapsed");
      setCollapsed(collapsed);
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    });
  }

  // Generic ⓘ-button + popover wiring (see .info-btn/.info-popover in
  // style.css) — used both for the news card's source/methodology note
  // (every width) and the compact stats line's "what do these numbers
  // mean" note (mobile only — desktop shows the fuller .stats-grid
  // instead, see .stats-compact-line's own desktop-hide rule). Each
  // button just needs a matching aria-controls target; nothing here is
  // hard-coded to one specific pair, so a third one later is a markup-only
  // addition.
  function wireInfoPopovers() {
    document.querySelectorAll(".info-btn").forEach((btn) => {
      const popover = document.getElementById(btn.getAttribute("aria-controls"));
      if (!popover) return;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = popover.hidden;
        popover.hidden = !open;
        btn.setAttribute("aria-expanded", String(open));
      });
    });
    document.addEventListener("click", (e) => {
      document.querySelectorAll(".info-btn").forEach((btn) => {
        const popover = document.getElementById(btn.getAttribute("aria-controls"));
        if (popover && !popover.hidden && !popover.contains(e.target) && e.target !== btn) {
          popover.hidden = true;
          btn.setAttribute("aria-expanded", "false");
        }
      });
    });
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
    wireSidebarTabs();
    wireSidebarCollapse(leafletMap);
    wireInfoPopovers();
    wireNewsFiltersToggle();
    if (typeof wireNearbyAlert === "function") wireNearbyAlert();

    initLangSwitcher(() => {
      if (typeof applyCompactStatLabels === "function") applyCompactStatLabels();
      renderList(getFilteredListEntries());
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
