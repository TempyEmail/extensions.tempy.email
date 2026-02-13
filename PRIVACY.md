# Privacy Policy for Tempy Email Browser Extension

Effective date: 2026-02-13

## Summary

The Tempy Email browser extension only communicates with the tempy.email API to create disposable inboxes and to fetch messages for inboxes the user has generated. The extension does not collect analytics, browsing history, or search terms, and it does not sell or share data with third parties.

## Data We Transmit

When you use the extension, it sends limited data to `https://tempy.email/api/*`:

- Mailbox creation requests when you click Generate or use the context menu.
- Mailbox identifiers (the generated email address) when the popup is open and it polls for messages.

## Data We Store Locally

The extension stores the following data in your browser using `chrome.storage.local`:

- Your settings (e.g., auto-detect and auto-open preferences).
- The most recent generated email address and its timestamps.

This data stays on your device unless you clear it.

## What We Do Not Collect

- We do not collect or transmit browsing history, search terms, or visited URLs.
- We do not collect analytics or telemetry.
- We do not sell or share personal data.

## Third-Party Services

The extension connects to tempy.email to create inboxes and fetch messages. Use of the tempy.email website or API is subject to their own privacy policy and terms.

## User Controls

- You can disable the email-field overlay or auto-open behavior in the extension settings.
- You can clear local history from the popup.

## Contact

If you have questions about this policy, open an issue in this repository.
