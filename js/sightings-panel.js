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
// The chart combines sightings + news (see combinedForStats()), but news
// loads asynchronously via its own poll (initNews()'s fire-and-forget
// pollNews() call) — refreshAll()'s first renderStatsAndChart() call
// always runs before that fetch resolves. Without this flag, that first
// render genuinely computes zero everywhere (spLatestNewsItems is still
// its initial []), showing a flat empty chart for real bear activity
// until the second, news-included render arrives moments later — not
// wrong for that instant, but misleading to glance at.
let spNewsLoadedOnce = false;

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
  // "T00:00:00" forces local-time parsing for the year check below -- a
  // bare "YYYY-MM-DD" parses as UTC midnight, which rolls back to the
  // previous local calendar year for any visitor west of UTC on Jan 1.
  // The "30d" branch below only ever diffs epoch ms, so it's unaffected
  // either way and isn't worth the same treatment.
  const d = new Date(dateStr + "T00:00:00");
  if (filterValue === "year") return d.getFullYear() === new Date().getFullYear();
  if (filterValue === "30d") return Date.now() - new Date(dateStr).getTime() <= 30 * 24 * 60 * 60 * 1000;
  return true;
}

// Sightings only, unfiltered by verification — this is also what feeds the
// sightings marker LAYER on the map (renderMarkers() in app.js/map-page.js),
// which must stay sightings-only: verified media items already have their
// own marker on the separate news layer (green-ringed diamond, see
// buildLocateControl()'s sibling newsIcon() in js/news.js) — blending them
// in here too would double-render the same item as two different pins.
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

// Verified media entries (VERIFIED_LINKS in scripts/fetch-news.js) reshaped
// to fit the same list-row rendering as a real sighting — see
// renderList()'s "news_verified" branch. Kept out of getFilteredSightings()
// itself (see the comment there) since that function also feeds the map's
// sightings layer, not just the list.
function verifiedNewsAsListEntries() {
  return geotaggedNews()
    .filter((n) => n.verified)
    .map((n) => ({
      id: n.id,
      date: n.pubDate.slice(0, 10),
      type: null,
      count: null,
      description: newsTitleFor(n),
      reporter: null,
      photoUrl: null,
      source: "news_verified",
      mediaSource: n.source,
      eventCountry: n.eventCountry,
      link: n.link,
      lat: n.lat,
      lng: n.lng,
    }));
}

