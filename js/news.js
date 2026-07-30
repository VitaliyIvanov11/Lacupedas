// Bear-related news mentions, auto-collected from public LV news RSS feeds
// by a scheduled GitHub Action (see scripts/fetch-news.js) into
// data/news.json. This module fetches that file, renders it on the map and
// in a read-only list, and polls periodically so new mentions appear while
// the page stays open — no manual reload needed.

const NEWS_POLL_MS = 10 * 60 * 1000; // 10 minutes

let newsItems = [];
let newsLayer = null;
let newsVisible = true;
let newsMap = null;
let newsSeenIds = new Set();

function newsEscapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function newsIcon() {
  return L.divIcon({
    className: "news-marker",
    html: '<span class="news-marker-diamond"></span>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
}

async function fetchNewsData() {
  try {
    const res = await fetch(`data/news.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return null;
  }
}

function renderNewsMarkers() {
  if (!newsMap) return;
  if (!newsLayer) newsLayer = L.layerGroup();
  newsLayer.clearLayers();
  newsItems
    .filter((n) => n.lat != null && n.lng != null)
    .forEach((n) => {
      const marker = L.marker([n.lat, n.lng], { icon: newsIcon() });
      marker.bindPopup(
        `<a href="${newsEscapeHtml(n.link)}" target="_blank" rel="noopener"><strong>${newsEscapeHtml(n.title)}</strong></a>` +
          `<br><span class="popup-meta">${newsEscapeHtml(n.source)}</span>`
      );
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
  return d.toLocaleDateString(lang === "lv" ? "lv-LV" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function renderNewsList() {
  const list = document.getElementById("news-list");
  if (!list) return;
  list.innerHTML = "";

  if (newsItems.length === 0) {
    const empty = document.createElement("li");
    empty.className = "list-empty";
    empty.textContent = t("newsEmpty");
    list.appendChild(empty);
    return;
  }

  newsItems.forEach((n) => {
    const li = document.createElement("li");
    li.className = "sighting-item news-item";

    const dot = document.createElement("span");
    dot.className = "type-dot";
    dot.style.background = "#4a3aa7";
    li.appendChild(dot);

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
    body.appendChild(top);

    const link = document.createElement("a");
    link.href = n.link;
    link.target = "_blank";
    link.rel = "noopener";
    link.className = "news-link";
    link.textContent = n.title;
    body.appendChild(link);

    li.appendChild(body);
    list.appendChild(li);
  });
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
  const fresh = await fetchNewsData();
  if (fresh === null) return; // fetch failed — keep showing whatever we had

  const isFirstLoad = newsSeenIds.size === 0;
  const freshIds = new Set(fresh.map((n) => n.id));
  const newCount = isFirstLoad ? 0 : fresh.filter((n) => !newsSeenIds.has(n.id)).length;

  newsItems = fresh;
  newsSeenIds = freshIds;

  renderNewsMarkers();
  renderNewsList();
  if (newCount > 0) updateNewsToast(newCount);
}

function initNews(map) {
  newsMap = map;
  const toggle = document.getElementById("news-toggle");
  if (toggle) {
    toggle.addEventListener("change", () => {
      newsVisible = toggle.checked;
      renderNewsMarkers();
    });
  }
  pollNews();
  setInterval(pollNews, NEWS_POLL_MS);
}
