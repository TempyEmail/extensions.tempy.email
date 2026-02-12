const generateBtn = document.getElementById("generate-btn");
const emailList = document.getElementById("email-list");
const emptyState = document.getElementById("empty-state");
const errorBanner = document.getElementById("error-banner");
const clearBtn = document.getElementById("clear-btn");
const settingAutoDetect = document.getElementById("setting-auto-detect");
const settingAutoOpen = document.getElementById("setting-auto-open");

let timerInterval = null;

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();
  await loadRecentEmails();
  startTimerUpdates();
});

// Generate button
generateBtn.addEventListener("click", async () => {
  generateBtn.disabled = true;
  generateBtn.textContent = "...";
  hideError();

  try {
    const resp = await chrome.runtime.sendMessage({ action: "generateEmail" });
    if (resp.ok) {
      await loadRecentEmails();
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
    return;
  }

  emptyState.classList.add("hidden");
  emailList.innerHTML = "";

  for (const entry of emails) {
    const li = document.createElement("li");
    li.className = "email-item";
    li.dataset.expiresAt = entry.expiresAt;
    li.dataset.webUrl = entry.webUrl;

    const remaining = getRemaining(entry.expiresAt);

    li.innerHTML = `
      <div class="email-address">${escapeHtml(entry.email)}</div>
      <div class="email-meta">
        <span class="email-timer ${remaining > 0 ? "active" : "expired"}">
          ${formatTimer(remaining)}
        </span>
        <div class="email-actions">
          <button class="btn-sm btn-copy" data-email="${escapeHtml(entry.email)}">Copy</button>
          <button class="btn-sm btn-open" data-url="${escapeHtml(entry.webUrl)}">Open Inbox</button>
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

  emailList.querySelectorAll(".btn-open").forEach((btn) => {
    btn.addEventListener("click", () => {
      chrome.tabs.create({ url: btn.dataset.url });
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
