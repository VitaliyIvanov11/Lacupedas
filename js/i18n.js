// Translation dictionary and language-switching logic (Latvian + English).
const translations = {
  lv: {
    appTitle: "Lāču Novērojumi Latvijā",
    appSubtitle: "Kopienas veidota lāču novērojumu karte",
    mapHint: "Noklikšķiniet uz kartes, lai pievienotu novērojumu",
    mapHintPicking: "Noklikšķiniet uz kartes vietā, kur redzējāt lāci",
    mapWakeHint: "Pieskarieties kartei, lai to varētu pārvietot un tuvināt",
    guideNavLink: "Padomi",
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

    guideTitle: "Ko darīt, ja satiec lāci?",
    guideSubtitle: "Praktiski padomi, balstīti uz Dabas aizsardzības pārvaldes ieteikumiem",
    guideBackToMap: "← Atpakaļ uz karti",
    guideCityTitle: "🏘️ Ja lācis apdzīvotā vietā",
    guideCityLead: "Ziņas par lāčiem pilsētās un ciemos kļūst arvien biežākas. Mazāks stress dzīvniekam nozīmē lielāku iespēju, ka tas pats aties prom.",
    guideDoTitle: "✓ Dari",
    guideDontTitle: "✕ Nedari",
    guideCityDo1: "Saglabā mieru un ievēro distanci",
    guideCityDo2: "Paziņo pašvaldībai un Dabas aizsardzības pārvaldei",
    guideCityDo3: "Ļauj dzīvniekam pašam atrast ceļu prom, netraucējot",
    guideCityDont1: "Negriez lāci ar automašīnu vai netrokšņo ar signālragu",
    guideCityDont2: "Nelaid virsū suņus un neskrien lācim pakaļ",
    guideCityDont3: "Nebloķē tā ceļu un neej tam tuvāk, lai nofotografētu",
    guideForestTitle: "🌲 Ja lācis mežā",
    guideForestLead: "Lāči parasti izvairās no cilvēkiem, taču var reaģēt aizsardzības nolūkā, ja pārsteigti pēkšņi — īpaši mātīte ar mazuļiem.",
    guideForestDo1: "Runā klusā, mierīgā balsī, lai lācis tevi pamana",
    guideForestDo2: "Lēnām atkāpies, negriežot muguru un neizzūdot no lāča redzesloka",
    guideForestDo3: "Ja lācis tuvojas — izliecies lielāks, paceļ rokas, radi troksni (piemēram, sitot metāla priekšmetus)",
    guideForestDont1: "Neskrien — tas var izraisīt vajāšanas instinktu",
    guideForestDont2: "Neuztur tiešu acu kontaktu",
    guideForestDont3: "Nekad nebaro lāci un neatstāj pārtiku vai atkritumus mežā",
    guideReportTitle: "📍 Kur ziņot par novērojumu",
    guideReportHere: "Šajā kartē — poga \"Ziņot par novērojumu\" augšpusē (redzams visiem apmeklētājiem)",
    guideReportDabasdati: "Dabasdati.lv — oficiālais dabas novērojumu portāls, ko uztur Dabas aizsardzības pārvalde",
    guideReportDap: "Dabas aizsardzības pārvalde — oficiālā iestāde, kas atbild par aizsargājamām sugām Latvijā",
    guideReportNote: "Šī karte ir sabiedrības uzturēta un nav oficiāls valsts reģistrs — nopietniem gadījumiem (dzīvnieks apdzīvotā vietā, konflikts ar cilvēku) vienmēr ziņo arī tieši Dabas aizsardzības pārvaldei.",
    guideSourceNote: "Šī lapa balstīta uz Dabas aizsardzības pārvaldes publiski pieejamiem ieteikumiem un LVMI Silava pētījumu \"Lāču monitorings 2023–2025\".",

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
    mapWakeHint: "Tap the map to pan and zoom",
    guideNavLink: "Guide",
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

    guideTitle: "What to do if you meet a bear",
    guideSubtitle: "Practical advice based on Nature Conservation Agency recommendations",
    guideBackToMap: "← Back to the map",
    guideCityTitle: "🏘️ If the bear is in a populated area",
    guideCityLead: "Reports of bears in towns and villages are becoming more common. Less stress on the animal means a better chance it moves on by itself.",
    guideDoTitle: "✓ Do",
    guideDontTitle: "✕ Don't",
    guideCityDo1: "Stay calm and keep your distance",
    guideCityDo2: "Notify the local municipality and the Nature Conservation Agency",
    guideCityDo3: "Let the animal find its own way out, without disturbing it",
    guideCityDont1: "Don't chase the bear with a car or blast your horn at it",
    guideCityDont2: "Don't set dogs on it or run after it",
    guideCityDont3: "Don't block its path or approach to take photos",
    guideForestTitle: "🌲 If the bear is in the forest",
    guideForestLead: "Bears generally avoid people, but may react defensively if startled suddenly — especially a mother with cubs.",
    guideForestDo1: "Speak in a calm, quiet voice so the bear notices you",
    guideForestDo2: "Back away slowly without turning your back or losing sight of the bear",
    guideForestDo3: "If it approaches — make yourself look bigger, raise your arms, make noise (e.g. banging metal objects)",
    guideForestDont1: "Don't run — it can trigger a chase instinct",
    guideForestDont2: "Don't maintain direct eye contact",
    guideForestDont3: "Never feed a bear, and don't leave food or trash in the forest",
    guideReportTitle: "📍 Where to report a sighting",
    guideReportHere: "On this map — the \"Report a sighting\" button at the top (visible to every visitor)",
    guideReportDabasdati: "Dabasdati.lv — the official nature-observation portal maintained by the Nature Conservation Agency",
    guideReportDap: "Nature Conservation Agency (Dabas aizsardzības pārvalde) — the official body responsible for protected species in Latvia",
    guideReportNote: "This map is community-maintained and not an official state register — for serious cases (an animal in a populated area, a conflict with a person) always also report directly to the Nature Conservation Agency.",
    guideSourceNote: "This page is based on publicly available recommendations from the Nature Conservation Agency and the LVMI Silava research project \"Bear Monitoring 2023–2025\".",

    monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    bearsUnit: "bear(s)",
    close: "Close",

    newsSectionTitle: "News mentions",
    newsToggleLabel: "Show on map",
    newsEmpty: "No news mentions yet.",
    newsDisclaimer: "Automatically collected every couple of hours from public news portals (LSM.lv, Apollo.lv, TVNET, gorod.lv, kodols.lv, plus border-area news from Estonia — ERR.ee — and Lithuania — 15min.lt) by keyword match on \"bear\" in each language. Older confirmed cases (up to 2 years back) are occasionally added by hand after manual verification. Not verified by a human in real time — exact location is unknown, the map pin is only the nearest known town/municipality. Article copyright belongs to the original publishers.",
    newsNewCount: "New mentions: {n}",
  },
  ru: {
    appTitle: "Наблюдения медведей в Латвии",
    appSubtitle: "Карта наблюдений медведей, созданная сообществом",
    mapHint: "Нажмите на карту, чтобы добавить наблюдение",
    mapHintPicking: "Нажмите на карту в месте, где вы видели медведя",
    mapWakeHint: "Коснитесь карты, чтобы перемещать и масштабировать",
    guideNavLink: "Советы",
    reportBtn: "Сообщить о наблюдении",
    useLocationBtn: "Использовать моё текущее местоположение",
    heatmapToggleLabel: "🔥 Карта плотности",
    cancelPicking: "Отмена",
    geoError: "Не удалось определить ваше местоположение. Проверьте разрешения браузера.",
    geoUnsupported: "Ваш браузер не поддерживает определение местоположения.",

    formTitleAdd: "Новое наблюдение",
    fieldDate: "Дата",
    fieldType: "Тип наблюдения",
    typeSighting: "Замечен медведь",
    typeTracks: "Следы / признаки",
    typeDamage: "Ущерб (скот, пасеки и т.д.)",
    typeDead: "Найдено погибшее животное",
    typeDnaSample: "Собран образец ДНК",
    fieldCount: "Количество медведей",
    fieldDescription: "Описание",
    descriptionPlaceholder: "Опишите, что вы видели...",
    fieldReporter: "Ваше имя (необязательно)",
    reporterPlaceholder: "Имя или псевдоним",
    fieldLocation: "Местоположение",
    fieldPhoto: "Фотография (необязательно)",
    photoTooBig: "Изображение слишком большое (макс. 8 МБ до сжатия).",
    photoInvalidType: "Этот файл не является изображением.",
    photoUploadError: "Не удалось загрузить фото — наблюдение будет сохранено без него.",
    submitBtn: "Сохранить",
    cancelBtn: "Отмена",
    requiredError: "Пожалуйста, заполните все обязательные поля.",

    statsTitle: "Статистика",
    totalLabel: "Всего наблюдений",
    yearLabel: "В этом году",
    lastLabel: "Последнее наблюдение",
    noneYet: "Пока нет",

    chartTitle: "Наблюдения по месяцам",
    chartNoData: "В этом году пока нет данных",

    listTitle: "Список наблюдений",
    emptyList: "Пока нет наблюдений. Добавьте первое!",
    submitError: "Не удалось сохранить — проверьте интернет-соединение и попробуйте снова.",
    confirmBtn: "Подтвердить это наблюдение",
    disputeBtn: "Оспорить это наблюдение",
    voteError: "Не удалось отправить голос — проверьте интернет-соединение.",

    filterAllTypes: "Все типы",
    filterAllSources: "Все источники",
    filterAllTime: "Всё время",
    filterThisYear: "В этом году",
    filterLast30d: "Последние 30 дней",
    filterNoMatch: "Нет записей, соответствующих фильтру.",

    disclaimer: "Это приложение создано сообществом — наблюдения видны всем посетителям, а не только вам. Публичное удаление недоступно. Для официального сообщения о встречах с крупными хищниками обращайтесь в Dabas aizsardzības pārvalde (Управление охраны природы Латвии).",

    faqSummary: "Часто задаваемые вопросы о медведях в Латвии",
    faqQ1: "Где в Латвии живут медведи?",
    faqA1: "Бурые медведи в Латвии чаще всего встречаются в Видземе (особенно у границы с Эстонией) и Латгалии, но в последние годы наблюдения всё чаще появляются и в других регионах, включая Курземе и Земгале. Исследователи считают, что популяция медведей в Латвии продолжает расти.",
    faqQ2: "Как распознать следы медведя?",
    faqA2: "Следы медведя в лесу можно узнать по их крупному размеру и отпечаткам пяти пальцев с видимыми следами когтей. Если вы не уверены, лучше всего сфотографировать отпечаток и добавить его как наблюдение на этой карте.",
    faqQ3: "Опасен ли медведь для человека?",
    faqA3: "Медведи обычно избегают людей, нападения редки. При встрече с медведем рекомендуется сохранять спокойствие, не спешить и медленно отступать, не убегая.",

    guideTitle: "Что делать при встрече с медведем",
    guideSubtitle: "Практические советы на основе рекомендаций Управления охраны природы",
    guideBackToMap: "← Назад к карте",
    guideCityTitle: "🏘️ Если медведь в населённом пункте",
    guideCityLead: "Сообщения о медведях в городах и посёлках становятся всё чаще. Чем меньше стресса у животного, тем больше шанс, что оно уйдёт само.",
    guideDoTitle: "✓ Делайте",
    guideDontTitle: "✕ Не делайте",
    guideCityDo1: "Сохраняйте спокойствие и держите дистанцию",
    guideCityDo2: "Сообщите в самоуправление и Управление охраны природы",
    guideCityDo3: "Дайте животному самому найти путь прочь, не мешая ему",
    guideCityDont1: "Не гоняйте медведя на машине и не сигнальте громко",
    guideCityDont2: "Не спускайте на него собак и не бегите следом",
    guideCityDont3: "Не перекрывайте ему путь и не подходите ближе ради фото",
    guideForestTitle: "🌲 Если медведь в лесу",
    guideForestLead: "Медведи обычно избегают людей, но могут отреагировать защитно при внезапной неожиданной встрече — особенно самка с медвежатами.",
    guideForestDo1: "Говорите спокойным, тихим голосом, чтобы медведь вас заметил",
    guideForestDo2: "Медленно отступайте, не поворачиваясь спиной и не теряя медведя из виду",
    guideForestDo3: "Если он приближается — станьте визуально больше, поднимите руки, создайте шум (например, стуча металлическими предметами)",
    guideForestDont1: "Не бегите — это может вызвать инстинкт погони",
    guideForestDont2: "Не смотрите прямо в глаза",
    guideForestDont3: "Никогда не кормите медведя и не оставляйте еду или мусор в лесу",
    guideReportTitle: "📍 Куда сообщить о наблюдении",
    guideReportHere: "На этой карте — кнопка «Сообщить о наблюдении» вверху (видно всем посетителям)",
    guideReportDabasdati: "Dabasdati.lv — официальный портал наблюдений за природой, который ведёт Управление охраны природы",
    guideReportDap: "Dabas aizsardzības pārvalde (Управление охраны природы) — официальный орган, отвечающий за охраняемые виды в Латвии",
    guideReportNote: "Эта карта поддерживается сообществом и не является официальным государственным реестром — о серьёзных случаях (животное в населённом пункте, конфликт с человеком) всегда сообщайте также напрямую в Управление охраны природы.",
    guideSourceNote: "Эта страница основана на общедоступных рекомендациях Управления охраны природы и исследовательском проекте LVMI Silava «Мониторинг медведей 2023–2025».",

    monthsShort: ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"],
    bearsUnit: "медведь(-ей)",
    close: "Закрыть",

    newsSectionTitle: "Упоминания в новостях",
    newsToggleLabel: "Показать на карте",
    newsEmpty: "Пока нет упоминаний в новостях.",
    newsDisclaimer: "Автоматически собирается каждые несколько часов из публичных новостных порталов (LSM.lv, Apollo.lv, TVNET, gorod.lv, kodols.lv), а также приграничные новости из Эстонии (ERR.ee) и Литвы (15min.lt) по ключевым словам «lācis»/«karu»/«lokys»/«медведь». Иногда вручную добавляются старые (до 2 лет) проверенные случаи. Не проверяется человеком в реальном времени — точное место неизвестно, метка на карте — лишь ближайший известный город/край. Авторские права на статьи принадлежат их издателям.",
    newsNewCount: "Новых упоминаний: {n}",
  },
};

const I18N_LOCALES = { lv: "lv-LV", en: "en-GB", ru: "ru-RU" };

function localeForLang(lang) {
  return I18N_LOCALES[lang] || I18N_LOCALES.lv;
}

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
