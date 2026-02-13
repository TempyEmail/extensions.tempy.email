const API_BASE = "https://tempy.email/api/v1";
const i18n = (key, substitutions) => chrome.i18n.getMessage(key, substitutions) || key;

// Context menu setup
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "tempy-generate",
    title: i18n("generate_tempy_email"),
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
      func: fillActiveElementWithText,
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
  if (msg.action === "pasteOtp") {
    handlePasteOtp(msg.otp).then(sendResponse);
    return true;
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
    throw new Error(i18n("error_rate_limit"));
  }
  if (!resp.ok) {
    throw new Error(i18n("error_api_status", [String(resp.status)]));
  }

  return resp.json();
}

async function saveRecentEmail(data) {
  // Replace with only the latest email (no history)
  const recentEmails = [{
    email: data.email,
    webUrl: data.web_url,
    expiresAt: data.expires_at,
    createdAt: new Date().toISOString(),
  }];

  await chrome.storage.local.set({ recentEmails });
}

async function handlePasteOtp(otp) {
  if (!otp) return { ok: false, error: "No OTP provided." };
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { ok: false, error: "No active tab." };

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillActiveElementWithText,
      args: [otp],
    });
    return { ok: true };
  } catch (err) {
    console.error("[tempy] Failed to paste OTP:", err);
    return { ok: false, error: err.message };
  }
}

// Injected into page context to fill the active element
function fillActiveElementWithText(text) {
  const el = document.activeElement;
  if (!el || (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA" && !el.isContentEditable)) {
    return;
  }

  if (el.isContentEditable) {
    el.textContent = text;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  // Use native setter for framework compatibility (React, Vue, etc.)
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
    || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;

  if (setter) {
    setter.call(el, text);
  } else {
    el.value = text;
  }

  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}
