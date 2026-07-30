// Translation dictionary and language-switching logic (Latvian + English).
const translations = {
  lv: {
    appTitle: "Lāču Novērojumi Latvijā",
    appSubtitle: "Kopienas veidota lāču novērojumu karte",
    mapHint: "Noklikšķiniet uz kartes, lai pievienotu novērojumu",
    mapHintPicking: "Noklikšķiniet uz kartes vietā, kur redzējāt lāci",
    reportBtn: "Ziņot par novērojumu",
    useLocationBtn: "Izmantot manu atrašanās vietu",
    cancelPicking: "Atcelt",
    geoError: "Neizdevās noteikt jūsu atrašanās vietu. Pārbaudiet pārlūka atļaujas.",
    geoUnsupported: "Jūsu pārlūks neatbalsta atrašanās vietas noteikšanu.",

    formTitleAdd: "Jauns novērojums",
    fieldDate: "Datums",
    fieldType: "Novērojuma veids",
    typeSighting: "Redzēts lācis",
    typeTracks: "Pēdas / pazīmes",
    typeDamage: "Postījumi (mājlopi, bites u.c.)",
    fieldCount: "Lāču skaits",
    fieldDescription: "Apraksts",
    descriptionPlaceholder: "Aprakstiet, ko redzējāt...",
    fieldReporter: "Jūsu vārds (nav obligāts)",
    reporterPlaceholder: "Vārds vai iesauka",
    fieldLocation: "Atrašanās vieta",
    submitBtn: "Saglabāt",
    cancelBtn: "Atcelt",
    requiredError: "Lūdzu, aizpildiet visus obligātos laukus.",

    statsTitle: "Statistika",
    totalLabel: "Kopā novērojumu",
    yearLabel: "Šogad",
    lastLabel: "Pēdējais novērojums",
    noneYet: "Vēl nav",

    chartTitle: "Novērojumi pa mēnešiem",
    chartNoData: "Šogad vēl nav datu",

    listTitle: "Novērojumu saraksts",
    emptyList: "Nav neviena novērojuma. Pievienojiet pirmo!",
    deleteBtn: "Dzēst",
    deleteConfirm: "Vai tiešām dzēst šo novērojumu?",

    exportBtn: "Eksportēt (JSON)",
    importBtn: "Importēt",
    clearAllBtn: "Dzēst visus datus",
    clearAllConfirm: "Vai tiešām dzēst VISUS novērojumus? Šo darbību nevar atsaukt.",
    importSuccess: "Dati veiksmīgi importēti.",
    importError: "Neizdevās nolasīt failu. Pārbaudiet, vai tas ir derīgs eksporta fails.",

    disclaimer: "Šī ir sabiedrības veidota lietotne — dati tiek glabāti tikai jūsu pārlūkā (localStorage) un netiek sūtīti nevienam serverim. Oficiālai ziņošanai par lielo plēsēju novērojumiem sazinieties ar Dabas aizsardzības pārvaldi.",

    monthsShort: ["Jan", "Feb", "Mar", "Apr", "Mai", "Jūn", "Jūl", "Aug", "Sep", "Okt", "Nov", "Dec"],
    bearsUnit: "lācis/-i",
    close: "Aizvērt",

    newsSectionTitle: "Ziņu pieminējumi",
    newsToggleLabel: "Rādīt kartē",
    newsEmpty: "Pagaidām nav neviena ziņu pieminējuma.",
    newsDisclaimer: "Automātiski apkopots ik pēc pāris stundām no publiskiem ziņu portāliem (LSM.lv, Apollo.lv, TVNET) pēc atslēgvārda \"lācis\". Nav pārbaudīts cilvēka — precīza atrašanās vieta nezināma, kartē redzamā atzīme ir tikai tuvākā zināmā pilsēta/novads. Autortiesības uz rakstiem pieder to izdevējiem.",
    newsNewCount: "Jauni pieminējumi: {n}",
  },
  en: {
    appTitle: "Bear Sightings in Latvia",
    appSubtitle: "A community-built bear sighting map",
    mapHint: "Click on the map to add a sighting",
    mapHintPicking: "Click on the map where you saw the bear",
    reportBtn: "Report a sighting",
    useLocationBtn: "Use my current location",
    cancelPicking: "Cancel",
    geoError: "Could not determine your location. Check your browser permissions.",
    geoUnsupported: "Your browser does not support geolocation.",

    formTitleAdd: "New sighting",
    fieldDate: "Date",
    fieldType: "Observation type",
    typeSighting: "Bear seen",
    typeTracks: "Tracks / signs",
    typeDamage: "Damage (livestock, beehives, etc.)",
    fieldCount: "Number of bears",
    fieldDescription: "Description",
    descriptionPlaceholder: "Describe what you saw...",
    fieldReporter: "Your name (optional)",
    reporterPlaceholder: "Name or nickname",
    fieldLocation: "Location",
    submitBtn: "Save",
    cancelBtn: "Cancel",
    requiredError: "Please fill in all required fields.",

    statsTitle: "Statistics",
    totalLabel: "Total sightings",
    yearLabel: "This year",
    lastLabel: "Latest sighting",
    noneYet: "None yet",

    chartTitle: "Sightings by month",
    chartNoData: "No data yet this year",

    listTitle: "Sightings list",
    emptyList: "No sightings yet. Add the first one!",
    deleteBtn: "Delete",
    deleteConfirm: "Really delete this sighting?",

    exportBtn: "Export (JSON)",
    importBtn: "Import",
    clearAllBtn: "Clear all data",
    clearAllConfirm: "Really delete ALL sightings? This cannot be undone.",
    importSuccess: "Data imported successfully.",
    importError: "Could not read the file. Check that it's a valid export file.",

    disclaimer: "This is a community-built app — data lives only in your browser (localStorage) and is never sent to a server. For official large-carnivore reporting, contact Latvia's Nature Conservation Agency (Dabas aizsardzības pārvalde).",

    monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    bearsUnit: "bear(s)",
    close: "Close",

    newsSectionTitle: "News mentions",
    newsToggleLabel: "Show on map",
    newsEmpty: "No news mentions yet.",
    newsDisclaimer: "Automatically collected every couple of hours from public news portals (LSM.lv, Apollo.lv, TVNET) by keyword match on \"bear\". Not human-verified — exact location is unknown, the map pin is only the nearest known town/municipality. Article copyright belongs to the original publishers.",
    newsNewCount: "New mentions: {n}",
  },
};

const I18N_STORAGE_KEY = "lacupedas.lang";

function getLang() {
  return localStorage.getItem(I18N_STORAGE_KEY) || "lv";
}

function setLang(lang) {
  localStorage.setItem(I18N_STORAGE_KEY, lang);
}

function t(key) {
  const lang = getLang();
  return (translations[lang] && translations[lang][key]) || translations.lv[key] || key;
}

function applyTranslations() {
  const lang = getLang();
  document.documentElement.lang = lang;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    el.setAttribute("placeholder", t(key));
  });
  document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-lang-btn") === lang);
  });
}
