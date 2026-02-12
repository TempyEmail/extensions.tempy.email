const API_BASE = "https://tempy.email/api/v1";
const MAX_RECENT = 20;

// Context menu setup
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "tempy-generate",
    title: "Generate Tempy Email",
    contexts: ["editable"],
    documentUrlPatterns: ["https://*/*", "http://*/*"],
  });
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "tempy-generate" || !tab?.id) return;

  try {
    const data = await createMailbox();
    await saveRecentEmail(data);

    // Fill the active editable element
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillActiveElement,
      args: [data.email],
    });

    // Badge feedback
    chrome.action.setBadgeText({ text: "!", tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: "#ff6b35" });
    setTimeout(() => chrome.action.setBadgeText({ text: "", tabId: tab.id }), 3000);

    // Optionally open inbox
    const { settings } = await chrome.storage.local.get("settings");
    if (settings?.openInboxAfterGenerate) {
      chrome.tabs.create({ url: data.web_url, active: false });
    }
  } catch (err) {
    console.error("[tempy] Failed to generate email:", err);
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (msg) => { console.error("[tempy]", msg); },
      args: [err.message],
    });
  }
});

// Message handler for content script and popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "generateEmail") {
    handleGenerateEmail().then(sendResponse);
    return true; // async response
  }
  if (msg.action === "getRecentEmails") {
    chrome.storage.local.get("recentEmails").then((r) => {
      sendResponse(r.recentEmails || []);
    });
    return true;
  }
  if (msg.action === "getSettings") {
    chrome.storage.local.get("settings").then((r) => {
      sendResponse(r.settings || { autoDetectInputs: true, openInboxAfterGenerate: false });
    });
    return true;
  }
  if (msg.action === "saveSettings") {
    chrome.storage.local.set({ settings: msg.settings }).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg.action === "clearRecent") {
    chrome.storage.local.set({ recentEmails: [] }).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }
});

async function handleGenerateEmail() {
  try {
    const data = await createMailbox();
    await saveRecentEmail(data);

    const { settings } = await chrome.storage.local.get("settings");
    if (settings?.openInboxAfterGenerate) {
      chrome.tabs.create({ url: data.web_url, active: false });
    }

    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function createMailbox() {
  const resp = await fetch(`${API_BASE}/mailbox`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });

  if (resp.status === 429) {
    throw new Error("Rate limit reached. Please wait a moment and try again.");
  }
  if (!resp.ok) {
    throw new Error(`API error: ${resp.status}`);
  }

  return resp.json();
}

async function saveRecentEmail(data) {
  const { recentEmails = [] } = await chrome.storage.local.get("recentEmails");

  recentEmails.unshift({
    email: data.email,
    webUrl: data.web_url,
    expiresAt: data.expires_at,
    createdAt: new Date().toISOString(),
  });

  // Keep only the most recent entries
  if (recentEmails.length > MAX_RECENT) {
    recentEmails.length = MAX_RECENT;
  }

  await chrome.storage.local.set({ recentEmails });
}

// Injected into page context to fill the active element
function fillActiveElement(email) {
  const el = document.activeElement;
  if (!el || (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA" && !el.isContentEditable)) {
    return;
  }

  if (el.isContentEditable) {
    el.textContent = email;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  // Use native setter for framework compatibility (React, Vue, etc.)
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
    || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;

  if (setter) {
    setter.call(el, email);
  } else {
    el.value = email;
  }

  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}
