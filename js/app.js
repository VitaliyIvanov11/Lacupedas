// Wires together the map, form, list, stats and chart. Vanilla JS, no build step.
(function () {
  let sightings = [];
  let pendingLatLng = null;

  const el = {
    map: null,
    langBtns: document.querySelectorAll("[data-lang-btn]"),
    reportBtn: document.getElementById("report-btn"),
    useLocationBtn: document.getElementById("use-location-btn"),
    cancelPickingBtn: document.getElementById("cancel-picking-btn"),
    pickingBanner: document.getElementById("picking-banner"),
    modalOverlay: document.getElementById("modal-overlay"),
    form: document.getElementById("sighting-form"),
    formLocation: document.getElementById("form-location"),
    formCancelBtn: document.getElementById("form-cancel-btn"),
    formError: document.getElementById("form-error"),
    list: document.getElementById("sightings-list"),
    statTotal: document.getElementById("stat-total"),
    statYear: document.getElementById("stat-year"),
    statLast: document.getElementById("stat-last"),
    chartContainer: document.getElementById("chart-container"),
  };

  let latestNewsItems = [];

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    const lang = getLang();
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString(lang === "lv" ? "lv-LV" : "en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function typeLabel(type) {
    if (type === "tracks") return t("typeTracks");
    if (type === "damage") return t("typeDamage");
    return t("typeSighting");
  }

  function refreshAll() {
    sightings = loadSightings();
    renderMarkers(sightings, (s) => openDetailsFromMarker(s));
    renderList();
    renderStatsAndChart();
  }

  // Stats/chart reflect both community reports and news-collected mentions
  // combined — a fresh install has zero of the former, so anchoring the
  // headline numbers to sightings alone would show "0" even when the news
  // scanner already found a dozen real, dated cases.
  function combinedForStats() {
    const newsAsEntries = latestNewsItems.map((n) => ({ date: n.pubDate.slice(0, 10) }));
    return sightings.concat(newsAsEntries);
  }

  function renderStatsAndChart() {
    const combined = combinedForStats();
    el.statTotal.textContent = combined.length;
    const year = new Date().getFullYear();
    el.statYear.textContent = combined.filter((s) => new Date(s.date).getFullYear() === year).length;
    if (combined.length === 0) {
      el.statLast.textContent = t("noneYet");
    } else {
      const latest = [...combined].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
      el.statLast.textContent = formatDate(latest.date);
    }
    renderMonthlyChart(el.chartContainer, combined);
  }

  function renderList() {
    el.list.innerHTML = "";
    if (sightings.length === 0) {
      const empty = document.createElement("li");
      empty.className = "list-empty";
      empty.textContent = t("emptyList");
      el.list.appendChild(empty);
      return;
    }

    const sorted = [...sightings].sort((a, b) => (a.date < b.date ? 1 : -1));
    sorted.forEach((s) => {
      const li = document.createElement("li");
      li.className = "sighting-item";
      li.dataset.id = s.id;

      const dot = document.createElement("span");
      dot.className = "type-dot";
      dot.style.background = TYPE_COLORS[s.type] || TYPE_COLORS.sighting;
      li.appendChild(dot);

      const body = document.createElement("div");
      body.className = "sighting-body";

      const top = document.createElement("div");
      top.className = "sighting-top";
      const dateSpan = document.createElement("span");
      dateSpan.className = "sighting-date";
      dateSpan.textContent = formatDate(s.date);
      const typeSpan = document.createElement("span");
      typeSpan.className = "sighting-type";
      typeSpan.textContent = typeLabel(s.type) + " · 🐻×" + (s.count || 1);
      top.appendChild(dateSpan);
      top.appendChild(typeSpan);
      body.appendChild(top);

      if (s.description) {
        const desc = document.createElement("p");
        desc.className = "sighting-desc";
        desc.textContent = s.description;
        body.appendChild(desc);
      }

      if (s.reporter) {
        const rep = document.createElement("p");
        rep.className = "sighting-reporter";
        rep.textContent = "— " + s.reporter;
        body.appendChild(rep);
      }

      li.appendChild(body);

      const delBtn = document.createElement("button");
      delBtn.className = "delete-btn";
      delBtn.type = "button";
      delBtn.title = t("deleteBtn");
      delBtn.textContent = "×";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(t("deleteConfirm"))) {
          sightings = deleteSighting(s.id);
          refreshAll();
        }
      });
      li.appendChild(delBtn);

      li.addEventListener("click", () => flyToSighting(s));

      el.list.appendChild(li);
    });
  }

  function openDetailsFromMarker(s) {
    const item = el.list.querySelector(`[data-id="${s.id}"]`);
    if (item) {
      item.scrollIntoView({ behavior: "smooth", block: "center" });
      item.classList.add("highlight");
      setTimeout(() => item.classList.remove("highlight"), 1200);
    }
  }

  // --- Reporting flow ---

  function startPicking() {
    setPickingMode(true, (lat, lng) => {
      pendingLatLng = { lat, lng };
      setPickingMode(false);
      el.pickingBanner.hidden = true;
      openForm();
    });
    el.pickingBanner.hidden = false;
  }

  function stopPicking() {
    setPickingMode(false);
    el.pickingBanner.hidden = true;
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      alert(t("geoUnsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        pendingLatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        openForm();
      },
      () => alert(t("geoError")),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function openForm() {
    if (!pendingLatLng) return;
    el.form.reset();
    el.formError.hidden = true;
    el.form.elements["date"].value = new Date().toISOString().slice(0, 10);
    el.form.elements["count"].value = 1;
    el.formLocation.textContent = pendingLatLng.lat.toFixed(4) + ", " + pendingLatLng.lng.toFixed(4);
    el.modalOverlay.hidden = false;
  }

  function closeForm() {
    el.modalOverlay.hidden = true;
    pendingLatLng = null;
  }

  function submitForm(e) {
    e.preventDefault();
    if (!pendingLatLng) return;
    const fd = new FormData(el.form);
    const date = fd.get("date");
    const type = fd.get("type");
    const count = Math.max(1, parseInt(fd.get("count"), 10) || 1);
    const description = (fd.get("description") || "").trim();
    const reporter = (fd.get("reporter") || "").trim();

    if (!date || !type) {
      el.formError.hidden = false;
      el.formError.textContent = t("requiredError");
      return;
    }

    const sighting = {
      id: uid(),
      lat: pendingLatLng.lat,
      lng: pendingLatLng.lng,
      date,
      type,
      count,
      description,
      reporter,
      createdAt: new Date().toISOString(),
    };

    sightings = addSighting(sighting);
    closeForm();
    refreshAll();
  }

  // --- Language ---

  function switchLang(lang) {
    setLang(lang);
    applyTranslations();
    renderList();
    renderStatsAndChart();
    if (typeof renderNewsList === "function") renderNewsList();
  }

  // --- Wire up events ---

  function init() {
    const leafletMap = initMap();
    applyTranslations();
    if (typeof initNews === "function") {
      initNews(leafletMap, (newsItems) => {
        latestNewsItems = newsItems;
        renderStatsAndChart();
      });
    }

    el.langBtns.forEach((btn) => {
      btn.addEventListener("click", () => switchLang(btn.getAttribute("data-lang-btn")));
    });

    el.reportBtn.addEventListener("click", startPicking);
    el.cancelPickingBtn.addEventListener("click", stopPicking);
    el.useLocationBtn.addEventListener("click", useMyLocation);
    el.formCancelBtn.addEventListener("click", closeForm);
    el.modalOverlay.addEventListener("click", (e) => {
      if (e.target === el.modalOverlay) closeForm();
    });
    el.form.addEventListener("submit", submitForm);

    refreshAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
