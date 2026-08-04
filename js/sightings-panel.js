// Sightings list + stats/chart rendering — shared between index.html
// (desktop sidebar, always visible; mobile home feed, kept in the DOM but
// hidden behind the "Skatīt detalizēti" link — see .layout .chart-card/
// .list-card in style.css) and stats.html (the mobile detail page that
// link points to, and the reason this logic lives here rather than inside
// app.js's own IIFE). Same callback-handoff shape as initReportForm(map,
// {onSaved})/initNews(map, onDataChange): initSightingsPanel() wires
// whatever of its elements exist on the current page.

const LIST_PAGE_SIZE = 6;
const LIST_PAGE_STEP = 10;
const STAT_LABELS = {
  lv: { total: "Kopā", year: "Šogad", last: "Pēdējais" },
  en: { total: "Total", year: "This year", last: "Latest" },
  ru: { total: "Всего", year: "За год", last: "Последнее" },
};

let spSightings = [];
let spVoteCounts = {};
let spShownCount = LIST_PAGE_SIZE;
let spLatestNewsItems = [];
let spEl = null;

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

function formatStatDate(dateStr) {
  const lang = getLang();
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d)) return dateStr;

  const isCurrentYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(localeForLang(lang), {
    day: "numeric",
    month: "short",
    ...(isCurrentYear ? {} : { year: "numeric" }),
  });
}

function applyCompactStatLabels() {
  if (!spEl) return;
  const labels = STAT_LABELS[getLang()] || STAT_LABELS.lv;
  if (spEl.statLabelTotal) spEl.statLabelTotal.textContent = labels.total;
  if (spEl.statLabelYear) spEl.statLabelYear.textContent = labels.year;
  if (spEl.statLabelLast) spEl.statLabelLast.textContent = labels.last;
}

function typeLabel(type) {
  if (type === "tracks") return t("typeTracks");
  if (type === "damage") return t("typeDamage");
  if (type === "dead") return t("typeDead");
  if (type === "dna_sample") return t("typeDnaSample");
  return t("typeSighting");
}

function sourceLabel(source) {
  if (source === "silava") return t("sourceSilava");
  if (source === "dap") return t("sourceDap");
  return "";
}

function matchesTimeFilter(dateStr, filterValue) {
  if (filterValue === "all") return true;
  const d = new Date(dateStr);
  if (filterValue === "year") return d.getFullYear() === new Date().getFullYear();
  if (filterValue === "30d") return Date.now() - d.getTime() <= 30 * 24 * 60 * 60 * 1000;
  return true;
}

function getFilteredSightings() {
  const type = spEl.typeFilter.value;
  const time = spEl.timeFilter.value;
  const photoOnly = spEl.photoFilter.checked;
  return spSightings.filter(
    (s) =>
      (type === "all" || s.type === type) &&
      matchesTimeFilter(s.date, time) &&
      (!photoOnly || !!s.photoUrl)
  );
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
  const newsAsEntries = spLatestNewsItems
    .filter((n) => n.lat != null && n.lng != null)
    .map((n) => ({ date: n.pubDate.slice(0, 10) }));
  return spSightings.concat(newsAsEntries);
}

function renderStatsAndChart() {
  const combined = combinedForStats();
  // #stat-total is absent on index.html (only "this year" and "latest"
  // show there — see #stats-section's markup) but still present on
  // stats.html's fuller detail view.
  if (spEl.statTotal) spEl.statTotal.textContent = combined.length;
  const year = new Date().getFullYear();
  const yearCount = combined.filter((s) => new Date(s.date).getFullYear() === year).length;
  const lastText =
    combined.length === 0
      ? t("noneYet")
      : formatStatDate([...combined].sort((a, b) => (a.date < b.date ? 1 : -1))[0].date);

  spEl.statYear.textContent = yearCount;
  spEl.statLast.textContent = lastText;
  // Desktop-only compact echo in the map toolbar (see .toolbar-stats in
  // css/style.css) — absent on stats.html/map.html, hence the guards.
  if (spEl.toolbarStatYear) spEl.toolbarStatYear.textContent = yearCount;
  if (spEl.toolbarStatLast) spEl.toolbarStatLast.textContent = lastText;

  renderMonthlyChart(spEl.chartContainer, combined);
}

