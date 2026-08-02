// Wires together the map, form, list, stats and chart. Vanilla JS, no build step.
(function () {
  const SIGHTINGS_POLL_MS = 2 * 60 * 1000; // 2 minutes
  const LIST_PAGE_SIZE = 6;
  const LIST_PAGE_STEP = 10;

  let sightings = [];
  let voteCounts = {};
  let sightingsShownCount = LIST_PAGE_SIZE;

  const el = {
    map: null,
    langBtns: document.querySelectorAll("[data-lang-btn]"),
    list: document.getElementById("sightings-list"),
    typeFilter: document.getElementById("sightings-type-filter"),
    timeFilter: document.getElementById("sightings-time-filter"),
    photoFilter: document.getElementById("sightings-photo-filter"),
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
    return d.toLocaleDateString(localeForLang(lang), {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function typeLabel(type) {
    if (type === "tracks") return t("typeTracks");
    if (type === "damage") return t("typeDamage");
    if (type === "dead") return t("typeDead");
    if (type === "dna_sample") return t("typeDnaSample");
    return t("typeSighting");
  }

  async function refreshAll() {
    const [freshSightings, freshVoteCounts] = await Promise.all([loadSightings(), loadVoteCounts()]);
    sightings = freshSightings;
    voteCounts = freshVoteCounts;
    renderFilteredSightings();
    renderStatsAndChart();
  }

  function matchesTimeFilter(dateStr, filterValue) {
    if (filterValue === "all") return true;
    const d = new Date(dateStr);
    if (filterValue === "year") return d.getFullYear() === new Date().getFullYear();
    if (filterValue === "30d") return Date.now() - d.getTime() <= 30 * 24 * 60 * 60 * 1000;
    return true;
  }

  function getFilteredSightings() {
    const type = el.typeFilter.value;
    const time = el.timeFilter.value;
    const photoOnly = el.photoFilter.checked;
    return sightings.filter(
      (s) =>
        (type === "all" || s.type === type) &&
        matchesTimeFilter(s.date, time) &&
        (!photoOnly || !!s.photoUrl)
    );
  }

  function renderFilteredSightings() {
    const filtered = getFilteredSightings();
    renderMarkers(filtered, (s) => openDetailsFromMarker(s));
    renderList(filtered);
  }

  // Stats/chart reflect both community reports and news-collected mentions
  // combined — a fresh install has zero of the former, so anchoring the
  // headline numbers to sightings alone would show "0" even when the news
  // scanner already found a dozen real, dated cases. Only news items with a
  // matched place (lat/lng — see findPlace() in scripts/fetch-news.js) count
  // here: a named town/village is a reliable sign the article is about a
  // specific incident rather than population stats, hunting policy, or a
  // passing mention. The news list itself still shows every bear-related
  // article regardless (see renderNewsList()).
  function combinedForStats() {
    const newsAsEntries = latestNewsItems
      .filter((n) => n.lat != null && n.lng != null)
      .map((n) => ({ date: n.pubDate.slice(0, 10) }));
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

  function renderList(filtered) {
    el.list.innerHTML = "";
    if (filtered.length === 0) {
      const empty = document.createElement("li");
      empty.className = "list-empty";
      empty.textContent = sightings.length === 0 ? t("emptyList") : t("filterNoMatch");
      el.list.appendChild(empty);
      return;
    }

    const sorted = [...filtered].sort((a, b) => (a.date < b.date ? 1 : -1));
    sorted.slice(0, sightingsShownCount).forEach((s) => {
      const li = document.createElement("li");
      li.className = "sighting-item";
      li.dataset.id = s.id;

      const flagBtn = document.createElement("button");
      flagBtn.type = "button";
      flagBtn.className = "report-issue-btn";
      flagBtn.textContent = "🚩";
      flagBtn.title = t("reportIssueBtnTitle");
      flagBtn.setAttribute("aria-label", t("reportIssueBtnTitle"));
      flagBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openReportIssueModal("sighting", s.id);
      });
      li.appendChild(flagBtn);

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

      if (s.photoUrl) {
        const thumb = document.createElement("img");
        thumb.className = "sighting-thumb";
        thumb.src = s.photoUrl;
        thumb.alt = "";
        thumb.loading = "lazy";
        thumb.addEventListener("click", (e) => {
          e.stopPropagation();
          window.open(s.photoUrl, "_blank", "noopener");
        });
        body.appendChild(thumb);
      }

      body.appendChild(buildVoteRow(s));

      li.appendChild(body);

      li.addEventListener("click", () => flyToSighting(s));

      el.list.appendChild(li);
    });

    if (sorted.length > sightingsShownCount) {
      const more = document.createElement("li");
      more.className = "list-show-more";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = `${t("showMoreBtn")} (+${sorted.length - sightingsShownCount})`;
      btn.addEventListener("click", () => {
        sightingsShownCount += LIST_PAGE_STEP;
        renderList(filtered);
      });
      more.appendChild(btn);
      el.list.appendChild(more);
    }
  }

  function buildVoteRow(s) {
    const counts = voteCounts[s.id] || { confirm: 0, dispute: 0 };
    const myVote = getMyVotes()[s.id];

    const row = document.createElement("div");
    row.className = "vote-row";

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "vote-btn vote-confirm";
    confirmBtn.innerHTML = `✓ <span>${counts.confirm}</span>`;
    confirmBtn.title = t("confirmBtn");

    const disputeBtn = document.createElement("button");
    disputeBtn.type = "button";
    disputeBtn.className = "vote-btn vote-dispute";
    disputeBtn.innerHTML = `✕ <span>${counts.dispute}</span>`;
    disputeBtn.title = t("disputeBtn");

    if (myVote) {
      confirmBtn.disabled = true;
      disputeBtn.disabled = true;
      (myVote === "confirm" ? confirmBtn : disputeBtn).classList.add("active");
    }

    [
      [confirmBtn, "confirm"],
      [disputeBtn, "dispute"],
    ].forEach(([btn, voteType]) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        confirmBtn.disabled = true;
        disputeBtn.disabled = true;
        const result = await submitVote(s.id, voteType);
        if (result === "error") {
          confirmBtn.disabled = !!myVote;
          disputeBtn.disabled = !!myVote;
          alert(t("voteError"));
          return;
        }
        voteCounts = await loadVoteCounts();
        renderList(getFilteredSightings());
      });
    });

    row.appendChild(confirmBtn);
    row.appendChild(disputeBtn);
    return row;
  }

  function openDetailsFromMarker(s) {
    const item = el.list.querySelector(`[data-id="${s.id}"]`);
    if (item) {
      item.scrollIntoView({ behavior: "smooth", block: "center" });
      item.classList.add("highlight");
      setTimeout(() => item.classList.remove("highlight"), 1200);
    }
  }

  // --- Language ---

  function switchLang(lang) {
    setLang(lang);
    applyTranslations();
    renderList(getFilteredSightings());
    renderStatsAndChart();
    if (typeof renderNewsList === "function") renderNewsList();
  }

  // --- Wire up events ---

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
      initNews(leafletMap, (newsItems) => {
        latestNewsItems = newsItems;
        renderStatsAndChart();
      });
    }

    el.langBtns.forEach((btn) => {
      btn.addEventListener("click", () => switchLang(btn.getAttribute("data-lang-btn")));
    });

    el.typeFilter.addEventListener("change", () => {
      sightingsShownCount = LIST_PAGE_SIZE;
      renderFilteredSightings();
    });
    el.timeFilter.addEventListener("change", () => {
      sightingsShownCount = LIST_PAGE_SIZE;
      renderFilteredSightings();
    });
    el.photoFilter.addEventListener("change", () => {
      sightingsShownCount = LIST_PAGE_SIZE;
      renderFilteredSightings();
    });

    refreshAll();
    setInterval(refreshAll, SIGHTINGS_POLL_MS);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
