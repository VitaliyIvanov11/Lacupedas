// Bear-related news mentions, auto-collected from public LV news RSS feeds
// by a scheduled GitHub Action (see scripts/fetch-news.js) into
// data/news.json. This module fetches that file, renders it on the map and
// in a read-only list, and polls periodically so new mentions appear while
// the page stays open — no manual reload needed.

const NEWS_POLL_MS = 10 * 60 * 1000; // 10 minutes
const NEWS_PAGE_SIZE = 6;
const NEWS_PAGE_STEP = 10;

let newsItems = [];
let newsLayer = null;
let newsVisible = true;
let newsMap = null;
let newsSeenIds = new Set();
let newsDataChangeCallback = null;
let newsShownCount = NEWS_PAGE_SIZE;
let newsGeneratedAt = null;

// title is { lv, en, ru } — machine-translated at scrape time (see
// buildTitleTranslations() in scripts/fetch-news.js) so the list always
// reads in the visitor's selected language, not whichever language the
// source portal happened to publish in. Falls back gracefully for any
// item saved before that field existed (title as a plain string).
function newsTitleFor(n) {
  if (typeof n.title === "string") return n.title;
  return n.title[getLang()] || n.title.lv || n.title.en || n.title.ru || "";
}

function matchesNewsTimeFilter(iso, filterValue) {
  if (filterValue === "all") return true;
  const d = new Date(iso);
  if (filterValue === "year") return d.getFullYear() === new Date().getFullYear();
  if (filterValue === "30d") return Date.now() - d.getTime() <= 30 * 24 * 60 * 60 * 1000;
  return true;
}

function getFilteredNews() {
  const sourceSelect = document.getElementById("news-source-filter");
  const timeSelect = document.getElementById("news-time-filter");
  const source = sourceSelect ? sourceSelect.value : "all";
  const time = timeSelect ? timeSelect.value : "all";
  return newsItems.filter(
    (n) => (source === "all" || n.source === source) && matchesNewsTimeFilter(n.pubDate, time)
  );
}

function updateSourceFilterOptions() {
  const select = document.getElementById("news-source-filter");
  if (!select) return;
  const current = select.value;
  const sources = [...new Set(newsItems.map((n) => n.source))].sort();
  select.querySelectorAll('option:not([value="all"])').forEach((opt) => opt.remove());
  sources.forEach((source) => {
    const opt = document.createElement("option");
    opt.value = source;
    opt.textContent = source;
    select.appendChild(opt);
  });
  if (sources.includes(current)) select.value = current;
}

function newsEscapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

// verified (see VERIFIED_LINKS in scripts/fetch-news.js) gets a small
// white ring — a human has personally confirmed this specific item's
// place/date match the article, not just that every merged item already
// passed the "is this really a bear story" bar via the PR review.
function newsIcon(verified) {
  return L.divIcon({
    className: "news-marker",
    html: `<span class="news-marker-diamond${verified ? " verified" : ""}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
}

// Mirrors leaflet.markercluster's default iconCreateFunction (same size
// thresholds/markup) but adds a distinguishing class so CSS can give news
// clusters their own indigo color, separate from the sighting clusters'
// brand-green default (see .news-marker-cluster in style.css).
function newsClusterIcon(cluster) {
  const count = cluster.getChildCount();
  let sizeClass = "marker-cluster-small";
  if (count >= 100) sizeClass = "marker-cluster-large";
  else if (count >= 10) sizeClass = "marker-cluster-medium";
  return L.divIcon({
    html: `<div><span>${count}</span></div>`,
    className: "marker-cluster news-marker-cluster " + sizeClass,
    iconSize: L.point(40, 40),
  });
}

async function fetchNewsData() {
  try {
    const res = await fetch(`data/news.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      items: Array.isArray(data.items) ? data.items : [],
      generatedAt: data.generatedAt || null,
    };
  } catch {
    return null;
  }
}

// Surfaces data/news.json's own generatedAt timestamp — the news scanner
// runs on a schedule (see .github/workflows/news-scan.yml) and could go
// silently stale if that Action ever broke, so this is a visible freshness
// signal rather than a silent assumption that "no error" means "up to
// date". No-ops if #news-updated-at isn't on the current page.
function renderNewsUpdatedAt(generatedAt) {
  const el = document.getElementById("news-updated-at");
  if (!el) return;
  if (!generatedAt) {
    el.textContent = "";
    return;
  }
  const d = new Date(generatedAt);
  if (isNaN(d)) {
    el.textContent = "";
    return;
  }
  const lang = getLang();
  const formatted = d.toLocaleString(localeForLang(lang), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  el.textContent = t("newsUpdatedAt").replace("{date}", formatted);
}

function renderNewsMarkers() {
  if (!newsMap) return;
  if (!newsLayer) {
    newsLayer = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: newsClusterIcon,
    });
  }
  newsLayer.clearLayers();
  getFilteredNews()
    .filter((n) => n.lat != null && n.lng != null)
    .forEach((n) => {
      const marker = L.marker([n.lat, n.lng], { icon: newsIcon(n.verified) });
      marker.bindPopup(
        `<a href="${newsEscapeHtml(n.link)}" target="_blank" rel="noopener"><strong>${newsEscapeHtml(newsTitleFor(n))}</strong></a>` +
          `<br><span class="popup-meta">${newsEscapeHtml(n.source)}</span>` +
          `<br><span class="popup-meta popup-approx">${newsEscapeHtml(t("newsApproxLocation"))}</span>` +
          (n.verified ? `<br><span class="popup-meta news-verified-badge">${newsEscapeHtml(t("newsVerifiedBadge"))}</span>` : "")
      );
      marker.on("mouseover", () => marker.openPopup());
      marker.on("mouseout", () => marker.closePopup());
      marker.addTo(newsLayer);
    });
  if (newsVisible) {
    newsLayer.addTo(newsMap);
  } else if (newsMap.hasLayer(newsLayer)) {
    newsMap.removeLayer(newsLayer);
  }
}

