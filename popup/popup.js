const generateBtn = document.getElementById("generate-btn");
const emailList = document.getElementById("email-list");
const emptyState = document.getElementById("empty-state");
const errorBanner = document.getElementById("error-banner");
const clearBtn = document.getElementById("clear-btn");
const settingAutoDetect = document.getElementById("setting-auto-detect");
const settingAutoOpen = document.getElementById("setting-auto-open");
const messagesContainer = document.getElementById("messages-container");
const messagesList = document.getElementById("messages-list");
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
  startPolling();
});

// Cleanup on unload
window.addEventListener("beforeunload", () => {
  if (pollingInterval) clearInterval(pollingInterval);
});

// Generate button
generateBtn.addEventListener("click", async () => {
  generateBtn.disabled = true;
  generateBtn.innerHTML = '<span class="spinner"></span>';
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
    generateBtn.disabled = false;
    generateBtn.textContent = STR.generate;
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

async function loadSettings() {
  const settings = await chrome.runtime.sendMessage({ action: "getSettings" });
  settingAutoDetect.checked = settings.autoDetectInputs !== false;
  settingAutoOpen.checked = settings.openInboxAfterGenerate === true;
}

async function saveSettings() {
  await chrome.runtime.sendMessage({
    action: "saveSettings",
    settings: {
      autoDetectInputs: settingAutoDetect.checked,
      openInboxAfterGenerate: settingAutoOpen.checked,
    },
  });
}

async function loadRecentEmails() {
  const emails = await chrome.runtime.sendMessage({ action: "getRecentEmails" });

  if (!emails || emails.length === 0) {
    emptyState.classList.remove("hidden");
    emailList.innerHTML = "";
    messagesContainer.classList.add("hidden");
    currentMailbox = null;
    return;
  }

  emptyState.classList.add("hidden");
  emailList.innerHTML = "";

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

    li.innerHTML = `
      <div class="email-row">
        <div class="email-address">${escapeHtml(entry.email)}</div>
        <button class="btn-icon btn-newtab" data-url="${escapeHtml(entry.webUrl)}" title="${escapeHtml(STR.openInboxNewTabTitle)}" aria-label="${escapeHtml(STR.openInboxNewTabTitle)}">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 8.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h4.5"/>
            <path d="M10 2h4v4"/>
            <path d="M7 9L14 2"/>
          </svg>
        </button>
      </div>
      <div class="email-meta">
        <span class="email-timer ${remaining > 0 ? "active" : "expired"}">
          ${formatTimer(remaining, (m, s) => i18n("popup_timer_remaining", [String(m), s]), STR.timerExpired)}
        </span>
        <div class="email-actions">
          <button class="btn-sm btn-copy" data-email="${escapeHtml(entry.email)}">${escapeHtml(STR.copy)}</button>
          <button class="btn-sm btn-open" data-url="${escapeHtml(entry.webUrl)}">${escapeHtml(STR.openInbox)}</button>
          <button class="btn-sm btn-icon btn-open-web" data-email="${escapeHtml(entry.email)}" title="${escapeHtml(STR.openOnTempyTitle)}" aria-label="${escapeHtml(STR.openOnTempyTitle)}">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 10H2V2H6V1H2C1.45 1 1 1.45 1 2V10C1 10.55 1.45 11 2 11H10C10.55 11 11 10.55 11 10V6H10V10ZM7 1V2H9.59L3.76 7.83L4.46 8.53L10.29 2.71V5.29H11.29V1H7Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
    `;
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

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
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
  messagesList.innerHTML = "";
  lastOtp = null;

  for (const msg of messages) {
    const li = document.createElement("li");
    li.className = "message-item";

    const otpMatch = extractOTP(msg.body_text || "");
    if (otpMatch) {
      lastOtp = otpMatch.code;
    }

    li.innerHTML = `
      <div class="message-from">${escapeHtml(msg.from || STR.unknownSender)}</div>
      <div class="message-subject">${escapeHtml(msg.subject || STR.noSubject)}</div>
      ${otpMatch ? `<div class="message-otp" data-otp="${escapeHtml(otpMatch.code)}">${escapeHtml(i18n("popup_otp_label", [otpMatch.code]))}</div>` : ""}
    `;

    const otpEl = li.querySelector(".message-otp");
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
