#!/usr/bin/env node
// Fetches a handful of Latvian news RSS feeds, keeps only items that mention
// bears ("lācis"/"lāči" and declensions), best-effort-matches a place name
// mentioned in the text against a small gazetteer, and upserts the result
// into Supabase's public.news table as status='pending' (see docs/
// rls-audit.md's R7) — a human approves/rejects from there via the
// Supabase dashboard, no PR/commit involved. Also regenerates feed.xml
// (the public RSS export) from whatever's currently approved. Runs on a
// schedule via .github/workflows/news-scan.yml — no dependencies beyond
// Node's built-in fetch/crypto/fs.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Same public anon key js/storage.js uses client-side — safe to embed here
// too, since Supabase's security model is RLS, not key secrecy (see
// docs/rls-audit.md's R7). This script can read every news row and write
// a candidate's content, but status/verified aren't in its insert/update
// grant at all — approving or verifying an item is a deliberate human
// action taken directly in the Supabase dashboard, not something this
// automated script can do to itself.
const SUPABASE_URL = "https://rhmtifjbnqpikzdwgrre.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJobXRpZmpibnFwaWt6ZHdncnJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MTE1MDUsImV4cCI6MjEwMDk4NzUwNX0._vnbEOYNu_9q9djS8iqxED-QMAIu1QKCvzWY3GGqCsI";

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
  // Official municipality (novads/valstspilsēta) news feeds — hyperlocal
  // safety notices like "bear with cubs seen near X" often only get
  // published by the municipality itself (its site, or Facebook — but
  // Facebook has no public RSS and scraping it violates its ToS, so it's
  // not a source we can add) and never reach the national portals above.
  // Checked all 42 current municipalities (35 novadi + 7 valstspilsētas)
  // for a working RSS feed on their official site; these 9 are the only
  // ones that had one (most municipal sites simply don't publish RSS at
  // all, a few block automated requests, and a few have broken/expired
  // TLS certificates on their own server — not something a feed URL can
  // work around). Worth periodically re-checking the rest as their sites
  // get redesigned.
  { name: "Ādažu novads", url: "https://www.adazunovads.lv/lv/rss/articles", lang: "lv" },
  { name: "Jelgavas novads", url: "http://www.jelgavasnovads.lv/lv/rss/articles", lang: "lv" },
  { name: "Jūrmala", url: "http://www.jurmala.lv/lv/rss/articles", lang: "lv" },
  { name: "Limbažu novads", url: "http://www.limbazunovads.lv/lv/rss/articles", lang: "lv" },
  { name: "Preiļu novads", url: "http://www.preili.lv/lv/rss/articles", lang: "lv" },
  { name: "Ropažu novads", url: "https://ropazi.lv/lv/rss/articles", lang: "lv" },
  { name: "Rīga", url: "http://www.riga.lv/lv/rss/articles", lang: "lv" },
  // Smiltenes novads — the municipality from the Bilskas pagasts bear
  // warning that prompted adding this whole category.
  { name: "Smiltenes novads", url: "https://www.smiltenesnovads.lv/lv/rss/articles", lang: "lv" },
  { name: "Tukuma novads", url: "http://www.tukums.lv/lv/rss/articles", lang: "lv" },
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

// "Lācis"/"Lāči" is also a common Latvian surname AND a common piece of
// sports-club naming ("Ogres novada Lāči" — an actual youth hockey club,
// caught on an article about the coach's arrest that had nothing to do
// with an animal). Estonian has the surname version too: "Karu" ("bear")
// is also a common Estonian surname (caught on "... Jüri Luik ja kolonel
// Fredi Karu ..." — a named colonel in ERR.ee's Ukraine-war coverage, no
// bear involved). All three are really the same underlying signal: proper
// nouns don't follow normal capitalization rules for a common noun.
// Latvian and Estonian never capitalize an ordinary common noun
// mid-sentence — only at the very start of a sentence/headline — so a
// capitalized bear-word-form with *any* word directly before it (whatever
// that word's own case) is either a personal name ("Jānis Lācis", "Fredi
// Karu"), an organization/team name ("novada Lāči"), or a headline-style
// attribution right after it ("Lācis: ..."). A lowercase match mid-
// sentence is unambiguous — always the animal — and a capitalized match
// with *nothing* before it (true sentence/headline start, e.g. "Lācis
// iznācis pie ...") is left alone, which is what keeps this from
// swallowing genuine headlines.
const PROPER_NOUN_COLLISION_FORMS_BY_LANG = {
  lv: ["Lācis", "Lāča", "Lācim", "Lāci", "Lāči", "Lāču", "Lāce", "Lāces", "Lācei", "Lācē"],
  // Case forms an Estonian surname would actually appear in running text —
  // not the full BEAR_WORD_FORMS_ET list, which also includes plural/object
  // forms ("karud", "karusid", ...) a surname wouldn't take.
  et: ["Karu", "Karul", "Karule", "Karult", "Karuga", "Karus", "Karuks"],
};

