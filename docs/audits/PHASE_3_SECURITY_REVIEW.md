# Phase 3 — Security & Privacy Architecture Review

**Project:** Phantom Audit  
**Phase:** 3 of 12 (Browser Extension Integration, Active-Tab Management & Runtime Communication)  
**Date:** 2026-11-06  
**Auditor:** Application Security Engineer & Chromium Extension Architect  
**Classification:** Internal Audit / Public Disclosure Compliant  
**Status:** PASS — ZERO SECURITY DEFECTS DETECTED

---

## 1. Executive Summary

Phantom Audit is engineered as a strictly privacy-first Chromium browser extension. This security review evaluates the implementation of Phase 3, focusing on extension permissions, target tab isolation, URL scheme sanitization, inter-process communication contracts, Content Security Policy (CSP), and runtime threat surface.

**Key Findings:**

1. **Least-Privilege Manifest:** Operates exclusively with `activeTab`, `scripting`, and `storage`. Zero broad host permissions (`<all_urls>`, `*://*/*`) are present or requested.
2. **Ephemeral Permission Lifecycle:** User webpage access is bound strictly to explicit user interaction on the extension action, expiring automatically upon navigation or tab closure.
3. **Rigorous Message Validation:** All runtime messages between the React dashboard and background service worker are validated against Zod schemas, discarding malformed or untrusted payloads.
4. **Zero-Telemetry & Offline Isolation:** Zero remote network requests, zero telemetry beacons, zero external script dependencies, and zero persistent storage of scanned webpage DOM contents.
5. **Privileged Scheme Quarantine:** The URL Eligibility Engine prevents injection attempts into browser internals (`chrome://`, `edge://`, `about:`, `chrome-extension://`) and web stores.

---

## 2. Manifest V3 Permission Analysis

### 2.1 Granted Permissions Justification

| Permission  | Scope & Purpose                                                                               | Justification                                                                                                             | Risk Mitigation                                                                                                         |
| :---------- | :-------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------- |
| `activeTab` | Temporary privilege grant over the currently active tab when the extension action is clicked. | Allows Phantom Audit to obtain the tab's URL and title for accessibility auditing without ambient background permissions. | Privilege is ephemeral: revoked on tab navigation or closing. No ambient browsing history access.                       |
| `scripting` | Programmatic script execution API (`chrome.scripting`).                                       | Prerequisite for Phase 4 bundled local axe-core execution. In Phase 3, no scripts are injected.                           | Scripts can only be executed on activeTab-granted tabs; no remote or dynamic code strings permitted.                    |
| `storage`   | Local extension storage API (`chrome.storage.local`).                                         | Used for local user preferences (reduced motion, view mode) and local scan history comparison.                            | Storage is scoped strictly to the extension's private sandboxed origin (`chrome-extension://<id>`). Zero cloud syncing. |

### 2.2 Prohibited Permissions Audit

Phantom Audit strictly forbids the following high-risk permissions:

- **`<all_urls>` / `*://*/*` / Broad Host Permissions:**  
  _Risk:_ Ambient access to all user browsing sessions, network traffic, cookies, and sensitive session tokens across all open tabs.  
  _Posture:_ **STRICTLY REJECTED.** Phantom Audit never requests broad host access. Audits are exclusively opt-in per tab via `activeTab`.
- **`webNavigation` / `tabs` (full permission):**  
  _Risk:_ Global URL tracking across every tab the user visits, violating user privacy.  
  _Posture:_ **STRICTLY REJECTED.** The background worker listens only to `tabs.onRemoved` and `tabs.onUpdated` for specifically tracked target tab IDs.
- **`cookies` / `webRequest`:**  
  _Risk:_ Session hijacking and credential inspection.  
  _Posture:_ **STRICTLY REJECTED.** Phantom Audit has zero need or capability to inspect cookies or headers.

---

## 3. URL Eligibility & Scheme Quarantine

To prevent privilege escalation, sandbox bypasses, and extension crashes, `src/features/tab-management/url-validator.ts` enforces strict validation on target URLs before any tab management or messaging operations occur.

### 3.1 Scheme Verification Matrix

| Scheme / Target         | Example                              | Classification       | Engine Decision | Rationale                                                                |
| :---------------------- | :----------------------------------- | :------------------- | :-------------- | :----------------------------------------------------------------------- |
| `https://`              | `https://example.com`                | Standard Web         | **ELIGIBLE**    | Primary target for accessibility evaluation.                             |
| `http://`               | `http://localhost:3000`              | Local / Standard Web | **ELIGIBLE**    | Essential for local web development audits.                              |
| `file:///`              | `file:///C:/project/index.html`      | Local Filesystem     | **RESTRICTED**  | Requires user toggle "Allow access to file URLs" in chrome://extensions. |
| `chrome://`             | `chrome://settings`                  | Chrome Internal      | **INELIGIBLE**  | Privileged browser context; script injection forbidden by Chromium.      |
| `edge://`               | `edge://extensions`                  | Edge Internal        | **INELIGIBLE**  | Privileged browser context; script injection forbidden by Chromium.      |
| `about:`                | `about:blank`                        | Browser Pseudo-URL   | **INELIGIBLE**  | No meaningful accessibility tree; disallowed context.                    |
| `view-source:`          | `view-source:https://...`            | Source Viewer        | **INELIGIBLE**  | Internal Chromium debugging view.                                        |
| `chrome-extension://`   | `chrome-extension://abc/...`         | Extension Context    | **INELIGIBLE**  | Self-injection and cross-extension privilege boundary violation.         |
| `data:` / `javascript:` | `javascript:void(0)`                 | Inline Execution     | **INELIGIBLE**  | High-risk XSS vectors and invalid audit targets.                         |
| Chrome Web Store        | `chromewebstore.google.com`          | Web Store Gallery    | **INELIGIBLE**  | Hard-coded Chromium security boundary preventing extension injection.    |
| Edge Add-ons            | `microsoftedge.microsoft.com/addons` | Add-on Gallery       | **INELIGIBLE**  | Hard-coded Edge security boundary preventing extension injection.        |

