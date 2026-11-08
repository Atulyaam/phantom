# Phase 4 — Scanner Architecture & Execution Model

**Document Version:** 1.0.0  
**Phase:** 4 of 12 (Local Accessibility Scanning Engine, axe-core Integration & Real WCAG Findings)  
**Date:** 2026-11-06  
**Author:** Accessibility Testing Engineer & Chromium MV3 Architect  
**Status:** APPROVED ARCHITECTURAL SPECIFICATION

---

## 1. Executive Summary

Phase 4 transforms Phantom Audit into a fully functional, local-first accessibility auditor. The scanning engine operates directly against the active browser tab selected by the user, utilizing a locally bundled distribution of Deque's open-source `axe-core` library.

**Key Architecture Principles:**

1. **Local-First & Offline:** 100% of scanning logic and the `axe-core` engine are bundled inside the extension package. Zero remote scripts, zero CDN dependencies, zero telemetry.
2. **Explicit User-Gesture Activation:** Scanning is never automatic or ambient. It is initiated solely when the user clicks "Start Audit" / "Scan Page" in the Phantom Audit dashboard.
3. **Execution World Isolation:** `axe-core` executes inside the target tab within Chromium's `ISOLATED` world via `chrome.scripting.executeScript`, protecting the extension from page script tampering and protecting the host page from extension modifications.
4. **Strict WCAG Conformance Truthfulness:** Results explicitly differentiate confirmed automated **Violations**, items requiring **Manual Review (Incomplete)**, and automated **Passes**. Zero false "WCAG Certified" claims are made.
5. **Fail-Safe Resource Management:** 15-second execution timeout, concurrency locks, and deterministic error handling ensure browser stability across large or complex DOM trees.

---

## 2. End-to-End Scanning Execution Flow

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│                      Phantom Audit Dashboard (Extension Tab)                       │
│  - User reviews Target Tab metadata (URL, domain, connection status)               │
│  - User explicitly clicks "Start Accessibility Audit"                              │
│  - UI sets local state: 'validating' -> 'scanning'                                 │
└────────────────────────────────────────┬──────────────────────────────────────────┘
                                         │
                             START_SCAN_REQUEST (Zod)
                       browser.runtime.sendMessage(tabId)
                                         │
                                         ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                     Background Service Worker (MV3 Lifecycle)                     │
│  1. Verifies Concurrency Lock: rejects duplicate requests if tab is locked         │
│  2. Validates Target Tab: checks tab existence and URL eligibility                │
│  3. Acquires Tab Concurrency Lock (activeTab grant verified)                      │
│  4. Enforces 15-Second Execution Timeout wrapper                                   │
└────────────────────────────────────────┬──────────────────────────────────────────┘
                                         │
                    chrome.scripting.executeScript (ISOLATED World)
                     [1. Inject axe.min.js; 2. Run scanRunner()]
                                         │
                                         ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                       Target Tab Context (Isolated World)                         │
│  - axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] })  │
│  - Captures: violations, passes, incomplete, inapplicable                         │
│  - Truncates HTML excerpts to safe character limits (< 1000 chars)                │
│  - Limits node targets to prevent oversized IPC payloads (max 20 per rule)         │
│  - Returns structured raw payload back to Service Worker                          │
└────────────────────────────────────────┬──────────────────────────────────────────┘
                                         │
                                Raw Axe Results
                                         │
                                         ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                   Background Normalizer & State Pipeline                          │
│  1. Releases Tab Concurrency Lock (in finally block)                              │
│  2. Maps axe rules to 7 Mansion Rooms (via room-mapper.ts)                        │
│  3. Generates canonical fingerprints (v1:ruleId:sortedTargets)                    │
│  4. Builds validated ScanRecord (schemaVersion: 1) via Zod schemas                │
│  5. Returns START_SCAN_RESPONSE or broadcasts SCAN_COMPLETED_EVENT                │
└────────────────────────────────────────┬──────────────────────────────────────────┘
                                         │
                               Validated ScanRecord
                                         │
                                         ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                      Dashboard View & Room Synchronization                        │
│  - Replaces empty / dormant state with Real Scan findings                          │
│  - Displays REAL SCAN badge (clearly distinguished from DEMO mode)                │
│  - Updates Mansion Room visual states:                                             │
│      * Haunted: 1 or more confirmed violations                                    │
│      * Quiet: Scanned with 0 violations                                            │
│      * Not-Checked: Unscanned / bypassed                                          │
│  - Updates Accessible Table View & Finding Inspector with real DOM targets         │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Responsibilities

### 3.1 Background Service Worker (`src/entrypoints/background.ts`)

- Serves as the central IPC controller between the dashboard and target tabs.
- Manages `tabTracker` state and ensures atomic lock acquisition (`acquireScanLock(tabId)`).
- Coordinates `chrome.scripting.executeScript` injections.
- Catches runtime errors (e.g., target tab closed mid-scan, page navigation, script injection security exceptions) and returns structured `ErrorResponse` objects with lock release.

### 3.2 Scanner Service (`src/features/scanner/scanner-service.ts`)