// "Kopienas novērojumi" (the *count* on the stats card) stays community-
// submissions-only on purpose — see renderStatsAndChart()'s comment on why
// blending in news there was misleading. The browsable *list* is different:
// it's a reasonable place to surface data that's actually reliable while
// real community submissions are still at zero, as long as each row is
// clearly badged with where it came from (which renderList() does). Media
// entries have no `type` of their own to match a type-filter against, and
// never have a photo, so they only show under "all types" with the photo
// filter off — matching the sightings list's own logic for either exactly.
function getFilteredListEntries() {
  const sightings = getFilteredSightings();
  if (spEl.typeFilter.value !== "all" || spEl.photoFilter.checked) return sightings;
  const time = spEl.timeFilter.value;
  const media = verifiedNewsAsListEntries().filter((n) => matchesTimeFilter(n.date, time));
  return sightings.concat(media);
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
function geotaggedNews() {
  return spLatestNewsItems.filter((n) => n.lat != null && n.lng != null);
}

// "Kopienas novērojumi"/Šogad/Pēdējais are community-submissions-only (see
// renderStatsAndChart()'s comment below) — spSightings itself stays
// unfiltered by source, since it also feeds the map's sightings marker
// layer and the browsable list, where a source:"silava"/"dap" row is
// legitimate and gets its own badge (see sourceLabel(), renderList()).
// This exists so the headline numbers can filter it back out without
// duplicating the "!s.source || s.source === 'community'" check at every
// call site.
function communitySightings() {
  return spSightings.filter((s) => !s.source || s.source === "community");
}

// Only used for the chart, which stays a single combined series for now
// (see renderStatsAndChart()'s comment on why the *numbers* no longer
// blend the two) — a real dual-series chart is a bigger redesign than
// this pass covers, so the chart keeps combined data but is now labeled
// honestly instead (chartTitle/chartCombinedNote in js/i18n.js).
function combinedForStats() {
  const newsAsEntries = geotaggedNews().map((n) => ({ date: n.pubDate.slice(0, 10) }));
  return spSightings.concat(newsAsEntries);
}

function renderStatsAndChart() {
  // Every number labeled "novērojumi" (sightings) now means literally
  // that — community-submitted reports only. Previously these blended in
  // geotagged news mentions too, so a visitor could see e.g. "15 total
  // sightings" while the list right below correctly said "no community
  // sightings yet" — the numbers and the list contradicted each other.
  // News mentions get their own, separately labeled count instead
  // (#stat-news-mentions, stats.html only — no room on index.html's
  // compact card/toolbar echo). Same reasoning now also applies to a
  // source:"silava"/"dap" row in `sightings` itself — real bug hit in
  // practice: the first such row (a hand-imported Silava case) bumped
  // "Kopienas novērojumi" to 1 before this filter existed, exactly the
  // same honesty problem this comment already describes for news.
  const community = communitySightings();
  const year = new Date().getFullYear();
  // "T00:00:00" -- see matchesTimeFilter()'s comment on the same pitfall.
  const yearCount = community.filter((s) => new Date(s.date + "T00:00:00").getFullYear() === year).length;
  const lastText =
    community.length === 0
      ? t("noneYet")
      : formatStatDate([...community].sort((a, b) => (a.date < b.date ? 1 : -1))[0].date);

  // #stat-total is absent on index.html (only "this year" and "latest"
  // show there — see #stats-section's markup) but still present on
  // stats.html's fuller detail view.
  if (spEl.statTotal) spEl.statTotal.textContent = community.length;
  spEl.statYear.textContent = yearCount;
  spEl.statLast.textContent = lastText;
  // Desktop-only compact echo in the map toolbar (see .toolbar-stats in
  // css/style.css) — absent on stats.html/map.html, hence the guards.
  if (spEl.toolbarStatYear) spEl.toolbarStatYear.textContent = yearCount;
  if (spEl.toolbarStatLast) spEl.toolbarStatLast.textContent = lastText;
  if (spEl.statNewsMentions) spEl.statNewsMentions.textContent = geotaggedNews().length;
  if (spEl.statNewsCompact) spEl.statNewsCompact.textContent = geotaggedNews().length;
  if (spEl.toolbarStatNews) spEl.toolbarStatNews.textContent = geotaggedNews().length;
  // Rows in `sightings` itself with a non-community source (Task 5's hand-
  // imported Silava/DAP cases) — same reasoning as news mentions above:
  // they show up as real pins on the map/list, so they need their own
  // honest count instead of just vanishing from every stat now that
  // communitySightings() correctly excludes them from "Kopienas novērojumi".
  if (spEl.statOfficial) spEl.statOfficial.textContent = spSightings.length - community.length;
  if (spEl.statNewsVerified) {
    const verifiedCount = geotaggedNews().filter((n) => n.verified).length;
    spEl.statNewsVerified.textContent = verifiedCount > 0 ? t("newsVerifiedCount").replace("{n}", verifiedCount) : "";
  }

  if (spNewsLoadedOnce) {
    renderMonthlyChart(spEl.chartContainer, combinedForStats());
  } else {
    spEl.chartContainer.innerHTML = `<p class="viz-empty">${t("chartLoading")}</p>`;
  }
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

    const isMedia = s.source === "news_verified";

    const flagBtn = document.createElement("button");
    flagBtn.type = "button";
    flagBtn.className = "report-issue-btn";
    flagBtn.textContent = "🚩";
    flagBtn.title = t("reportIssueBtnTitle");
    flagBtn.setAttribute("aria-label", t("reportIssueBtnTitle"));
    flagBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openReportIssueModal(isMedia ? "news" : "sighting", s.id);
    });
    li.appendChild(flagBtn);

    const dot = document.createElement("span");
    dot.className = "type-dot";
    const isBorderMedia = isMedia && (s.eventCountry === "EE" || s.eventCountry === "LT");
    dot.style.background = isBorderMedia
      ? NEWS_BORDER_COLOR
      : isMedia
        ? NEWS_MARKER_COLOR
        : TYPE_COLORS[s.type] || TYPE_COLORS.sighting;
    li.appendChild(dot);

    const body = document.createElement("div");
    body.className = "sighting-body";

    const top = document.createElement("div");
    top.className = "sighting-top";
    const dateSpan = document.createElement("span");
    dateSpan.className = "sighting-date";
    dateSpan.textContent = formatDate(s.date);
    top.appendChild(dateSpan);

    if (isMedia) {
      // No sighting `type`/`count` to show — the portal name + the same
      // verified badge the news list itself uses stand in for it.
      const portalSpan = document.createElement("span");
      portalSpan.className = "sighting-type";
      portalSpan.textContent = s.mediaSource || "";
      top.appendChild(portalSpan);
      const verifiedBadge = document.createElement("span");
      verifiedBadge.className = "news-verified-badge";
      verifiedBadge.textContent = t("newsVerifiedBadge");
      top.appendChild(verifiedBadge);
    } else {
      const typeSpan = document.createElement("span");
      typeSpan.className = "sighting-type";
      typeSpan.textContent = typeLabel(s.type) + " · 🐻×" + (s.count || 1);
      top.appendChild(typeSpan);
      // Community reports (the overwhelming majority) get no badge at all —
      // only rows hand-imported from official monitoring data are marked,
      // so the badge itself signals "this one's official," not just
      // metadata.
      if (s.source && s.source !== "community") {
        const sourceBadge = document.createElement("span");
        sourceBadge.className = "sighting-source-badge";
        sourceBadge.textContent = sourceLabel(s.source);
        top.appendChild(sourceBadge);
      }
    }
    body.appendChild(top);

    if (s.description) {
      // Media entries: the headline itself links out to the source article
      // (same as the news list) — stopPropagation so it doesn't also
      // trigger the row's own fly-to-it-on-the-map click below.
      const desc = document.createElement(isMedia ? "a" : "p");
      desc.className = "sighting-desc";
      desc.textContent = s.description;
      if (isMedia) {
        desc.href = s.link;
        desc.target = "_blank";
        desc.rel = "noopener";
        desc.addEventListener("click", (e) => e.stopPropagation());
      }
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

    // Voting is a community-credibility signal for unverified, self-
    // reported submissions — redundant (and semantically wrong; there's no
    // sightings-table row for a news item's id to attach a vote to) once
    // something's already been human-verified.
    if (!isMedia) {
      body.appendChild(buildVoteRow(s));
    }

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
      renderList(getFilteredListEntries());
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
  spNewsLoadedOnce = true;
  renderStatsAndChart();
  // News (and any verified-media rows it feeds into the list — see
  // getFilteredListEntries()) loads asynchronously, after the list's own
  // first render — without this, verified media wouldn't appear until some
  // unrelated re-render (a filter change, a vote) happened to trigger one.
  if (spEl && spEl.list) renderList(getFilteredListEntries());
}

async function refreshSightingsPanel() {
  const [freshSightings, freshVoteCounts] = await Promise.all([loadSightings(), loadVoteCounts()]);
  spSightings = freshSightings;
  spVoteCounts = freshVoteCounts;
  renderList(getFilteredListEntries());
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
    toolbarStatNews: document.getElementById("toolbar-stat-news"),
    statNewsMentions: document.getElementById("stat-news-mentions"),
    statNewsCompact: document.getElementById("stat-news-compact"),
    statNewsVerified: document.getElementById("stat-news-verified"),
    statOfficial: document.getElementById("stat-official"),
  };
  if (!spEl.list) return;

  applyCompactStatLabels();

  [spEl.typeFilter, spEl.timeFilter, spEl.photoFilter].forEach((field) => {
    field.addEventListener("change", () => {
      spShownCount = LIST_PAGE_SIZE;
      renderList(getFilteredListEntries());
    });
  });

  if (spEl.exportCsvBtn) spEl.exportCsvBtn.addEventListener("click", downloadSightingsCsv);
}
