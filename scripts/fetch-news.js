#!/usr/bin/env node
// Fetches a handful of Latvian news RSS feeds, keeps only items that mention
// bears ("lācis"/"lāči" and declensions), best-effort-matches a place name
// mentioned in the text against a small gazetteer, and merges the result
// into data/news.json. Runs on a schedule via .github/workflows/news-scan.yml
// — no dependencies beyond Node's built-in fetch/crypto/fs.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// `lang` pins each feed to the single keyword-form list that should be
// tested against it (see BEAR_KEYWORD_RES_BY_LANG below). This matters
// because the word lists collide across languages: Latvian "karu" (accusative
// of "karš", i.e. "war" — extremely common in Ukraine-war coverage) is
// spelled identically to Estonian "karu" (bear, nominative). Testing every
// feed against every language's word list turned every Latvian war article
// into a false "bear" match once general LV news portals were added.
const FEEDS = [
  { name: "LSM.lv", url: "https://www.lsm.lv/rss/", lang: "lv" },
  { name: "Apollo.lv", url: "https://www.apollo.lv/rss", lang: "lv" },
  { name: "TVNET", url: "https://www.tvnet.lv/rss", lang: "lv" },
  { name: "Delfi.lv", url: "https://www.delfi.lv/rss/index.xml", lang: "lv" },
  { name: "LA.lv", url: "https://www.la.lv/feed", lang: "lv" },
  { name: "Diena.lv", url: "https://diena.lv/rss", lang: "lv" },
  { name: "1188.lv", url: "https://www.1188.lv/rss", lang: "lv" },
  // Estonian and Lithuanian border-area coverage — bears cross borders, and
  // a sighting just over the line is still relevant context near Latvia.
  { name: "ERR.ee", url: "https://www.err.ee/rss", lang: "et" },
  { name: "Postimees.ee", url: "https://www.postimees.ee/rss", lang: "et" },
  { name: "Õhtuleht.ee", url: "https://www.ohtuleht.ee/rss", lang: "et" },
  { name: "15min.lt", url: "https://www.15min.lt/rss/naujienos", lang: "lt" },
  // Delfi.lt has no combined "all news" feed — this is its "Lietuvoje"
  // (general Lithuania/regional) category, the closest match to the other
  // portals' general feeds and the most likely to carry a local animal story.
  { name: "Delfi.lt", url: "https://feed.delfi.lt/v2/articles/7?format=rss", lang: "lt" },
  { name: "LRT.lt", url: "https://www.lrt.lt/?rss", lang: "lt" },
  { name: "Lrytas.lt", url: "https://www.lrytas.lt/rss/", lang: "lt" },
  // Russian-language regional portal (Daugavpils/Latgale) — the only feed
  // that carried the Silene nature-park sighting; LSM/Apollo/TVNET missed it.
  { name: "gorod.lv", url: "https://www.gorod.lv/rss", lang: "ru" },
  // Riga-region portal — caught the Garkalne/Ropaži sighting.
  { name: "kodols.lv", url: "https://kodols.lv/rss.xml", lang: "lv" },
  // Latvijas Mednieku asociācija — hunters are one of the named data
  // sources behind the official population monitoring (see biology.html
  // and advice.html's "Medniekiem" section), and LATMA's own site
  // periodically covers bear population/encounter stories directly.
  { name: "LATMA", url: "https://www.latma.lv/feed/", lang: "lv" },
];

// The site's 3 UI languages — every news title gets a version in each, so
// the list always reads in whatever language the visitor has selected
// instead of showing whatever language the source portal happened to
// publish in (see js/i18n.js's translations object for the same set).
const UI_LANGS = ["lv", "en", "ru"];

