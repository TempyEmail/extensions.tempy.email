# AMO Listing Disclosure

Use the following text in the AMO listing under data disclosure.

## Data Use Disclosure

This add-on communicates with `https://tempy.email/api/*` only to provide its core functionality.

Data transmitted:
- A mailbox creation request when the user clicks Generate or uses the context menu.
- The generated mailbox identifier (email address) when the popup is open to fetch messages.

Purpose:
- Create disposable inboxes and show incoming messages and OTPs to the user.

When it happens:
- On explicit user actions (Generate / context menu), and while the popup is open with an active mailbox (periodic polling).

Data not collected:
- No browsing history, search terms, analytics, or third-party tracking.

Local-only storage:
- Settings and the most recently generated address are stored locally in the browser.
