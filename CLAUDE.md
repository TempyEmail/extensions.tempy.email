# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Browser extension (Chrome/Firefox MV3) for tempy.email disposable email service. Pure vanilla JavaScript — no build tools, frameworks, or dependencies. Files are packaged directly from source.

## Development Commands

### Git Commit Style

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>
```

**Types:**
- `feat` — new feature
- `fix` — bug fix
- `refactor` — code change that neither fixes a bug nor adds a feature
- `chore` — maintenance tasks (dependencies, config, tooling)
- `docs` — documentation only
- `style` — formatting, white-space (not CSS)
- `perf` — performance improvement
- `test` — adding or updating tests

**Examples:**
- `feat(popup): add OTP extraction from messages`
- `fix(content): overlay positioning on scroll`
- `refactor(api): simplify message polling logic`
- `chore(deps): update manifest version`
- `docs(readme): add Firefox installation steps`

### Testing locally

**Chrome:**
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the repository root

**Firefox:**
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `manifest.firefox.json`

### Releasing

Automated via GitHub Actions on push to `main`:
- Version format: `{major}.{minor}.{run_number}` (e.g., `1.0.42`)
- Major/minor are read from `package.json` version field
- Build number comes from `github.run_number`
- Both `manifest.json` and `manifest.firefox.json` are updated with the new version
- Creates GitHub release with separate Chrome and Firefox zip packages

No manual build or release commands — just push to `main`.

## Architecture

### Component Communication Flow

```
Content Script (content.js)
    ↕ chrome.runtime.sendMessage
Background Service Worker (service-worker.js) ← API calls to tempy.email
    ↕ chrome.runtime.sendMessage
Popup (popup.js) ← Live polling, timer updates
```

All components communicate via `chrome.runtime.sendMessage` with action-based messages:
- `generateEmail` — create new mailbox, save to storage, optionally open inbox
- `getRecentEmails` — retrieve from chrome.storage.local
- `getSettings` / `saveSettings` — manage user preferences
- `clearRecent` — wipe email history

### Background Service Worker

`background/service-worker.js` is the API layer and coordinator:
- **API Integration**: POSTs to `https://tempy.email/api/v1/mailbox` to create addresses
- **Context Menu**: Registers "Generate Tempy Email" on editable fields
- **Storage**: Maintains only the **latest** generated email (not a history array) in `chrome.storage.local.recentEmails`
- **Settings**: Stores `autoDetectInputs` (show overlay icons) and `openInboxAfterGenerate` flags

When filling inputs via context menu, uses `chrome.scripting.executeScript` to inject the `fillActiveElement` function, which:
- Uses native property descriptors (`Object.getOwnPropertyDescriptor`) for React/Vue compatibility
- Dispatches `input` and `change` events to trigger framework reactivity

### Popup UI

`popup/popup.js` and `popup/popup.html` show:
- Latest generated email with live countdown timer (updates every second)
- **Message viewer** that polls `https://tempy.email/api/v1/mailbox/{email}/messages` every 10 seconds
- Extracts and displays OTPs from message bodies using regex patterns
- Copy to clipboard, open inbox in new tab, and settings toggles

Key implementation details:
- `startPolling()` fetches messages every 10 seconds from the API
- `extractOTP()` looks for verification codes near keywords like "code", "otp", "verify"
- Timer updates use `setInterval` for real-time countdown display
- Settings changes propagate to content script via `chrome.storage.onChanged`

### Content Script

`content/content.js` detects email inputs and injects overlay icons:
- **Email field detection**: Checks `type="email"` or name/id/placeholder/autocomplete containing "email"
- **Shadow DOM isolation**: Each overlay icon is injected via closed shadow root to avoid page CSS conflicts
- **Framework-compatible filling**: Uses native property setters like the background worker
- **DOM observation**: Watches for dynamically added inputs (SPAs, lazy-loaded forms)
- **Positioning**: Positioned absolutely to the right of input, repositions on scroll/resize
- **Cleanup**: MutationObserver removes overlays when input elements are removed from DOM

Overlay visibility is controlled by the `autoDetectInputs` setting, which removes all overlays when toggled off.

### Manifest Differences

Two manifests for browser compatibility:
- `manifest.json` — Chrome — uses `"service_worker"` field
- `manifest.firefox.json` — Firefox — uses `"scripts"` array, includes `browser_specific_settings.gecko`

Both manifests must be manually kept in sync for permissions, icons, content scripts, and other fields.

## API Integration

Backend: `https://tempy.email/api/v1`

**Create mailbox** (POST `/mailbox`):
- Returns: `{ email, web_url, expires_at }`
- No auth required for creation
- Rate limited (429 response triggers user-facing error)

**Fetch messages** (GET `/mailbox/{email}/messages`):
- No authentication required
- Returns: `{ messages: [{ from, subject, body_text, ... }] }`
- Used by popup polling to display incoming mail

## Coding Patterns

**Input Filling (React/Vue compatible):**
```javascript
const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
if (setter) setter.call(input, email);
else input.value = email;
input.dispatchEvent(new Event("input", { bubbles: true }));
input.dispatchEvent(new Event("change", { bubbles: true }));
```

**Message Passing:**
```javascript
// Sender:
const resp = await chrome.runtime.sendMessage({ action: "generateEmail" });

// Receiver (in background service worker):
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "generateEmail") {
    handleGenerateEmail().then(sendResponse);
    return true; // async response
  }
});
```

**Storage Schema:**
```javascript
// chrome.storage.local
{
  recentEmails: [{
    email: "xyz@tempy.email",
    webUrl: "https://tempy.email/?mailbox=xyz@tempy.email",
    expiresAt: "2024-01-01T12:00:00Z",
    createdAt: "2024-01-01T11:50:00Z"
  }],
  settings: {
    autoDetectInputs: true,
    openInboxAfterGenerate: false
  }
}
```

## Important Constraints

- **No build step** — edit source directly, reload extension to test
- **No external dependencies** — vanilla JS only
- **Manifest sync** — changes to permissions/icons/scripts must be applied to BOTH manifest files
- **Storage limit** — currently only stores latest email (array of 1), expandable to 20 if history feature is added