---

## 4. Inter-Process Runtime Messaging Security

Communication between the isolated Dashboard tab and the Background Service Worker uses `browser.runtime.sendMessage` and `browser.runtime.onMessage`.

### 4.1 Schema Enforcement (Zod)

Every message received over the runtime bus is validated synchronously using Zod schemas (`src/lib/messaging/contracts.ts`):

```typescript
// Incoming message parser
const parseResult = RequestMessageSchema.safeParse(rawMessage);
if (!parseResult.success) {
  sendResponse({
    success: false,
    requestId: (rawMessage as any)?.requestId ?? 'unknown',
    error: {
      code: 'INVALID_REQUEST',
      message: 'Malformed message rejected by schema validation.',
      details: parseResult.error.format(),
    },
  });
  return true;
}
```

**Security Benefits:**

- **Zero Prototype Pollution:** Zod validates field structures without trusting `__proto__` or object prototypes.
- **Type Injection Defense:** Type mismatches (e.g., passing non-integer `tabId` or arbitrary command strings) fail fast before reaching business logic.
- **Fail-Safe Responses:** All rejections return structured, typed `ErrorResponse` objects with standard error codes.

### 4.2 Timeout & Stale Channel Mitigation

- The messaging client (`src/lib/messaging/client.ts`) wraps all transactions in a 5000 ms timeout.
- Unresponsive background workers or sleeping service workers do not hang the UI; the client emits a timeout exception that gracefully transitions the dashboard to an offline/reconnecting state.
- Duplicate concurrent scan requests are blocked via atomic `acquireScanLock(tabId)` in `TabTracker`.

---

## 5. Privacy Architecture & Zero Data Leakage

Phantom Audit adheres to strict data minimization and zero-knowledge principles:

1. **Ephemeral Memory Tracking:**
   - Target tab metadata (URL, title, timestamp) is held in an in-memory `Map<number, TargetTabInfo>` inside the background service worker.
   - When the user closes the target tab, `tabs.onRemoved` purges the entry immediately.
   - No tab history or URL logs are written to disk or synced across devices.
2. **Zero DOM & Content Retention:**
   - The extension stores zero webpage content, HTML strings, or form inputs.
   - All accessibility data (in Phase 4) will be processed in-memory and discarded upon session close unless explicitly exported by the user.
3. **No External Network Calls:**
   - The extension build contains zero `fetch()`, `XMLHttpRequest`, or `WebSocket` connections to external servers.
   - Zero analytics trackers (e.g., Google Analytics, Mixpanel, Sentry) are bundled.
   - Offline-capable: the extension functions fully in air-gapped or offline development environments.
4. **Rendering Security (Anti-XSS):**
   - Zero instances of `dangerouslySetInnerHTML` in the codebase.
   - Code snippets, URLs, and page titles are rendered as raw text inside semantic React elements (`<pre><code>`, `<span>`).

---

## 6. Content Security Policy (CSP) Compliance

Phantom Audit complies with strict Manifest V3 Content Security Policy directives:

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'"
}
```

- **`unsafe-eval` Prohibited:** No runtime code generation, string compilation, or `eval()` calls exist in the application code.
- **Remote Code Prohibited:** All scripts, stylesheets, fonts, and assets are locally bundled in the extension package.
- **Web Accessible Resources Restrained:** Only necessary extension UI assets are declared, preventing arbitrary website fingerprinting.

---

## 7. Threat Modeling Matrix (STRIDE)

| Threat Category            | Potential Attack Vector                                                              | Applied Mitigation in Phase 3                                                                                             | Residual Risk |
| :------------------------- | :----------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ | :------------ |
| **Spoofing**               | Malicious web page attempts to forge runtime messages to extension background.       | `browser.runtime.onMessage` rejects external senders. Only internal extension pages (`browser.runtime.id`) are processed. | Negligible    |
| **Tampering**              | Intercepting or altering messages between dashboard and background.                  | Messages travel across Chromium's internal IPC bus within the extension's isolated security origin.                       | None          |
| **Repudiation**            | Ambiguous scan request origin or tab target.                                         | Every request carries a cryptographically unique `requestId` (UUID v4) and explicit `tabId`.                              | None          |
| **Information Disclosure** | Leakage of inspected website URLs or credentials to third parties.                   | Zero network access, zero external APIs, zero disk persistence of target URLs.                                            | None          |
| **Denial of Service**      | Rapid spamming of "Start Audit" causing background exhaustion or memory leaks.       | Concurrency lock (`acquireScanLock`), 5-second client timeouts, and automatic lock release on errors.                     | Negligible    |
| **Elevation of Privilege** | Triggering extension execution on privileged browser settings (`chrome://settings`). | URL Eligibility Engine strictly denies non-HTTP/HTTPS/file targets with user-facing warnings.                             | None          |

---

## 8. Verification & Sign-off

- [x] Permission analysis verifies zero broad host permissions.
- [x] URL Eligibility Engine tested with 11 distinct scheme and host test cases.
- [x] Message validation tested with valid, invalid, and malformed payloads.
- [x] Source code audited for zero `dangerouslySetInnerHTML` and zero network requests.
- [x] CSP strictly conforms to Chromium Manifest V3 requirements.

**Security Verdict:** Formally Approved for Extension Integration. Ready for Phase 4 Scanner Engineering.