function formatNewsDate(iso) {
  const lang = getLang();
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(localeForLang(lang), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function renderNewsList() {
  renderNewsUpdatedAt(newsGeneratedAt);
  const list = document.getElementById("news-list");
  if (!list) return;
  list.innerHTML = "";

  const filtered = getFilteredNews();
  if (filtered.length === 0) {
    const empty = document.createElement("li");
    empty.className = "list-empty";
    empty.textContent = newsItems.length === 0 ? t("newsEmpty") : t("filterNoMatch");
    list.appendChild(empty);
    return;
  }

  filtered.slice(0, newsShownCount).forEach((n) => {
    const li = document.createElement("li");
    li.className = "sighting-item news-item";

    const flagBtn = document.createElement("button");
    flagBtn.type = "button";
    flagBtn.className = "report-issue-btn";
    flagBtn.textContent = "🚩";
    flagBtn.title = t("reportIssueBtnTitle");
    flagBtn.setAttribute("aria-label", t("reportIssueBtnTitle"));
    flagBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openReportIssueModal("news", n.id);
    });
    li.appendChild(flagBtn);

    const body = document.createElement("div");
    body.className = "sighting-body";

    const top = document.createElement("div");
    top.className = "sighting-top";
    const dateSpan = document.createElement("span");
    dateSpan.className = "sighting-date";
    dateSpan.textContent = formatNewsDate(n.pubDate);
    const sourceSpan = document.createElement("span");
    sourceSpan.className = "sighting-type";
    sourceSpan.textContent = n.source + (n.placeName ? " · " + n.placeName : "");
    top.appendChild(dateSpan);
    top.appendChild(sourceSpan);
    // Manually curated (VERIFIED_LINKS in scripts/fetch-news.js) — a human
    // has personally confirmed the place/date genuinely match the article,
    // not just that it's a real bear story (every merged item already
    // passed that bar via the PR review). Most items won't have this.
    if (n.verified) {
      const verifiedBadge = document.createElement("span");
      verifiedBadge.className = "news-verified-badge";
      verifiedBadge.textContent = t("newsVerifiedBadge");
      top.appendChild(verifiedBadge);
    }
    body.appendChild(top);

    const link = document.createElement("a");
    link.href = n.link;
    link.target = "_blank";
    link.rel = "noopener";
    link.className = "news-link";
    link.textContent = newsTitleFor(n);
    body.appendChild(link);

    li.appendChild(body);
    list.appendChild(li);
  });

  if (filtered.length > newsShownCount) {
    const more = document.createElement("li");
    more.className = "list-show-more";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `${t("showMoreBtn")} (+${filtered.length - newsShownCount})`;
    btn.addEventListener("click", () => {
      newsShownCount += NEWS_PAGE_STEP;
      renderNewsList();
    });
    more.appendChild(btn);
    list.appendChild(more);
  }
}

function updateNewsToast(newCount) {
  const toast = document.getElementById("news-toast");
  if (!toast || newCount <= 0) return;
  toast.textContent = t("newsNewCount").replace("{n}", newCount);
  toast.hidden = false;
  clearTimeout(updateNewsToast._timer);
  updateNewsToast._timer = setTimeout(() => {
    toast.hidden = true;
  }, 8000);
}

async function pollNews() {
  const result = await fetchNewsData();
  if (result === null) return; // fetch failed — keep showing whatever we had
  const fresh = result.items;

  const isFirstLoad = newsSeenIds.size === 0;
  const freshIds = new Set(fresh.map((n) => n.id));
  const newCount = isFirstLoad ? 0 : fresh.filter((n) => !newsSeenIds.has(n.id)).length;

  newsItems = fresh;
  newsSeenIds = freshIds;
  newsGeneratedAt = result.generatedAt;

  updateSourceFilterOptions();
  renderNewsUpdatedAt(newsGeneratedAt);
  renderNewsMarkers();
  renderNewsList();
  if (newCount > 0) updateNewsToast(newCount);
  if (newsDataChangeCallback) newsDataChangeCallback(newsItems);
}

function initNews(map, onDataChange) {
  newsMap = map;
  newsDataChangeCallback = onDataChange || null;
  const toggle = document.getElementById("news-toggle");
  if (toggle) {
    toggle.addEventListener("change", () => {
      newsVisible = toggle.checked;
      renderNewsMarkers();
    });
  }
  const sourceFilter = document.getElementById("news-source-filter");
  const timeFilter = document.getElementById("news-time-filter");
  [sourceFilter, timeFilter].forEach((select) => {
    if (select) {
      select.addEventListener("change", () => {
        newsShownCount = NEWS_PAGE_SIZE;
        renderNewsMarkers();
        renderNewsList();
      });
    }
  });
  pollNews();
  setInterval(pollNews, NEWS_POLL_MS);
}
