const generateBtn = document.getElementById("generate-btn");
const emailList = document.getElementById("email-list");
const emptyState = document.getElementById("empty-state");
const errorBanner = document.getElementById("error-banner");
const clearBtn = document.getElementById("clear-btn");
const settingAutoDetect = document.getElementById("setting-auto-detect");
const settingAutoOpen = document.getElementById("setting-auto-open");
const messagesContainer = document.getElementById("messages-container");
const messagesList = document.getElementById("messages-list");
const consentBanner = document.getElementById("consent-banner");
const consentOpenBtn = document.getElementById("consent-open-btn");
const { getRemaining, formatTimer, extractOTP } = TempyUtils;

const i18n = (key, substitutions) => chrome.i18n.getMessage(key, substitutions) || key;
const STR = {
  generate: i18n("popup_generate"),
  generateFailed: i18n("popup_error_generate_failed"),
  openInboxNewTabTitle: i18n("popup_open_inbox_new_tab_title"),
  copy: i18n("popup_copy"),
  copied: i18n("popup_copied"),
  openInbox: i18n("popup_open_inbox"),
  openOnTempyTitle: i18n("popup_open_on_tempy_title"),
  timerExpired: i18n("popup_timer_expired"),
  unknownSender: i18n("popup_unknown_sender"),
  noSubject: i18n("popup_no_subject"),
};

let timerInterval = null;
let pollingInterval = null;
let currentMailbox = null;
let lastOtp = null;
let hasConsent = false;
const SVG_NS = "http://www.w3.org/2000/svg";

function clearChildren(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function setGenerateButtonLoading(isLoading) {
  if (isLoading) {
    generateBtn.disabled = true;
    clearChildren(generateBtn);
    const spinner = document.createElement("span");
    spinner.className = "spinner";
    generateBtn.appendChild(spinner);
    return;
  }
  generateBtn.disabled = false;
  generateBtn.textContent = STR.generate;
}

function createSvgNewTab() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "14");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const p1 = document.createElementNS(SVG_NS, "path");
  p1.setAttribute("d", "M14 8.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h4.5");
  const p2 = document.createElementNS(SVG_NS, "path");
  p2.setAttribute("d", "M10 2h4v4");
  const p3 = document.createElementNS(SVG_NS, "path");
  p3.setAttribute("d", "M7 9L14 2");
  svg.append(p1, p2, p3);
  return svg;
}

function createSvgOpenWeb() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "12");
  svg.setAttribute("height", "12");
  svg.setAttribute("viewBox", "0 0 12 12");
  svg.setAttribute("fill", "none");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", "M10 10H2V2H6V1H2C1.45 1 1 1.45 1 2V10C1 10.55 1.45 11 2 11H10C10.55 11 11 10.55 11 10V6H10V10ZM7 1V2H9.59L3.76 7.83L4.46 8.53L10.29 2.71V5.29H11.29V1H7Z");
  path.setAttribute("fill", "currentColor");
  svg.append(path);
  return svg;
}

function createIconButton(className, title, ariaLabel, svgEl) {
  const btn = document.createElement("button");
  btn.className = className;
  if (title) btn.title = title;
  if (ariaLabel) btn.setAttribute("aria-label", ariaLabel);
  if (svgEl) btn.appendChild(svgEl);
  return btn;
}

function localizePage() {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    const msg = i18n(key);
    if (msg) el.textContent = msg;
  });
}

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  localizePage();
  await loadSettings();
  await loadRecentEmails();
  startTimerUpdates();
  if (hasConsent) {
    startPolling();
  }
});

// Cleanup on unload
window.addEventListener("beforeunload", () => {
  if (pollingInterval) clearInterval(pollingInterval);
});

chrome.storage.onChanged.addListener((changes) => {
  if (!changes.settings) return;
  const next = changes.settings.newValue || {};
  const consentNow = next.dataConsent === true;
  if (consentNow === hasConsent) return;
  hasConsent = consentNow;
  updateConsentUI();
  if (hasConsent) {
    startPolling();
  } else if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
});

