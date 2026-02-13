# Tempy Email — Browser Extension

![Pack and Release](https://github.com/TempyEmail/extensions.tempy.email/actions/workflows/release.yml/badge.svg)
![Unit Tests](https://github.com/TempyEmail/extensions.tempy.email/actions/workflows/tests.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

Browser extension for [tempy.email](https://tempy.email), the instant disposable email service. Generate a temporary `@tempy.email` inbox from any website — no signup, no personal info, fully anonymous.

## What is tempy.email?

tempy.email provides free, instant disposable email addresses that protect your real inbox from spam, unwanted subscriptions, and privacy invasions. No registration required — just visit the site and get a working temporary email address immediately.

- **Instant inbox** — a unique address is generated the moment you need one
- **Live updates** — incoming messages appear in real-time via SignalR
- **Auto-expiry** — addresses expire after 10 minutes by default (extendable to an hour or a day)
- **Privacy-first** — no personal information collected, emails are temporarily cached and automatically cleaned up
- **Security** — attachments are stripped, only actively watched addresses accept mail, everything else bounces

## What the Extension Does

This extension brings tempy.email directly into your browser so you never have to leave the page you're on:

- **Generate from anywhere** — click the popup button or right-click any email field to instantly create a disposable address
- **Auto-detect email fields** — an overlay icon appears on email inputs across websites, one click fills the field
- **Auto-fill** — generated addresses are inserted directly into the active field, compatible with React, Vue, and other frameworks
- **Recent history** — keeps track of your last 20 generated addresses with live expiration countdowns
- **Open inbox** — optionally auto-opens the tempy.email inbox in a new tab so you can watch for incoming mail

## Supported Languages

- English — Browser extension for tempy.email that generates disposable email addresses instantly from any website.
- Español — Extensión de navegador para tempy.email que genera direcciones de correo desechables al instante desde cualquier sitio web.
- Português (Brasil) — Extensão de navegador para tempy.email que gera endereços de e-mail descartáveis instantaneamente a partir de qualquer site.
- Deutsch — Browser-Erweiterung für tempy.email, die sofort Wegwerf-E-Mail-Adressen von jeder Website erzeugt.
- Français — Extension de navigateur pour tempy.email qui génère instantanément des adresses e-mail jetables depuis n'importe quel site.
- 日本語 — tempy.email 用のブラウザ拡張機能で、どのサイトからでも使い捨てメールアドレスを即座に生成します。
- Русский — Расширение браузера для tempy.email, которое мгновенно создает одноразовые адреса электронной почты с любого сайта.
- 한국어 — tempy.email용 브라우저 확장 프로그램으로 어떤 웹사이트에서든 즉시 일회용 이메일 주소를 생성합니다.
- Türkçe — tempy.email için tarayıcı uzantısı; herhangi bir web sitesinden anında tek kullanımlık e-posta adresleri oluşturur.
- Polski — Rozszerzenie przeglądarki dla tempy.email, które natychmiast tworzy jednorazowe adresy e-mail z dowolnej strony.

## Installation

### Chrome

1. Download the latest `tempy-email-chrome-*.zip` from [Releases](../../releases/latest)
2. Unzip the file
3. Open `chrome://extensions`
4. Enable **Developer mode**
5. Click **Load unpacked** and select the unzipped folder

### Firefox

1. Download the latest `tempy-email-firefox-*.zip` from [Releases](../../releases/latest)
2. Open `about:debugging` → **This Firefox** → **Load Temporary Add-on**
3. Select the zip file

## Usage

**Popup** — click the extension icon in the toolbar and hit **Generate** to create a new address. Recent addresses are listed with expiration timers.

**Context menu** — right-click any text input and select **Generate Tempy Email** to fill it with a fresh address.

**Overlay icon** — when enabled, an envelope icon appears next to detected email fields. Click it to generate and fill in one step.

### Settings

- **Show icon on email fields** — toggle the auto-detect overlay on/off
- **Auto-open inbox in new tab** — automatically open the tempy.email inbox when a new address is generated

## Project Structure

```
├── manifest.json              # Chrome (MV3) manifest
├── manifest.firefox.json      # Firefox (MV3) manifest
├── background/
│   └── service-worker.js      # API calls, context menu, message handling
├── popup/
│   ├── popup.html             # Extension popup UI
│   ├── popup.js               # Popup logic and email list management
│   └── popup.css              # Popup styling
├── content/
│   ├── content.js             # Email field detection, overlay injection
│   └── content.css            # Content script styles
├── _locales/                  # i18n locale strings
├── icons/                     # Extension icons (16/32/48/128)
└── .github/workflows/
    └── release.yml            # CI — pack and release on push
```

## Building

Every push to `main` triggers the GitHub Actions workflow which:

1. Sets the version to `1.0.<build_number>`
2. Packs the Chrome extension (using `manifest.json` with `service_worker`)
3. Packs the Firefox extension (using `manifest.firefox.json` with `scripts`)
4. Creates a GitHub Release with both zip files attached

## Testing

Run `npm test` to execute unit tests.

## License

MIT
