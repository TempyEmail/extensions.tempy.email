const i18n = (key, substitutions) => chrome.i18n.getMessage(key, substitutions) || key;

const acceptBtn = document.getElementById("accept-btn");
const declineBtn = document.getElementById("decline-btn");
const statusEl = document.getElementById("status");

function localizePage() {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const msg = i18n(el.dataset.i18n);
    if (msg) el.textContent = msg;
  });
}

async function updateConsent(value) {
  const { settings } = await chrome.storage.local.get("settings");
  const nextSettings = {
    autoDetectInputs: true,
    openInboxAfterGenerate: false,
    ...settings,
    dataConsent: value,
  };
  await chrome.storage.local.set({ settings: nextSettings });
}

acceptBtn.addEventListener("click", async () => {
  await updateConsent(true);
  statusEl.textContent = i18n("consent_status_accepted");
  statusEl.className = "status success";
});

declineBtn.addEventListener("click", async () => {
  await updateConsent(false);
  statusEl.textContent = i18n("consent_status_declined");
  statusEl.className = "status warn";
});

localizePage();