// Generate button
generateBtn.addEventListener("click", async () => {
  if (!hasConsent) {
    openConsentPage();
    return;
  }
  setGenerateButtonLoading(true);
  hideError();

  try {
    const resp = await chrome.runtime.sendMessage({ action: "generateEmail" });
    if (resp.ok) {
      await loadRecentEmails();
      // Immediately fetch messages for the new mailbox
      if (currentMailbox) {
        await fetchMessages();
      }
    } else {
      showError(resp.error || STR.generateFailed);
    }
  } catch (err) {
    showError(err.message);
  } finally {
    setGenerateButtonLoading(false);
  }
});

// Clear history
clearBtn.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ action: "clearRecent" });
  await loadRecentEmails();
});

// Settings
settingAutoDetect.addEventListener("change", saveSettings);
settingAutoOpen.addEventListener("change", saveSettings);
consentOpenBtn.addEventListener("click", openConsentPage);

async function loadSettings() {
  const settings = await chrome.runtime.sendMessage({ action: "getSettings" });
  settingAutoDetect.checked = settings.autoDetectInputs !== false;
  settingAutoOpen.checked = settings.openInboxAfterGenerate === true;
  hasConsent = settings.dataConsent === true;
  updateConsentUI();
}

async function saveSettings() {
  const existing = await chrome.runtime.sendMessage({ action: "getSettings" });
  await chrome.runtime.sendMessage({
    action: "saveSettings",
    settings: {
      ...existing,
      autoDetectInputs: settingAutoDetect.checked,
      openInboxAfterGenerate: settingAutoOpen.checked,
    },
  });
}

async function loadRecentEmails() {
  const emails = await chrome.runtime.sendMessage({ action: "getRecentEmails" });

  if (!emails || emails.length === 0) {
    emptyState.classList.remove("hidden");
    clearChildren(emailList);
    messagesContainer.classList.add("hidden");
    currentMailbox = null;
    return;
  }

  emptyState.classList.add("hidden");
  clearChildren(emailList);

  // Store current mailbox info for polling
  if (emails[0]) {
    currentMailbox = emails[0].email;
  }

  for (const entry of emails) {
    const li = document.createElement("li");
    li.className = "email-item";
    li.dataset.expiresAt = entry.expiresAt;
    li.dataset.webUrl = entry.webUrl;

    const remaining = getRemaining(entry.expiresAt);

    const row = document.createElement("div");
    row.className = "email-row";

    const address = document.createElement("div");
    address.className = "email-address";
    address.textContent = entry.email;

    const btnNewTab = createIconButton(
      "btn-icon btn-newtab",
      STR.openInboxNewTabTitle,
      STR.openInboxNewTabTitle,
      createSvgNewTab()
    );
    btnNewTab.dataset.url = entry.webUrl;

    row.append(address, btnNewTab);

    const meta = document.createElement("div");
    meta.className = "email-meta";

    const timer = document.createElement("span");
    timer.className = `email-timer ${remaining > 0 ? "active" : "expired"}`;
    timer.textContent = formatTimer(remaining, (m, s) => i18n("popup_timer_remaining", [String(m), s]), STR.timerExpired);

    const actions = document.createElement("div");
    actions.className = "email-actions";

    const btnCopy = document.createElement("button");
    btnCopy.className = "btn-sm btn-copy";
    btnCopy.dataset.email = entry.email;
    btnCopy.textContent = STR.copy;

    const btnOpen = document.createElement("button");
    btnOpen.className = "btn-sm btn-open";
    btnOpen.dataset.url = entry.webUrl;
    btnOpen.textContent = STR.openInbox;

    const btnOpenWeb = createIconButton(
      "btn-sm btn-icon btn-open-web",
      STR.openOnTempyTitle,
      STR.openOnTempyTitle,
      createSvgOpenWeb()
    );
    btnOpenWeb.dataset.email = entry.email;

    actions.append(btnCopy, btnOpen, btnOpenWeb);
    meta.append(timer, actions);
    li.append(row, meta);
    emailList.appendChild(li);
  }

  // Bind actions
  emailList.querySelectorAll(".btn-copy").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(btn.dataset.email);
      btn.textContent = STR.copied;
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = STR.copy;
        btn.classList.remove("copied");
      }, 1500);
    });
  });

  emailList.querySelectorAll(".btn-newtab").forEach((btn) => {
    btn.addEventListener("click", () => {
      chrome.tabs.create({ url: btn.dataset.url });
    });
  });

  emailList.querySelectorAll(".btn-open-web").forEach((btn) => {
    btn.addEventListener("click", () => {
      const email = btn.dataset.email;
      const url = `https://tempy.email/?mailbox=${encodeURIComponent(email)}`;
      chrome.tabs.create({ url });
    });
  });
}