// Google Translate's public web-widget endpoint — no API key, no signup,
// good quality (same engine as translate.google.com), but undocumented and
// unsupported: could rate-limit or change shape without notice. Falls back
// to the original text on any failure rather than leaving a title blank.
//
// Source language is always auto-detected rather than taken from the
// feed's declared `lang` — some portals mix languages per-article (e.g.
// gorod.lv is a Russian-language site overall, but several of its bear
// stories turned out to have Latvian titles), so trusting a per-feed
// constant silently mistranslated or skipped those. Auto-detect verified
// safe for the same-language case too: translating LV text with tl=lv
// returns it byte-for-byte unchanged rather than paraphrasing it.
async function translateText(text, targetLang) {
  try {
    const url =
      `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t` +
      `&sl=auto&tl=${encodeURIComponent(targetLang)}` +
      `&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // data[0] is a list of [translatedChunk, originalChunk, ...] pairs —
    // long input can come back split into multiple chunks to rejoin.
    return data[0].map((chunk) => chunk[0]).join("");
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Builds { lv, en, ru }. A small delay between requests is just good
// manners toward a free, unofficial endpoint — this runs in the background
// on a schedule, so there's no reason to hammer it.
async function buildTitleTranslations(text) {
  const titles = {};
  for (const lang of UI_LANGS) {
    const translated = await translateText(text, lang);
    titles[lang] = translated || text;
    await sleep(200);
  }
  return titles;
}

// Whole-word match against every case form of "bear"/"bear cub" in each
// feed's language. A plain substring match on the shared stem is too loose —
// it also fires on unrelated compounds/proper nouns that happen to contain
// it, e.g. Latvian "Lāčusils" (a place name) or "Lāčplēsis" (Latvia's
// national epic hero, extremely common in street names and dates), or
// Lithuanian "lokalus" ("local", contains "lok"). Word-boundary matching
// against explicit forms avoids both.
const BEAR_WORD_FORMS_LV = [
  "lācis", "lāča", "lācim", "lāci", "lāči", "lāču", "lāčiem", "lāčus", "lāčos",
  "lāce", "lāces", "lācei", "lācē", "lācēm", "lācēs",
  "lācēns", "lācēna", "lācēnam", "lācēnu", "lācēnā", "lācēni", "lācēniem", "lācēnus", "lācēnos",
];
// Estonian "karu" (bear) — the noun is indeclinable-looking in nom/gen sg,
// so most case forms are built by suffixing the stem "karu-".
const BEAR_WORD_FORMS_ET = [
  "karu", "karud", "karude", "karusid", "karule", "karule", "karuga", "karus",
  "karust", "karult", "karuks", "karuni", "karuta", "karudele", "karudel",
  "karudelt", "karudeks",
];
// Lithuanian "lokys" (bear) and "lokiukas" (bear cub).
const BEAR_WORD_FORMS_LT = [
  "lokys", "lokio", "lokiui", "lokį", "lokiu", "lokyje", "lokiai", "lokių",
  "lokiams", "lokius", "lokiais", "lokiuose",
  "lokė", "lokės", "lokei", "lokę", "lokja", "lokėje",
  "lokiukas", "lokiuko", "lokiukui", "lokiuką", "lokiuku", "lokiuke",
  "lokiukai", "lokiukų", "lokiukams", "lokiukus", "lokiukais", "lokiukuose",
];
// Russian "медведь" (bear), "медведица" (she-bear), "медвежонок" (bear cub).
const BEAR_WORD_FORMS_RU = [
  "медведь", "медведя", "медведю", "медведем", "медведе",
  "медведи", "медведей", "медведям", "медведями", "медведях",
  "медведица", "медведицы", "медведице", "медведицу", "медведицей", "медведиц", "медведицам", "медведицами", "медведицах",
  "медвежонок", "медвежонка", "медвежонку", "медвежонком", "медвежонке",
  "медвежата", "медвежат", "медвежатам", "медвежатами", "медвежатах",
];

function wordBoundaryRegex(forms, extraLetters) {
  const letters = `a-zA-Z${extraLetters}`;
  return new RegExp(`(?<![${letters}])(?:${forms.join("|")})(?![${letters}])`, "iu");
}

// One regex per language — deliberately NOT combined into a single
// language-agnostic list, so each feed is only tested against the word
// forms of the language it's actually published in (see the `lang` note
// on FEEDS above).
const BEAR_KEYWORD_RE_BY_LANG = {
  lv: wordBoundaryRegex(BEAR_WORD_FORMS_LV, "ĀāČčĒēĢģĪīĶķĻļŅņŠšŪūŽž"),
  et: wordBoundaryRegex(BEAR_WORD_FORMS_ET, "ÕõÄäÖöÜüŠšŽž"),
  lt: wordBoundaryRegex(BEAR_WORD_FORMS_LT, "ĄąČčĘęĖėĮįŠšŲųŪūŽž"),
  ru: wordBoundaryRegex(BEAR_WORD_FORMS_RU, "а-яА-ЯёЁ"),
};

function mentionsBear(text, lang) {
  return BEAR_KEYWORD_RE_BY_LANG[lang].test(text);
}

// Articles that genuinely contain a whole-word bear match but aren't about
// a sighting/encounter at all — a keyword hit alone can't tell "someone saw
// a bear" apart from "a bear was mentioned in passing" (a restaurant review
// name-dropping bears as a scene-setter, a foreign-country story a LV/EE/LT
// portal happened to run, a funding/procurement announcement that recaps an
// old, already-recorded sighting for context, etc.). No practical way to
// catch this class of false positive automatically without real NLP, so
// specific known cases get denylisted here once found. Keyed by article
// link (matches makeId's hashing input) so it survives re-fetches.
const EXCLUDED_LINKS = new Set([
  // Diena.lv restaurant review that opens with a scene-setting line about
  // bears changing mushroom-pickers' habits — not a sighting.
  "https://diena.lv/raksts/sestdiena/pieredze/kukulam-restorans?utm_source=rss&utm_campaign=rss&utm_medium=links",
  // Postimees.ee: "Romania is grappling with a growing bear problem" — a
  // foreign-country story, not about Latvia or its border region.
  "https://pmo.ee/8519851",
  // LA.lv: a research-funding procurement announcement that recaps the
  // already-recorded end-of-May Jēkabpils incident for context — not a new
  // sighting, and wrongly placed a map pin on Jēkabpils for a funding story.
  "https://www.la.lv/ar-lacu-petisanu-nu-iespejams-ari-pavisam-labs-bizness-izsludinats-180-000-eiro-verts-iepirkums",
]);

const MAX_AGE_DAYS = 730; // 2 years — this is a record of confirmed sightings, not just breaking news
const MAX_ITEMS = 150;
const OUTPUT_PATH = path.join(__dirname, "..", "data", "news.json");

// Best-effort place gazetteer: name -> [matchable stem(s), lat, lng].
// Coordinates are approximate town-centre points, not survey-grade — this
// only powers a rough "somewhere near here" map pin, per product decision.
const GAZETTEER = [
  // More specific Riga districts first — matched top-to-bottom, so a named
  // district wins over the generic "Rīga" fallback below it.
  ["Imanta (Rīga)", ["Imant"], 56.9575, 24.0171],
  ["Zvejniekciems", ["Zvejniekciem"], 57.319, 24.417],
  ["Garkalne (Ropažu novads)", ["Garkaln"], 57.0449, 24.3706],
  ["Ropaži", ["Ropaž"], 56.9718, 24.6318],
  ["Rīga", ["Rīg"], 56.9496, 24.1052],
  ["Daugavpils", ["Daugavpil"], 55.8748, 26.5361],
  ["Liepāja", ["Liepāj"], 56.5053, 21.0107],
  ["Jelgava", ["Jelgav"], 56.6511, 23.7214],
  ["Jūrmala", ["Jūrmal"], 56.968, 23.7704],
  ["Ventspils", ["Ventspil"], 57.3894, 21.5606],
  ["Rēzekne", ["Rēzekn"], 56.5099, 27.3328],
  ["Valmiera", ["Valmier"], 57.5377, 25.4257],
  ["Jēkabpils", ["Jēkabpil"], 56.4996, 25.8535],
  ["Silene (daba parks)", ["Silen"], 55.7229, 26.8015],
  ["Ogre", ["Ogr"], 56.8175, 24.6091],
  ["Tukums", ["Tukum"], 56.9678, 23.1544],
  ["Cēsis", ["Cēs"], 57.3119, 25.2748],
  ["Sigulda", ["Sigulda", "Siguldā", "Siguldas"], 57.1536, 24.8598],
  ["Kuldīga", ["Kuldīg"], 56.9682, 21.9622],
  ["Saldus", ["Saldu"], 56.6644, 22.4914],
  ["Talsi", ["Tals"], 57.2439, 22.5883],
  ["Krāslava", ["Krāslav"], 55.895, 27.1707],
  ["Ludza", ["Ludz"], 56.5486, 27.7194],
  ["Balvi", ["Balv"], 57.1314, 27.2634],
  ["Gulbene", ["Gulben"], 57.1783, 26.7539],
  ["Alūksne", ["Alūksn"], 57.4247, 27.0453],
  ["Madona", ["Madon"], 56.8531, 26.2178],
  ["Preiļi", ["Preiļ"], 56.2967, 26.7239],
  ["Aizkraukle", ["Aizkraukl"], 56.6011, 25.2547],
  ["Bauska", ["Baus"], 56.4083, 24.1936],
  ["Dobele", ["Dobel"], 56.6247, 23.2789],
  ["Limbaži", ["Limbaž"], 57.5111, 24.7128],
  ["Smiltene", ["Smilten"], 57.4239, 25.9017],
  ["Valka", ["Valk"], 57.7736, 26.0181],
  ["Līvāni", ["Līvān"], 56.3547, 26.1719],
  ["Viļaka", ["Viļak"], 57.1878, 27.6742],
  ["Zilupe", ["Zilup"], 56.3775, 28.1289],
  ["Kārsava", ["Kārsav"], 56.7811, 27.6789],
  ["Varakļāni", ["Varakļān"], 56.5906, 26.7594],
  ["Viļāni", ["Viļān"], 56.5528, 26.9197],
  ["Rūjiena", ["Rūjien"], 57.9014, 25.3283],
  ["Mazsalaca", ["Mazsalac"], 57.8672, 25.0561],
  ["Salacgrīva", ["Salacgrīv"], 57.7511, 24.3592],
  ["Ērgļi", ["Ērgļ"], 56.8994, 25.6389],
  ["Cesvaine", ["Cesvain"], 56.9686, 26.3125],
  ["Lubāna", ["Lubān"], 56.8981, 26.716],
  ["Priekule", ["Priekul"], 56.4297, 21.5967],
  ["Grobiņa", ["Grobiņ"], 56.5533, 21.1636],
  ["Skrunda", ["Skrund"], 56.6789, 22.0219],
  ["Salaspils", ["Salaspil"], 56.8608, 24.3542],
  ["Saulkrasti", ["Saulkrast"], 57.2597, 24.4183],
  ["Beļava (Gulbenes novads)", ["Beļav"], 57.2542, 26.7705],
  ["Kaplava (Krāslavas novads)", ["Kaplav"], 55.8428, 27.1694],
  ["Vidzeme", ["Vidzem"], 57.2, 25.8],
  ["Latgale", ["Latgal"], 56.4, 27.2],
  ["Kurzeme", ["Kurzem"], 57.0, 21.9],
  ["Zemgale", ["Zemgal"], 56.55, 23.5],

  // Estonian border area (south of Latvia's northern border) — only towns
  // within roughly 50-70km of Latvia, not all of Estonia.
  ["Valga (Igaunija)", ["Valga"], 57.7766, 26.0413],
  ["Võru (Igaunija)", ["Võru"], 57.8375, 27.0224],
  ["Põlva (Igaunija)", ["Põlva"], 58.0552, 27.0578],
  ["Rõuge (Igaunija)", ["Rõuge"], 57.7452, 26.9515],
  ["Pärnu (Igaunija)", ["Pärnu"], 58.3859, 24.4971],

  // Lithuanian border area (north of Latvia's southern border) — only towns
  // within roughly 50-70km of Latvia, not all of Lithuania.
  ["Joniškis (Lietuva)", ["Jonišk"], 56.2378, 23.6142],
  ["Pasvalys (Lietuva)", ["Pasval"], 56.0611, 24.3986],
  ["Biržai (Lietuva)", ["Birž"], 56.2, 24.75],
  ["Rokiškis (Lietuva)", ["Rokišk"], 55.9614, 25.5883],
  ["Zarasai (Lietuva)", ["Zaras"], 55.7292, 26.2453],
  ["Turmantas (Lietuva)", ["Turmant"], 55.6944, 26.4611],
  ["Mažeikiai (Lietuva)", ["Mažeiki"], 56.3115, 22.3453],
  ["Skuodas (Lietuva)", ["Skuod"], 56.2667, 21.5333],
];

function decodeEntities(str) {
  if (!str) return "";
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .trim();
}

function extractTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = block.match(re);
  if (!m) return "";
  let val = m[1].trim();
  const cdata = val.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata) val = cdata[1];
  return decodeEntities(val.replace(/<[^>]+>/g, " ").trim());
}

// Best-effort preview image, tried in this order since feeds vary in how
// (or whether) they attach one: a plain <enclosure>, the Media RSS
// namespace's <media:thumbnail>/<media:content>, or — for feeds with
// neither (LRT.lt, 15min.lt) — the first <img> inside the raw item block
// (usually embedded in the description's HTML). Quote style varies too
// (single vs double), hence the character class instead of a fixed quote.
const IMAGE_URL_PATTERNS = [
  /<enclosure[^>]*\burl=["']([^"']+)["']/i,
  /<media:thumbnail[^>]*\burl=["']([^"']+)["']/i,
  /<media:content[^>]*\burl=["']([^"']+)["']/i,
  /<img[^>]*\bsrc=["']([^"']+)["']/i,
];

function extractImageUrl(block) {
  for (const re of IMAGE_URL_PATTERNS) {
    const m = block.match(re);
    if (m && /^https?:\/\//i.test(m[1])) return decodeEntities(m[1]);
  }
  return null;
}

function parseRss(xml) {
  const items = [];
  const itemBlocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const block of itemBlocks) {
    items.push({
      title: extractTag(block, "title"),
      link: extractTag(block, "link"),
      pubDate: extractTag(block, "pubDate"),
      description: extractTag(block, "description"),
      imageUrl: extractImageUrl(block),
    });
  }
  return items;
}

function findPlace(text) {
  const lower = text.toLowerCase();
  for (const [name, stems, lat, lng] of GAZETTEER) {
    for (const stem of stems) {
      if (lower.includes(stem.toLowerCase())) {
        return { placeName: name, lat, lng };
      }
    }
  }
  return { placeName: null, lat: null, lng: null };
}

function makeId(link) {
  return crypto.createHash("sha1").update(link).digest("hex").slice(0, 16);
}

async function fetchFeed(feed) {
  try {
    const res = await fetch(feed.url, {
      headers: { "User-Agent": "Lacupedas-bear-news-bot/1.0 (+https://github.com/VitaliyIvanov11/Lacupedas)" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.error(`[${feed.name}] HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    return parseRss(xml).map((item) => ({ ...item, source: feed.name, lang: feed.lang }));
  } catch (err) {
    console.error(`[${feed.name}] fetch failed: ${err.message}`);
    return [];
  }
}

