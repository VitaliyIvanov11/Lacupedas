// Translation dictionary and language-switching logic (Latvian + English).
const translations = {
  lv: {
    appTitle: "Lāču Novērojumi Latvijā",
    appSubtitle: "Kopienas veidota lāču novērojumu karte",
    mapHint: "Noklikšķiniet uz kartes, lai pievienotu novērojumu",
    mapHintPicking: "Noklikšķiniet uz kartes vietā, kur redzējāt lāci",
    reportBtn: "Ziņot par novērojumu",
    useLocationBtn: "Izmantot manu atrašanās vietu",
    heatmapToggleLabel: "🔥 Blīvuma karte",
    cancelPicking: "Atcelt",
    geoError: "Neizdevās noteikt jūsu atrašanās vietu. Pārbaudiet pārlūka atļaujas.",
    geoUnsupported: "Jūsu pārlūks neatbalsta atrašanās vietas noteikšanu.",

    formTitleAdd: "Jauns novērojums",
    fieldDate: "Datums",
    fieldType: "Novērojuma veids",
    typeSighting: "Redzēts lācis",
    typeTracks: "Pēdas / pazīmes",
    typeDamage: "Postījumi (mājlopi, bites u.c.)",
    typeDead: "Atrasts bojāgājis dzīvnieks",
    typeDnaSample: "Savākts DNS paraugs",
    fieldCount: "Lāču skaits",
    fieldDescription: "Apraksts",
    descriptionPlaceholder: "Aprakstiet, ko redzējāt...",
    fieldReporter: "Jūsu vārds (nav obligāts)",
    reporterPlaceholder: "Vārds vai iesauka",
    fieldLocation: "Atrašanās vieta",
    fieldPhoto: "Fotoattēls (nav obligāts)",
    photoTooBig: "Attēls ir pārāk liels (maks. 8 MB pirms saspiešanas).",
    photoInvalidType: "Šis fails nav attēls.",
    photoUploadError: "Neizdevās augšupielādēt fotoattēlu — novērojums tiks saglabāts bez tā.",
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
    submitError: "Neizdevās saglabāt — pārbaudiet interneta savienojumu un mēģiniet vēlreiz.",
    confirmBtn: "Apstiprināt šo novērojumu",
    disputeBtn: "Apšaubīt šo novērojumu",
    voteError: "Neizdevās nosūtīt balsojumu — pārbaudiet interneta savienojumu.",

    filterAllTypes: "Visi veidi",
    filterAllSources: "Visi avoti",
    filterAllTime: "Viss laiks",
    filterThisYear: "Šogad",
    filterLast30d: "Pēdējās 30 dienas",
    filterNoMatch: "Nav ierakstu, kas atbilst filtram.",

    disclaimer: "Šī ir sabiedrības veidota lietotne — novērojumi ir redzami visiem apmeklētājiem, nevis tikai jums. Dzēšana nav pieejama publiski. Oficiālai ziņošanai par lielo plēsēju novērojumiem sazinieties ar Dabas aizsardzības pārvaldi.",

    faqSummary: "Bieži uzdotie jautājumi par lāčiem Latvijā",
    faqQ1: "Kur Latvijā dzīvo lāči?",
    faqA1: "Brūnie lāči Latvijā visbiežāk sastopami Vidzemē (īpaši pierobežā ar Igauniju) un Latgalē, taču pēdējos gados novērojumi arvien biežāk parādās arī citos reģionos, tostarp Kurzemē un Zemgalē. Pētnieki lēš, ka lāču populācija Latvijā turpina pieaugt.",
    faqQ2: "Kā atpazīt lāča pēdas?",
    faqA2: "Lāča pēdas mežā var atpazīt pēc to lielā izmēra un pieciem pirkstu nospiedumiem ar redzamiem nagu iespiedumiem. Ja neesi pārliecināts, vislabāk ir nofotografēt pēdu nospiedumu un pievienot to kā novērojumu šajā kartē.",
    faqQ3: "Vai lācis ir bīstams cilvēkiem?",
    faqA3: "Lāči parasti izvairās no cilvēkiem, un uzbrukumi ir reti. Sastopot lāci, ieteicams saglabāt mieru, nesteigties un lēnām attālināties, neskrienot.",

    monthsShort: ["Jan", "Feb", "Mar", "Apr", "Mai", "Jūn", "Jūl", "Aug", "Sep", "Okt", "Nov", "Dec"],
    bearsUnit: "lācis/-i",
    close: "Aizvērt",

    newsSectionTitle: "Ziņu pieminējumi",
    newsToggleLabel: "Rādīt kartē",
    newsEmpty: "Pagaidām nav neviena ziņu pieminējuma.",
    newsDisclaimer: "Automātiski apkopots ik pēc pāris stundām no publiskiem ziņu portāliem (LSM.lv, Apollo.lv, TVNET, gorod.lv, kodols.lv, kā arī pierobežas ziņas no Igaunijas — ERR.ee — un Lietuvas — 15min.lt) pēc atslēgvārda \"lācis\"/\"karu\"/\"lokys\"/\"медведь\". Papildus reizi pa reizei manuāli pārbaudīti un pievienoti vecāki (līdz 2 gadiem) apstiprināti gadījumi. Nav pārbaudīts cilvēka reāllaikā — precīza atrašanās vieta nezināma, kartē redzamā atzīme ir tikai tuvākā zināmā pilsēta/novads. Autortiesības uz rakstiem pieder to izdevējiem.",
    newsNewCount: "Jauni pieminējumi: {n}",
  },
  en: {
    appTitle: "Bear Sightings in Latvia",
    appSubtitle: "A community-built bear sighting map",
    mapHint: "Click on the map to add a sighting",
    mapHintPicking: "Click on the map where you saw the bear",
    reportBtn: "Report a sighting",
    useLocationBtn: "Use my current location",
    heatmapToggleLabel: "🔥 Density map",
    cancelPicking: "Cancel",
    geoError: "Could not determine your location. Check your browser permissions.",
    geoUnsupported: "Your browser does not support geolocation.",

    formTitleAdd: "New sighting",
    fieldDate: "Date",
    fieldType: "Observation type",
    typeSighting: "Bear seen",
    typeTracks: "Tracks / signs",
    typeDamage: "Damage (livestock, beehives, etc.)",
    typeDead: "Dead animal found",
    typeDnaSample: "DNA sample collected",
    fieldCount: "Number of bears",
    fieldDescription: "Description",
    descriptionPlaceholder: "Describe what you saw...",
    fieldReporter: "Your name (optional)",
    reporterPlaceholder: "Name or nickname",
    fieldLocation: "Location",
    fieldPhoto: "Photo (optional)",
    photoTooBig: "Image is too large (max 8 MB before compression).",
    photoInvalidType: "That file isn't an image.",
    photoUploadError: "Couldn't upload the photo — the sighting will be saved without it.",
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
    submitError: "Couldn't save — check your internet connection and try again.",
    confirmBtn: "Confirm this sighting",
    disputeBtn: "Dispute this sighting",
    voteError: "Couldn't send your vote — check your internet connection.",

    filterAllTypes: "All types",
    filterAllSources: "All sources",
    filterAllTime: "All time",
    filterThisYear: "This year",
    filterLast30d: "Last 30 days",
    filterNoMatch: "No entries match this filter.",

    disclaimer: "This is a community-built app — sightings are visible to every visitor, not just you. Public deletion isn't available. For official large-carnivore reporting, contact Latvia's Nature Conservation Agency (Dabas aizsardzības pārvalde).",

    faqSummary: "Frequently asked questions about bears in Latvia",
    faqQ1: "Where do bears live in Latvia?",
    faqA1: "Brown bears in Latvia are most common in Vidzeme (especially near the Estonian border) and Latgale, but in recent years sightings have increasingly appeared in other regions too, including Kurzeme and Zemgale. Researchers estimate the bear population in Latvia continues to grow.",
    faqQ2: "How do you recognize bear tracks?",
    faqA2: "Bear tracks in the forest can be recognized by their large size and five toe prints with visible claw marks. If you're not sure, it's best to photograph the print and add it as a sighting on this map.",
    faqQ3: "Are bears dangerous to people?",
    faqA3: "Bears generally avoid people, and attacks are rare. If you encounter a bear, it's best to stay calm, not rush, and slowly back away without running.",

    monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    bearsUnit: "bear(s)",
    close: "Close",

    newsSectionTitle: "News mentions",
    newsToggleLabel: "Show on map",
    newsEmpty: "No news mentions yet.",
    newsDisclaimer: "Automatically collected every couple of hours from public news portals (LSM.lv, Apollo.lv, TVNET, gorod.lv, kodols.lv, plus border-area news from Estonia — ERR.ee — and Lithuania — 15min.lt) by keyword match on \"bear\" in each language. Older confirmed cases (up to 2 years back) are occasionally added by hand after manual verification. Not verified by a human in real time — exact location is unknown, the map pin is only the nearest known town/municipality. Article copyright belongs to the original publishers.",
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
