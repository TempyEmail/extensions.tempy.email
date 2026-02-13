const generateBtn = document.getElementById("generate-btn");
const emailList = document.getElementById("email-list");
const emptyState = document.getElementById("empty-state");
const errorBanner = document.getElementById("error-banner");
const clearBtn = document.getElementById("clear-btn");
const settingAutoDetect = document.getElementById("setting-auto-detect");
const settingAutoOpen = document.getElementById("setting-auto-open");
const messagesContainer = document.getElementById("messages-container");
const messagesList = document.getElementById("messages-list");

let timerInterval = null;
let pollingInterval = null;
let currentMailbox = null;
let currentSha = null;

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
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
      if (currentMailbox && currentSha) {
        await fetchMessages();
      }
    } else {
      showError(resp.error || "Failed to generate email");
    }
  } catch (err) {
    showError(err.message);
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "Generate";
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
    currentSha = null;
    return;
  }

  emptyState.classList.add("hidden");
  emailList.innerHTML = "";

  // Store current mailbox info for polling
  if (emails[0]) {
    currentMailbox = emails[0].email;
    currentSha = emails[0].sha;
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
        <button class="btn-icon btn-newtab" data-url="${escapeHtml(entry.webUrl)}" title="Open inbox in new tab">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 8.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h4.5"/>
            <path d="M10 2h4v4"/>
            <path d="M7 9L14 2"/>
          </svg>
        </button>
      </div>
      <div class="email-meta">
        <span class="email-timer ${remaining > 0 ? "active" : "expired"}">
          ${formatTimer(remaining)}
        </span>
        <div class="email-actions">
          <button class="btn-sm btn-copy" data-email="${escapeHtml(entry.email)}">Copy</button>
          <button class="btn-sm btn-open" data-url="${escapeHtml(entry.webUrl)}">Open Inbox</button>
          <button class="btn-sm btn-icon btn-open-web" data-email="${escapeHtml(entry.email)}" data-sha="${escapeHtml(entry.sha || '')}" title="Open on tempy.email">
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
      btn.textContent = "Copied!";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = "Copy";
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
      const sha = btn.dataset.sha;
      const url = `https://tempy.email/?mailbox=${encodeURIComponent(email)}${sha ? '&sha=' + encodeURIComponent(sha) : ''}`;
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
      timer.textContent = formatTimer(remaining);
      timer.className = `email-timer ${remaining > 0 ? "active" : "expired"}`;
    });
  }, 1000);
}

function getRemaining(expiresAt) {
  return Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000));
}

function formatTimer(seconds) {
  if (seconds <= 0) return "Expired";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")} remaining`;
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
    if (currentMailbox && currentSha) {
      await fetchMessages();
    }
  }, 10000); // Poll every 10 seconds

  // Fetch immediately on start
  if (currentMailbox && currentSha) {
    fetchMessages();
  }
}

async function fetchMessages() {
  try {
    const response = await fetch(`https://tempy.email/api/v1/mailbox/${encodeURIComponent(currentMailbox)}/messages`, {
      headers: {
        'X-API-Key': currentSha
      }
    });

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

  for (const msg of messages) {
    const li = document.createElement("li");
    li.className = "message-item";

    const otp = extractOTP(msg.body_text || "");

    li.innerHTML = `
      <div class="message-from">${escapeHtml(msg.from || "Unknown")}</div>
      <div class="message-subject">${escapeHtml(msg.subject || "(No subject)")}</div>
      ${otp ? `<div class="message-otp">${escapeHtml(otp)}</div>` : ""}
    `;

    li.addEventListener("click", () => {
      const url = `https://tempy.email/?mailbox=${encodeURIComponent(currentMailbox)}${currentSha ? '&sha=' + encodeURIComponent(currentSha) : ''}`;
      chrome.tabs.create({ url });
    });

    messagesList.appendChild(li);
  }
}

function extractOTP(content) {
  // Look for codes near verification/OTP keywords first
  const contextMatch = content.match(/(?:code|otp|pin|verification|verify|confirm)[:\s]*(\d{4,8})/i)
    || content.match(/(\d{4,8})\s*(?:is your|is the)/i);
  if (contextMatch) return `OTP: ${contextMatch[1]}`;

  // Fall back to standalone 4-8 digit numbers (skip years like 2024-2030)
  const matches = content.match(/\b(?!20[2-3]\d\b)\d{4,8}\b/g);
  if (matches && matches.length > 0) {
    return `OTP: ${matches[0]}`;
  }
  return null;
}