function loadExisting() {
  try {
    const raw = fs.readFileSync(OUTPUT_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

async function main() {
  const allItems = (await Promise.all(FEEDS.map(fetchFeed))).flat();

  const matched = allItems
    .filter((item) => !EXCLUDED_LINKS.has(item.link))
    .filter((item) => mentionsBear(item.title, item.lang) || mentionsBear(item.description, item.lang))
    .map((item) => {
      const place = findPlace(item.title + " " + item.description);
      const pubDate = new Date(item.pubDate);
      return {
        id: makeId(item.link),
        title: item.title,
        link: item.link,
        source: item.source,
        pubDate: isNaN(pubDate) ? new Date().toISOString() : pubDate.toISOString(),
        placeName: place.placeName,
        lat: place.lat,
        lng: place.lng,
        imageUrl: item.imageUrl,
      };
    });

  const existing = loadExisting();
  const byId = new Map(existing.map((i) => [i.id, i]));
  for (const item of matched) byId.set(item.id, item);

  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const merged = [...byId.values()]
    .filter((i) => new Date(i.pubDate).getTime() >= cutoff)
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, MAX_ITEMS);

  // Translate once per item, the run it first appears (or, for items saved
  // before this field existed, the next run after this deploy) — title is
  // still a plain string at this point for both cases; already-translated
  // items (title is already a {lv,en,ru} object) are skipped.
  let translatedCount = 0;
  for (const entry of merged) {
    if (typeof entry.title === "string") {
      entry.title = await buildTitleTranslations(entry.title);
      translatedCount++;
    }
  }
  if (translatedCount > 0) {
    console.log(`Translated ${translatedCount} item title(s) into lv/en/ru.`);
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify({ generatedAt: new Date().toISOString(), items: merged }, null, 2) + "\n"
  );

  console.log(`Fetched ${allItems.length} articles across ${FEEDS.length} feeds.`);
  console.log(`${matched.length} matched the bear keyword this run.`);
  console.log(`${merged.length} total items kept (max ${MAX_ITEMS}, ${MAX_AGE_DAYS}-day window).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
