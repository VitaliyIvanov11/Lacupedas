// Sighting-report modal + click-to-pick-a-location flow. Shared between
// index.html (desktop, where the map is embedded on the same page) and
// map.html (the standalone map page) via initReportForm(map, {onSaved}) —
// "onSaved" lets each page decide what happens after a successful submit:
// index.html re-renders its sightings sidebar, map.html just refreshes
// markers. Same callback-handoff shape as initNews(map, onDataChange).

let reportFormPendingLatLng = null;
let reportFormOnSaved = null;
let reportFormEl = null;

// Lightweight, no-signup anti-spam: a hidden honeypot field (real visitors
// never fill it in; simple bots that auto-fill every input do) plus a
// per-browser cooldown between submissions. Neither stops a determined
// attacker hitting the Supabase REST API directly — see README's
// "Moderation" section for why that's an accepted trade-off here.
const REPORT_COOLDOWN_MS = 30 * 1000;
const REPORT_COOLDOWN_KEY = "lacupedas.lastReportSubmitAt";

function reportFormResetPhotoField() {
  if (reportFormEl.photoPreview.src) URL.revokeObjectURL(reportFormEl.photoPreview.src);
  reportFormEl.photoPreview.hidden = true;
  reportFormEl.photoPreview.removeAttribute("src");
  reportFormEl.photoError.hidden = true;
}

function reportFormOnPhotoSelected() {
  reportFormResetPhotoField();
  const file = reportFormEl.photoInput.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    reportFormEl.photoError.hidden = false;
    reportFormEl.photoError.textContent = t("photoInvalidType");
    reportFormEl.photoInput.value = "";
    return;
  }
  if (file.size > PHOTO_MAX_SOURCE_BYTES) {
    reportFormEl.photoError.hidden = false;
    reportFormEl.photoError.textContent = t("photoTooBig");
    reportFormEl.photoInput.value = "";
    return;
  }
  reportFormEl.photoPreview.src = URL.createObjectURL(file);
  reportFormEl.photoPreview.hidden = false;
}

function openReportForm() {
  if (!reportFormPendingLatLng) return;
  reportFormEl.form.reset();
  reportFormEl.formError.hidden = true;
  reportFormResetPhotoField();
  reportFormEl.form.elements["date"].value = new Date().toISOString().slice(0, 10);
  reportFormEl.form.elements["count"].value = 1;
  reportFormEl.formLocation.textContent =
    reportFormPendingLatLng.lat.toFixed(4) + ", " + reportFormPendingLatLng.lng.toFixed(4);
  reportFormEl.modalOverlay.hidden = false;
}

function closeReportForm() {
  reportFormEl.modalOverlay.hidden = true;
  reportFormResetPhotoField();
  reportFormPendingLatLng = null;
}

function showReportToast() {
  const toast = reportFormEl.reportToast;
  if (!toast) return;
  toast.textContent = t("reportSuccessToast");
  toast.hidden = false;
  clearTimeout(showReportToast._timer);
  showReportToast._timer = setTimeout(() => {
    toast.hidden = true;
  }, 5000);
}

function startPicking() {
  setPickingMode(true, (lat, lng) => {
    reportFormPendingLatLng = { lat, lng };
    setPickingMode(false);
    reportFormEl.pickingBanner.hidden = true;
    openReportForm();
  });
  reportFormEl.pickingBanner.hidden = false;
}

function stopPicking() {
  setPickingMode(false);
  reportFormEl.pickingBanner.hidden = true;
}

async function submitReportForm(e) {
  e.preventDefault();
  if (!reportFormPendingLatLng) return;
  const fd = new FormData(reportFormEl.form);

  const honeypot = (fd.get("website") || "").trim();
  if (honeypot) {
    // Don't reveal the honeypot to whatever filled it in — a visible
    // "spam detected" error just teaches a bot to leave the field blank.
    // Pretend success instead; nothing gets inserted.
    closeReportForm();
    showReportToast();
    return;
  }

  const lastSubmit = parseInt(localStorage.getItem(REPORT_COOLDOWN_KEY) || "0", 10);
  if (Date.now() - lastSubmit < REPORT_COOLDOWN_MS) {
    reportFormEl.formError.hidden = false;
    reportFormEl.formError.textContent = t("reportCooldownError");
    return;
  }

  const date = fd.get("date");
  const type = fd.get("type");
  const count = Math.max(1, parseInt(fd.get("count"), 10) || 1);
  const description = (fd.get("description") || "").trim();
  const reporter = (fd.get("reporter") || "").trim();

  if (!date || !type) {
    reportFormEl.formError.hidden = false;
    reportFormEl.formError.textContent = t("requiredError");
    return;
  }

  const sighting = {
    lat: reportFormPendingLatLng.lat,
    lng: reportFormPendingLatLng.lng,
    date,
    type,
    count,
    description,
    reporter,
  };

  const submitBtn = reportFormEl.form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  reportFormEl.formError.hidden = true;
  try {
    const photoFile = reportFormEl.photoInput.files[0];
    if (photoFile) {
      try {
        sighting.photoUrl = await processAndUploadPhoto(photoFile);
      } catch (photoErr) {
        // Don't lose the whole report over a photo hiccup — save without it.
        console.error(photoErr);
      }
    }
    await addSighting(sighting);
    localStorage.setItem(REPORT_COOLDOWN_KEY, String(Date.now()));
    closeReportForm();
    if (reportFormOnSaved) await reportFormOnSaved();
    showReportToast();
  } catch (err) {
    reportFormEl.formError.hidden = false;
    reportFormEl.formError.textContent = t("submitError");
  } finally {
    submitBtn.disabled = false;
  }
}

// `map` is accepted for symmetry with initNews(map, ...) and possible future
// use; picking itself goes through the shared map.js click handler via
// setPickingMode() rather than needing the map reference directly here.
function initReportForm(map, { onSaved } = {}) {
  reportFormOnSaved = onSaved || null;
  reportFormEl = {
    reportBtn: document.getElementById("report-btn"),
    cancelPickingBtn: document.getElementById("cancel-picking-btn"),
    pickingBanner: document.getElementById("picking-banner"),
    modalOverlay: document.getElementById("modal-overlay"),
    form: document.getElementById("sighting-form"),
    formLocation: document.getElementById("form-location"),
    formCancelBtn: document.getElementById("form-cancel-btn"),
    formError: document.getElementById("form-error"),
    photoInput: document.getElementById("field-photo"),
    photoPreview: document.getElementById("photo-preview"),
    photoError: document.getElementById("photo-error"),
    reportToast: document.getElementById("report-toast"),
  };
  if (!reportFormEl.modalOverlay || !reportFormEl.form) return;

  if (reportFormEl.reportBtn) reportFormEl.reportBtn.addEventListener("click", startPicking);
  if (reportFormEl.cancelPickingBtn) {
    reportFormEl.cancelPickingBtn.addEventListener("click", stopPicking);
  }
  reportFormEl.formCancelBtn.addEventListener("click", closeReportForm);
  reportFormEl.modalOverlay.addEventListener("click", (e) => {
    if (e.target === reportFormEl.modalOverlay) closeReportForm();
  });
  reportFormEl.form.addEventListener("submit", submitReportForm);
  reportFormEl.photoInput.addEventListener("change", reportFormOnPhotoSelected);
}