function renderList(filtered) {
  spEl.list.innerHTML = "";
  if (filtered.length === 0) {
    const empty = document.createElement("li");
    empty.className = "list-empty";
    empty.textContent = spSightings.length === 0 ? t("emptyList") : t("filterNoMatch");
    spEl.list.appendChild(empty);
    return;
  }

  const sorted = [...filtered].sort((a, b) => (a.date < b.date ? 1 : -1));
  sorted.slice(0, spShownCount).forEach((s) => {
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
    // Community reports (the overwhelming majority) get no badge at all —
    // only rows hand-imported from official monitoring data are marked, so
    // the badge itself signals "this one's official," not just metadata.
    if (s.source && s.source !== "community") {
      const sourceBadge = document.createElement("span");
      sourceBadge.className = "sighting-source-badge";
      sourceBadge.textContent = sourceLabel(s.source);
      top.appendChild(sourceBadge);
    }
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

    // flyToSighting is a no-op (guarded on `!map`) on pages with no
    // embedded map — e.g. stats.html, or index.html's mobile home feed.
    li.addEventListener("click", () => {
      if (typeof flyToSighting === "function") flyToSighting(s);
    });

    spEl.list.appendChild(li);
  });

  if (sorted.length > spShownCount) {
    const more = document.createElement("li");
    more.className = "list-show-more";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `${t("showMoreBtn")} (+${sorted.length - spShownCount})`;
    btn.addEventListener("click", () => {
      spShownCount += LIST_PAGE_STEP;
      renderList(filtered);
    });
    more.appendChild(btn);
    spEl.list.appendChild(more);
  }
}

function buildVoteRow(s) {
  const counts = spVoteCounts[s.id] || { confirm: 0, dispute: 0 };
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
      spVoteCounts = await loadVoteCounts();
      renderList(getFilteredSightings());
    });
  });

  row.appendChild(confirmBtn);
  row.appendChild(disputeBtn);
  return row;
}

function openDetailsFromMarker(s) {
  const item = spEl.list.querySelector(`[data-id="${s.id}"]`);
  if (item) {
    item.scrollIntoView({ behavior: "smooth", block: "center" });
    item.classList.add("highlight");
    setTimeout(() => item.classList.remove("highlight"), 1200);
  }
}

// Feeds the news-derived entries combinedForStats() needs — called from
// each page's initNews(..., onDataChange) callback.
function setSightingsPanelNews(newsItems) {
  spLatestNewsItems = newsItems;
  renderStatsAndChart();
}

async function refreshSightingsPanel() {
  const [freshSightings, freshVoteCounts] = await Promise.all([loadSightings(), loadVoteCounts()]);
  spSightings = freshSightings;
  spVoteCounts = freshVoteCounts;
  renderList(getFilteredSightings());
  renderStatsAndChart();
  return spSightings;
}

// Quotes any cell containing a comma, quote, or newline; doubles internal
// quotes — the standard CSV escaping rule (RFC 4180).
function csvCell(value) {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

// Exports exactly what's already public via the site (same fields as
// rowToSighting()) — this isn't new data exposure, just a convenient
// bulk-download of data the anon Supabase key already serves to anyone.
function downloadSightingsCsv() {
  const columns = ["id", "date", "type", "count", "lat", "lng", "description", "reporter", "source", "photoUrl", "createdAt"];
  const rows = [columns.join(",")];
  for (const s of spSightings) {
    rows.push(columns.map((col) => csvCell(s[col])).join(","));
  }
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lacupedas-noverojumi-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function initSightingsPanel() {
  spEl = {
    list: document.getElementById("sightings-list"),
    typeFilter: document.getElementById("sightings-type-filter"),
    timeFilter: document.getElementById("sightings-time-filter"),
    photoFilter: document.getElementById("sightings-photo-filter"),
    statTotal: document.getElementById("stat-total"),
    statYear: document.getElementById("stat-year"),
    statLast: document.getElementById("stat-last"),
    statLabelTotal: document.getElementById("stat-label-total"),
    statLabelYear: document.getElementById("stat-label-year"),
    statLabelLast: document.getElementById("stat-label-last"),
    chartContainer: document.getElementById("chart-container"),
    exportCsvBtn: document.getElementById("export-csv-btn"),
    toolbarStatYear: document.getElementById("toolbar-stat-year"),
    toolbarStatLast: document.getElementById("toolbar-stat-last"),
  };
  if (!spEl.list) return;

  applyCompactStatLabels();

  [spEl.typeFilter, spEl.timeFilter, spEl.photoFilter].forEach((field) => {
    field.addEventListener("change", () => {
      spShownCount = LIST_PAGE_SIZE;
      renderList(getFilteredSightings());
    });
  });

  if (spEl.exportCsvBtn) spEl.exportCsvBtn.addEventListener("click", downloadSightingsCsv);
}
