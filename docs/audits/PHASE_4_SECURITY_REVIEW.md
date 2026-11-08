# Phase 4 — Security & Privacy Architecture Review

**Project:** Phantom Audit  
**Phase:** 4 of 12 (Local Accessibility Scanning Engine, axe-core Integration & Real WCAG Findings)  
**Date:** 2026-11-06  
**Auditor:** Application Security & Privacy Reviewer  
**Classification:** STRICT AUDIT — APPROVED

---

## 1. Executive Summary

Phase 4 introduces local DOM accessibility evaluation into Phantom Audit. As a privacy-first browser extension, all accessibility scanning is executed 100% locally within the user's browser sandbox using pinned, statically bundled `axe-core` (v4.14.0).

This security review independently audited the injection pipeline, execution context isolation, permission boundaries, data sanitization, CSP compliance, and third-party license integrity.

**Verdict: FULL COMPLIANCE.** No high, medium, or low security or privacy vulnerabilities were discovered.

---

## 2. Threat Modeling & Security Controls

### 2.1 Execution Context Isolation

- **Threat:** Malicious scripts on the audited target webpage intercepting, tampering with, or poisoning the accessibility auditing engine or reading extension internal states.
- **Control:** `chrome.scripting.executeScript` executes within Chrome's `ISOLATED` world by default. The isolated world possesses a separate JavaScript execution environment, prototype chain, and global object from the page scripts. Page scripts cannot access the extension's execution context, and the scanner cannot be spoofed by page-level JavaScript overrides.

### 2.2 Local Bundling vs. Remote Code Injection

- **Threat:** Supply chain compromise, remote code execution (RCE), or unverified code loading.
- **Control:** The extension strictly forbids any remote script loading. `axe-core` 4.14.0 is statically pinned in `package.json`, copied during build time via `scripts/copy-axe.js` into `public/vendor/axe.min.js`, and injected directly from the extension's local package via `files: ['vendor/axe.min.js']`. Zero external CDNs or endpoints are queried.

### 2.3 Network Privacy & Zero Telemetry

- **Threat:** Exfiltration of audited page URLs, DOM content, credentials, or accessibility findings to external analytics or telemetry services.
- **Control:**
  - Network requests during scan execution: **0**.
  - Background service worker external fetch calls: **0**.
  - Dashboard frontend external network calls: **0**.
  - All findings and metadata remain strictly in local memory and Chrome local storage.

### 2.4 HTML Excerpt Sanitization & Data Minimization

- **Threat:** Accumulation and exfiltration of sensitive DOM data (e.g., passwords, authentication tokens, PII) in audit findings.
- **Control:**
  - In-page runner applies `sanitizeExcerpt` capping HTML snippets to `500` characters (`SCANNER_CONFIG.limits.maxHtmlExcerptLength`).
  - Form input values (e.g., typed text, passwords) are not captured; only outer HTML element markup is extracted.
  - Node results per rule are truncated to `20` elements (`SCANNER_CONFIG.limits.maxNodesPerRule`) to avoid DOM bloat and denial-of-service memory pressure.
  - All HTML snippets rendered in the dashboard UI are text-escaped (rendered via text nodes), never using `dangerouslySetInnerHTML`.

### 2.5 Explicit User Gesture & Permission Minimization

- **Threat:** Unauthorized background surveillance of user browsing activity.
- **Control:**
  - Scans can only be triggered by an explicit user gesture: clicking the extension action icon or clicking the "Start Accessibility Audit" button in the dashboard.
  - The extension manifest contains minimal permissions:
    - `activeTab`: Scoped strictly to the tab explicitly focused upon user click.
    - `scripting`: Required to inject the local bundle into the explicitly selected tab.
    - `storage`: Required for local scan session persistence.
  - Zero host permissions (`<all_urls>` is absent).
  - Background service worker enforces URL validation before injection: restricted schemes (`chrome://`, `edge://`, `about:`, `chrome-extension://`, `devtools://`, Chrome Web Store) are rejected with `TAB_INELIGIBLE` without attempting injection.

### 2.6 Concurrency & Race Condition Prevention

- **Threat:** Multiple concurrent scan injections creating CPU lockups, duplicate findings, or orphaned injection handles.
- **Control:**
  - `tabTracker` provides atomic scan locking (`acquireScanLock(tabId)` / `releaseScanLock(tabId)`).
  - Concurrency attempts reject immediately with `CONCURRENCY_LOCKED`.
  - All injection paths wrap execution in `try ... finally` blocks, guaranteeing lock release regardless of success, rejection, timeout, or tab navigation.
  - A 15-second timeout (`SCANNER_CONFIG.timeoutMs`) enforces deterministic abort if axe-core encounters pathologic DOM structures.
  - Pre- and post-scan URL checks detect URL navigation during scanning, rejecting stale results with `TAB_NAVIGATED`.

---

## 3. Manifest & CSP Compliance

### 3.1 Content Security Policy

Manifest V3 enforces strict CSP:

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self';"
}
```

- No `unsafe-eval` is permitted or needed.
- No remote script sources are allowed.

### 3.2 Permissions Audit

| Permission  | Justification                                                       | Scope Minimized? |
| :---------- | :------------------------------------------------------------------ | :--------------- |
| `activeTab` | Access active target tab upon explicit user interaction             | YES              |
| `scripting` | Inject local `vendor/axe.min.js` and in-page runner into target tab | YES              |
| `storage`   | Save scan session records locally in `chrome.storage.local`         | YES              |

---

## 4. Open-Source License Compliance

- **Dependency:** `axe-core` version 4.14.0
- **License:** Mozilla Public License 2.0 (MPL-2.0)
- **Compliance Action:**
  - The full, verbatim license text is bundled directly in the distribution at `public/vendor/axe-core.LICENSE.txt` and verified in `.output/chrome-mv3/vendor/axe-core.LICENSE.txt`.
  - Source code synchronization is automated in `scripts/copy-axe.js`.
  - No proprietary restrictions or contradictory licensing terms have been introduced.

---

## 5. Security Audit Checklist

| Item                                                           | Result |
| :------------------------------------------------------------- | :----- |
| axe-core loaded from local bundle only                         | PASS   |
| Zero remote CDN dependencies                                   | PASS   |
| Isolated execution world utilized                              | PASS   |
| Restricted browser URLs rejected before injection              | PASS   |
| Atomic tab concurrency locking                                 | PASS   |
| 15s execution timeout enforced                                 | PASS   |
| Tab navigation detected and rejected                           | PASS   |
| Excerpts truncated and sanitized                               | PASS   |
| HTML snippets rendered safely as text                          | PASS   |
| Zero network requests during audit                             | PASS   |
| No automated fix application or DOM mutation of target website | PASS   |
| No telemetry, analytics, or external phone-home endpoints      | PASS   |
| MPL-2.0 license file bundled and distributed                   | PASS   |