const PROPER_NOUN_COLLISION_RE_BY_LANG = Object.fromEntries(
  Object.entries(PROPER_NOUN_COLLISION_FORMS_BY_LANG).map(([lang, forms]) => {
    const alt = forms.join("|");
    return [lang, new RegExp(`\\p{L}+\\s+(${alt})\\b|\\b(${alt})\\s*:`, "u")];
  })
);

function looksLikeProperNounCollision(item) {
  const re = PROPER_NOUN_COLLISION_RE_BY_LANG[item.lang];
  if (!re) return false;
  return re.test(item.title) || re.test(item.description);
}

// "Lāči" is also a real, well-known Latvian bread/bakery brand (laci.lv,
// founded 1993 — "Unikālākais zīmols Latvijā" 2009) that can lead a
// sentence as its own subject ("Lāči prezentē jauno klāstu ...") with no
// word before it at all — the proper-noun-collision check above requires
// a preceding word, so this specific case would slip past it. A genuine
// bear-sighting article essentially never discusses bread, so this is a
// clean, low-risk companion check rather than a broad topic denylist.
function looksLikeBreadBrand(item) {
  if (item.lang !== "lv") return false;
  const text = `${item.title} ${item.description}`.toLowerCase();
  return /\blāč/.test(text) && /\bmaiz/.test(text);
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
  // LSM.lv sports piece about athletics coach *Lācis* — the surname
  // collision (see looksLikeProperNounCollision() above), kept here too
  // as a guaranteed removal of this specific already-cached item
  // regardless of how the general heuristic evolves.
  "https://www.lsm.lv/raksts/sports/vieglatletika/03.08.2026-treneris-lacis-finals-minimalakais-sprintera-gravas-merkis-eiropas-cempionata.a657261/?utm_source=rss&utm_campaign=rss&utm_medium=links",
  // ERR.ee: "... Jüri Luik ja kolonel Fredi Karu ..." — Estonian surname
  // collision (colonel named Karu, not a bear), same shape as the LSM.lv
  // entry above but for "Karu" instead of "Lācis".
  "https://www.err.ee/1610101585/ukraina-stuudios-kell-21-35-juri-luik-ja-kolonel-fredi-karu",
  // LSM.lv: an article about a hockey coach's arrest on child sexual abuse
  // allegations — matched only because the description names his club,
  // "Ogres novada Lāči" ("Ogre district Bears"), a real youth hockey club.
  // Organization-name collision, not a surname, but the same underlying
  // proper-noun-capitalization signal (see looksLikeProperNounCollision()
  // above) — kept here too given how sensitive the actual subject matter
  // is, regardless of how the general heuristic evolves.
  "https://www.lsm.lv/raksts/zinas/latvija/04.08.2026-aiztur-hokeja-treneri-par-seksuala-rakstura-darbibam-pret-mazgadigo-aicina-atsaukties-iespejamos-cietusos.a657389/?utm_source=rss&utm_campaign=rss&utm_medium=links",
  // LSM.lv: a Latvian Puppet Theatre season announcement — matched only
  // because one of the listed children's shows is presumably bear-themed.
  // Not a sighting; caught sitting in the pending review PR before merge.
  "https://www.lsm.lv/raksts/kultura/teatris-un-deja/04.08.2026-iepazisti-latvijas-lellu-teatra-83-sezonu-izrades-pasiem-mazakajiem-ziemassvetkiem-un-jauniesiem.a657439/?utm_source=rss&utm_campaign=rss&utm_medium=links",
]);

