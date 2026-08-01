// "Report an issue" modal — flags a specific community sighting or news
// mention as fake/duplicate/wrong. Shared between app.js (sightings list)
// and news.js (news list), neither of which should own the other's modal,
// so it lives in its own small global-scope module (loaded before both).

let reportIssueTarget = null;

function openReportIssueModal(targetType, targetId) {
  const overlay = document.getElementById("report-issue-overlay");
  const reasonField = document.getElementById("report-issue-reason");
  const errorEl = document.getElementById("report-issue-error");
  if (!overlay) return;
  reportIssueTarget = { targetType, targetId };
  reasonField.value = "";
  errorEl.hidden = true;
  overlay.hidden = false;
}

function closeReportIssueModal() {
  const overlay = document.getElementById("report-issue-overlay");
  if (overlay) overlay.hidden = true;
  reportIssueTarget = null;
}

function showSimpleToast(elId, message) {
  const toast = document.getElementById(elId);
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showSimpleToast._timers?.[elId]);
  showSimpleToast._timers = showSimpleToast._timers || {};
  showSimpleToast._timers[elId] = setTimeout(() => {
    toast.hidden = true;
  }, 5000);
}

function initReportIssue() {
  const overlay = document.getElementById("report-issue-overlay");
  const form = document.getElementById("report-issue-form");
  const cancelBtn = document.getElementById("report-issue-cancel-btn");
  const errorEl = document.getElementById("report-issue-error");
  if (!overlay || !form) return;

  cancelBtn.addEventListener("click", closeReportIssueModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeReportIssueModal();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!reportIssueTarget) return;
    const reason = document.getElementById("report-issue-reason").value.trim();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    errorEl.hidden = true;
    const result = await submitReport(reportIssueTarget.targetType, reportIssueTarget.targetId, reason);
    submitBtn.disabled = false;
    if (result === "ok") {
      closeReportIssueModal();
      showSimpleToast("report-toast", t("reportIssueSuccess"));
    } else {
      errorEl.hidden = false;
      errorEl.textContent = t("reportIssueError");
    }
  });
}

document.addEventListener("DOMContentLoaded", initReportIssue);