function startTimerUpdates() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    emailList.querySelectorAll(".email-item").forEach((li) => {
      const timer = li.querySelector(".email-timer");
      const remaining = getRemaining(li.dataset.expiresAt);
      timer.textContent = formatTimer(remaining, (m, s) => i18n("popup_timer_remaining", [String(m), s]), STR.timerExpired);
      timer.className = `email-timer ${remaining > 0 ? "active" : "expired"}`;
    });
  }, 1000);
}

function showError(msg) {
  errorBanner.textContent = msg;
  errorBanner.classList.remove("hidden");
}

function hideError() {
  errorBanner.classList.add("hidden");
}

function updateConsentUI() {
  if (hasConsent) {
    consentBanner.classList.add("hidden");
    generateBtn.disabled = false;
    return;
  }
  consentBanner.classList.remove("hidden");
  generateBtn.disabled = true;
}

function openConsentPage() {
  chrome.tabs.create({ url: chrome.runtime.getURL("consent/consent.html") });
}

// Polling for new messages
function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);

  pollingInterval = setInterval(async () => {
    if (currentMailbox) {
      await fetchMessages();
    }
  }, 10000); // Poll every 10 seconds

  // Fetch immediately on start
  if (currentMailbox) {
    fetchMessages();
  }
}

async function fetchMessages() {
  try {
    const response = await fetch(`https://tempy.email/api/v1/mailbox/${encodeURIComponent(currentMailbox)}/messages`);

    if (!response.ok) {
      console.error("Failed to fetch messages:", response.status);
      return;
    }

    const data = await response.json();
    displayMessages(data.messages || []);
  } catch (err) {
    console.error("Error fetching messages:", err);
  }
}

function displayMessages(messages) {
  if (!messages || messages.length === 0) {
    messagesContainer.classList.add("hidden");
    return;
  }

  messagesContainer.classList.remove("hidden");
  clearChildren(messagesList);
  lastOtp = null;

  for (const msg of messages) {
    const li = document.createElement("li");
    li.className = "message-item";

    const otpMatch = extractOTP(msg.body_text || "");
    if (otpMatch) {
      lastOtp = otpMatch.code;
    }

    const from = document.createElement("div");
    from.className = "message-from";
    from.textContent = msg.from || STR.unknownSender;

    const subject = document.createElement("div");
    subject.className = "message-subject";
    subject.textContent = msg.subject || STR.noSubject;

    li.append(from, subject);

    let otpEl = null;
    if (otpMatch) {
      otpEl = document.createElement("div");
      otpEl.className = "message-otp";
      otpEl.dataset.otp = otpMatch.code;
      otpEl.textContent = i18n("popup_otp_label", [otpMatch.code]);
      li.appendChild(otpEl);
    }

    if (otpEl) {
      otpEl.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const otp = otpEl.dataset.otp;
        if (!otp) return;
        try {
          await navigator.clipboard.writeText(otp);
        } catch (err) {
          console.error("Failed to copy OTP:", err);
        }
      });

      otpEl.addEventListener("contextmenu", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const otp = otpEl.dataset.otp || lastOtp;
        if (!otp) return;
        try {
          await chrome.runtime.sendMessage({ action: "pasteOtp", otp });
        } catch (err) {
          console.error("Failed to paste OTP:", err);
        }
      });
    }

    li.addEventListener("click", () => {
      const url = `https://tempy.email/?mailbox=${encodeURIComponent(currentMailbox)}`;
      chrome.tabs.create({ url });
    });

    messagesList.appendChild(li);
  }
}
