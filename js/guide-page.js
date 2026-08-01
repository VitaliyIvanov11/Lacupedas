// Standalone guide page: just needs language switching, none of the map/
// storage/news machinery from the main app.
(function () {
  function init() {
    applyTranslations();
    document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setLang(btn.getAttribute("data-lang-btn"));
        applyTranslations();
      });
    });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