- Encapsulates script injection and execution logic.
- Defines standard `axe-core` scan options (WCAG 2.0, 2.1, 2.2 A/AA rules + best practices).
- Bundles the in-page evaluation function (`evaluateAxeInPage`).
- Implements a 15,000 ms timeout race against `axe.run`.
- Strips excess payload bulk before IPC transmission.

### 3.3 Result Normalizer (`src/features/normalization/axe-normalizer.ts`)

- Translates axe-core's `AxeResults` into Phantom Audit's validated `ScanRecord` and `FindingRecord[]`.
- Computes deterministic room assignment using `mapRuleToRoom(ruleId)`.
- Calculates stable canonical fingerprints using `generateFindingFingerprint(ruleId, targets)`.
- Sanitizes and truncates node selectors and HTML snippets.

### 3.4 Dashboard UI (`src/entrypoints/dashboard/App.tsx`)

- Provides user controls for initiating, monitoring, and inspecting scans.
- Visualizes real scan metadata (timestamp, target URL, violation counts, manual review counts, passes).
- Provides instant toggling between Mansion Map and Accessible Table views.
- Maintains strict distinction between Demo fixtures and live browser audit findings.

---

## 4. Injection Strategy & Security Boundaries

### 4.1 Execution World

`chrome.scripting.executeScript` is configured to run in Chromium's default `ISOLATED` world:

- **Tamper Resistance:** Scripts running on the inspected page (such as prototype modifications or anti-extension scripts) cannot access `window.axe` or alter extension data.
- **Page Safety:** The extension does not pollute or override global page variables, preventing unintended side effects or website breakage.

### 4.2 Script Packaging

- `axe.min.js` is bundled locally into the extension distribution (`public/vendor/axe.min.js` or through WXT build assets).
- No code is ever fetched from `unpkg.com`, `cdnjs.cloudflare.com`, or any remote URL.
- Zero `eval()`, `new Function()`, or dynamic string execution.

---

## 5. Result Classification Matrix

| axe-core Category  | Phantom Audit Classification | UI Presentation                                                           | WCAG Interpretation                                                                                                                  |
| :----------------- | :--------------------------- | :------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------- |
| **`violations`**   | Confirmed Automated Finding  | Haunted room; red/orange severity badge; actionable remediation guidance. | Automated test failure against a specific WCAG Success Criterion.                                                                    |
| **`incomplete`**   | Needs Manual Review          | Manual Review badge; amber status; guidance on manual inspection.         | Rule could not definitively confirm pass or fail automatically (e.g., color contrast on gradient background). Requires human tester. |
| **`passes`**       | Automated Pass               | Included in summary counters; Quiet room if zero violations exist.        | Evaluated elements passed automated checks. **Does NOT imply 100% WCAG conformance.**                                                |
| **`inapplicable`** | Inapplicable                 | Included in scan metadata totals; omitted from room findings.             | Elements relevant to the rule do not exist on the page (e.g., no `<video>` tags for captions check).                                 |

---

## 6. Architectural Risk Assessment & Mitigations

| Risk                                                                                                                                      | Impact                                                     | Architecture Mitigation                                                                                  |
| :---------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- |
| **Large DOM Hangs:** Massive pages (e.g. 10,000+ DOM nodes) cause `axe.run` to take excessive time.                                       | Extension UI freezes or times out.                         | Strict 15-second execution timeout; per-rule node cap (max 20 nodes); background processing.             |
| **IPC Payload Exceeded:** Hundreds of violations with large HTML snippets exceed Chrome messaging limits (64 MB max, recommended < 1 MB). | IPC message serialization failure.                         | Normalizer truncates excerpts to 500 characters and limits recorded nodes per rule to 20.                |
| **Target Tab Closed During Scan:** User closes the inspected tab while `axe.run` is executing.                                            | Script injection throws unhandled promise rejection.       | Try/catch around injection; background tab listener catches `tabs.onRemoved`; lock released immediately. |
| **Tab Navigates During Scan:** User navigates to a new URL while scan is in flight.                                                       | Results belong to previous page; grant may be invalidated. | Scan service validates tab URL before and after scan; discards stale results if URL changed.             |
| **Misleading Compliance Claims:** Developer assumes 0 violations means the site is 100% accessible.                                       | Legal and usability hazards for users with disabilities.   | Persistent disclaimer: automated scanning detects ~30-50% of WCAG issues; manual testing required.       |

---

## 7. Verification Checklist for Phase 4

- [ ] `axe-core` pinned and bundled locally without CDN dependencies.
- [ ] License notices for axe-core preserved.
- [ ] Injection occurs strictly upon user action on the verified active tab.
- [ ] 15s timeout protects against unresponsive tabs.
- [ ] Concurrency lock prevents duplicate scans.
- [ ] Violations, passes, incomplete, and inapplicable results captured accurately.
- [ ] Normalizer produces valid `ScanRecord` conforming to Zod schemas.
- [ ] Dashboard displays genuine findings and distinguishes REAL SCAN from DEMO mode.
- [ ] Controlled test fixtures verify real findings across all 7 mansion rooms.
