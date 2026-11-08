# Phantom Audit — Privacy & Security Steering

## 1. Minimal Permissions Policy

- Permissions declared strictly in `manifest.json`:
  - `activeTab`: Temporary access granted only upon explicit extension action click.
  - `scripting`: Required to inject locally bundled `axe.min.js`.
  - `storage`: Required for local snapshot history and preferences.
- Prohibited:
  - `<all_urls>` or `*://*/*` host permissions.
  - `cookies`, `webRequest`, `webNavigation`.

## 2. Privacy by Default

- Zero telemetry, analytics SDKs, or cloud tracking.
- Scans run locally in the active tab context.
- Never extract, record, or persist user inputs, password fields, cookies, session tokens, or local storage from audited pages.
- Provide full local history management: delete individual scans or clear all stored data with single-click confirmation.

## 3. Data Redaction on Export

- Export services must provide toggleable redaction controls:
  - Redact HTML excerpts.
  - Strip URL query parameters and sensitive path segments before generating JSON/HTML reports.

## 4. Content Security Policy (CSP)

- Strict Manifest V3 CSP: `script-src 'self'`.
- Disallow `eval`, remote script sources, and untrusted dynamic script tags.