const FEED_PATH = path.join(__dirname, "..", "feed.xml");
const FEED_ITEM_LIMIT = 50;
const NEWS_TABLE = `${SUPABASE_URL}/rest/v1/news`;
const NEWS_META_TABLE = `${SUPABASE_URL}/rest/v1/news_meta`;

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

function parseRss(xml) {
  const items = [];
  const itemBlocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const block of itemBlocks) {
    items.push({
      title: extractTag(block, "title"),
      link: extractTag(block, "link"),
      pubDate: extractTag(block, "pubDate"),
      description: extractTag(block, "description"),
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

// A Baltic-language portal reporting on a bear story doesn't mean the bear
// was in the Baltics — e.g. an Estonian outlet covering a Swedish attack.
// GAZETTEER above only contains Latvian/border place names, so it can never
// place a pin inside e.g. Sweden — but it COULD wrongly latch onto a
// coincidental substring match (a stem like "krievij"/"soom" is short) in an
// article that is actually about one of these countries. Checked first, per
// the article's own language, and wins over any gazetteer match: naming one
// of these countries is a much stronger location signal than a short stem
// coincidence. Not an exhaustive list of every country bears live in —
// covers the ones that actually turn up in Baltic bear-news coverage today;
// extend as new cases are found, same spirit as EXCLUDED_LINKS above.
const FOREIGN_COUNTRIES = [
  {
    code: "SE",
    name: { lv: "Zviedrija", en: "Sweden", ru: "Швеция" },
    markers: { lv: ["zviedrij"], et: ["rootsi"], lt: ["švedij"], ru: ["швеци"] },
  },
  {
    code: "NO",
    name: { lv: "Norvēģija", en: "Norway", ru: "Норвегия" },
    markers: { lv: ["norvēģij"], et: ["norra"], lt: ["norvegij"], ru: ["норвег"] },
  },
  {
    code: "FI",
    name: { lv: "Somija", en: "Finland", ru: "Финляндия" },
    markers: { lv: ["somij"], et: ["soome"], lt: ["suomij"], ru: ["финлянди"] },
  },
  {
    code: "RU",
    name: { lv: "Krievija", en: "Russia", ru: "Россия" },
    markers: { lv: ["krievij"], et: ["venemaa"], lt: ["rusij"], ru: ["росси"] },
  },
  {
    code: "BY",
    name: { lv: "Baltkrievija", en: "Belarus", ru: "Беларусь" },
    markers: { lv: ["baltkrievij"], et: ["valgevene"], lt: ["baltarusij"], ru: ["беларус"] },
  },
  {
    code: "PL",
    name: { lv: "Polija", en: "Poland", ru: "Польша" },
    markers: { lv: ["polij"], et: ["poola"], lt: ["lenkij"], ru: ["польш"] },
  },
  {
    code: "DE",
    name: { lv: "Vācija", en: "Germany", ru: "Германия" },
    markers: { lv: ["vācij"], et: ["saksamaa"], lt: ["vokietij"], ru: ["герман"] },
  },
  {
    code: "RO",
    name: { lv: "Rumānija", en: "Romania", ru: "Румыния" },
    markers: { lv: ["rumānij"], et: ["rumeenia"], lt: ["rumunij"], ru: ["румыни"] },
  },
  {
    code: "SK",
    name: { lv: "Slovākija", en: "Slovakia", ru: "Словакия" },
    markers: { lv: ["slovākij"], et: ["slovakkia"], lt: ["slovakij"], ru: ["словaki"] },
  },
];

function findForeignCountry(text, lang) {
  const lower = text.toLowerCase();
  for (const country of FOREIGN_COUNTRIES) {
    const stems = country.markers[lang];
    if (!stems) continue;
    for (const stem of stems) {
      if (lower.includes(stem.toLowerCase())) return country;
    }
  }
  return null;
}

// Same shape/purpose as FOREIGN_COUNTRIES, but for Estonia/Lithuania
// specifically — GAZETTEER only recognizes named border TOWNS (Valga,
// Võru, ...), not the country names themselves, so a story that says
// "Igaunija"/"Eesti" without happening to also name one of those specific
// towns fell through to the "LV" default (e.g. "Igaunija atļauj nomedīt
// divus lāčus ..." on a Latvian portal, about a bear in Estonia with no
// town named at all). Checked as a fallback after findPlace() below, not
// instead of it — a specific town match is more precise than "somewhere
// in Estonia" and should still win when both are present.
const BORDER_COUNTRIES = [
  { code: "EE", name: null, markers: { lv: ["igaunij"], et: ["eesti"], lt: ["estij"], ru: ["эстони"] } },
  { code: "LT", name: null, markers: { lv: ["lietuv"], et: ["leedu"], lt: [], ru: ["литв"] } },
];

function findBorderCountry(text, lang) {
  const lower = text.toLowerCase();
  for (const country of BORDER_COUNTRIES) {
    const stems = country.markers[lang];
    if (!stems) continue;
    for (const stem of stems) {
      if (lower.includes(stem.toLowerCase())) return country;
    }
  }
  return null;
}

// Single entry point tying findForeignCountry(), findPlace() and
// findBorderCountry() together: eventCountry is the country the SIGHTING
// happened in, not the country the portal publishes from — "LV" is the
// default (matches today's implicit assumption for untagged text), "EE"/
// "LT" come either from GAZETTEER's border-town entries (their names
// already end in "(Igaunija)"/"(Lietuva)") or, failing that, from the
// country's own name appearing in the text (BORDER_COUNTRIES above). A
// FOREIGN_COUNTRIES match short-circuits both placeName and lat/lng to
// null so a coincidental stem match can never plant a pin on the Latvia
// map for a story that isn't about Latvia at all — the same null-pin
// treatment applies to a BORDER_COUNTRIES-only match, since "somewhere in
// Estonia" isn't a real coordinate either; it still counts as "local" for
// the front end (see isForeignNews() in js/news.js), just without a pin.
function classifyLocation(text, lang) {
  const foreign = findForeignCountry(text, lang);
  if (foreign) {
    return { placeName: null, lat: null, lng: null, eventCountry: foreign.code, eventCountryName: foreign.name };
  }
  const place = findPlace(text);
  if (place.placeName && place.placeName.endsWith("(Igaunija)")) {
    return { ...place, eventCountry: "EE", eventCountryName: null };
  }
  if (place.placeName && place.placeName.endsWith("(Lietuva)")) {
    return { ...place, eventCountry: "LT", eventCountryName: null };
  }
  const border = findBorderCountry(text, lang);
  if (border) {
    return { placeName: null, lat: null, lng: null, eventCountry: border.code, eventCountryName: null };
  }
  return { ...place, eventCountry: "LV", eventCountryName: null };
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

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Standard RSS 2.0, so any RSS-to-email service (Blogtrottr, etc.) can turn
// this into an email digest without this project needing to run its own
// email infrastructure. Titles are LV — the feed itself has no per-visitor
// language selection the way the site does.
function buildRssFeed(items) {
  const itemsXml = items
    .slice(0, FEED_ITEM_LIMIT)
    .map((item) => {
      const title = (item.title && item.title.lv) || item.title || "";
      return `  <item>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(item.link)}</link>
    <guid isPermaLink="false">${escapeXml(item.id)}</guid>
    <pubDate>${new Date(item.pubDate).toUTCString()}</pubDate>
    <source>${escapeXml(item.source)}</source>
  </item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Lacupedas — lāču ziņu pieminējumi Latvijā</title>
  <link>https://lacupedas.lv/</link>
  <description>Automātiski savākti ziņu portālu raksti, kuros pieminēti lāču novērojumi Latvijā un pierobežā.</description>
  <language>lv</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${itemsXml}
</channel>
</rss>
`;
}

// Reads every existing row regardless of status (see docs/rls-audit.md's
// R7 — the anon key can SELECT any row, only writing status/verified is
// restricted) so a still-in-window RSS item that's already pending or
// already approved from an earlier run doesn't get machine-translated
// again on every re-scan, and so the email step below can tell "genuinely
// new this run" apart from "still sitting there, unchanged."
async function loadExistingNews() {
  try {
    const res = await fetch(`${NEWS_TABLE}?select=id,title`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error(`[news] load existing HTTP ${res.status}`);
      return new Map();
    }
    const rows = await res.json();
    return new Map(rows.map((r) => [r.id, r]));
  } catch (err) {
    console.error(`[news] load existing failed: ${err.message}`);
    return new Map();
  }
}

// Column-scoped by the R7 grant to exactly what a scan run can legitimately
// produce — status/verified are never in this payload, so ON CONFLICT DO
// UPDATE can't touch them even by accident; they stay whatever a human
// last set them to via the dashboard.
async function upsertNews(rows) {
  if (rows.length === 0) return true;
  try {
    const res = await fetch(`${NEWS_TABLE}?on_conflict=id`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(rows),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.error(`[news] upsert HTTP ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[news] upsert failed: ${err.message}`);
    return false;
  }
}

// feed.xml (the public RSS export) is rebuilt from only the approved rows
// every run, so it only ever reflects what a human has actually published
// — same guarantee the old PR-merge gate gave data/news.json.
async function loadApprovedNews() {
  try {
    const res = await fetch(`${NEWS_TABLE}?select=*&status=eq.approved&order=pub_date.desc`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error(`[news] load approved HTTP ${res.status}`);
      return [];
    }
    const rows = await res.json();
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      link: row.link,
      source: row.source,
      pubDate: row.pub_date,
    }));
  } catch (err) {
    console.error(`[news] load approved failed: ${err.message}`);
    return [];
  }
}

// Single-row table (id is always literal `true`) — this is the freshness
// signal js/news.js's #news-updated-at reads, replacing data/news.json's
// old generatedAt field now that there's no longer a file with a mtime.
async function touchScanFreshness() {
  try {
    const res = await fetch(`${NEWS_META_TABLE}?on_conflict=id`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ id: true, last_scan_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) console.error(`[news_meta] update HTTP ${res.status}`);
  } catch (err) {
    console.error(`[news_meta] update failed: ${err.message}`);
  }
}

async function main() {
  const allItems = (await Promise.all(FEEDS.map(fetchFeed))).flat();

  const matched = allItems
    .filter((item) => !EXCLUDED_LINKS.has(item.link))
    .filter((item) => mentionsBear(item.title, item.lang) || mentionsBear(item.description, item.lang))
    .filter((item) => !looksLikeProperNounCollision(item))
    .filter((item) => !looksLikeBreadBrand(item))
    .map((item) => {
      const loc = classifyLocation(item.title + " " + item.description, item.lang);
      const pubDate = new Date(item.pubDate);
      return {
        id: makeId(item.link),
        title: item.title,
        link: item.link,
        source: item.source,
        pubDate: isNaN(pubDate) ? new Date().toISOString() : pubDate.toISOString(),
        placeName: loc.placeName,
        lat: loc.lat,
        lng: loc.lng,
        eventCountry: loc.eventCountry,
        eventCountryName: loc.eventCountryName,
      };
    });

  const existing = await loadExistingNews();
  const newCount = matched.filter((item) => !existing.has(item.id)).length;

  let translatedCount = 0;
  for (const item of matched) {
    const already = existing.get(item.id);
    if (already) {
      item.title = already.title;
    } else {
      item.title = await buildTitleTranslations(item.title);
      translatedCount++;
    }
  }
  if (translatedCount > 0) {
    console.log(`Translated ${translatedCount} item title(s) into lv/en/ru.`);
  }

  const rows = matched.map((item) => ({
    id: item.id,
    title: item.title,
    link: item.link,
    source: item.source,
    pub_date: item.pubDate,
    place_name: item.placeName,
    lat: item.lat,
    lng: item.lng,
    event_country: item.eventCountry,
    event_country_name: item.eventCountryName,
  }));
  const upserted = await upsertNews(rows);
  await touchScanFreshness();

  const approved = await loadApprovedNews();
  fs.writeFileSync(FEED_PATH, buildRssFeed(approved));

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_count=${newCount}\n`);
  }

  console.log(`Fetched ${allItems.length} articles across ${FEEDS.length} feeds.`);
  console.log(`${matched.length} matched the bear keyword this run (upsert ${upserted ? "ok" : "FAILED"}).`);
  console.log(`${newCount} new candidate(s) this run; ${approved.length} approved item(s) total.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
