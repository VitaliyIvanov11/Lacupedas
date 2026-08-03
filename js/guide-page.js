// Standalone guide page: just needs language switching, none of the map/
// storage/news machinery from the main app.
(function () {
  function init() {
    applyTranslations();
    initLangSwitcher();
  }
  document.addEventListener("DOMContentLoaded", init);
})();
