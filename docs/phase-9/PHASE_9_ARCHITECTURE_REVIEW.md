# Phantom Audit — Phase 9 Architecture Review

## Security, Privacy & Accessibility Hardening

**Document Version:** 1.0.0  
**Phase:** Phase 9 of 12 — Security, Privacy & Accessibility Hardening  
**Review Status:** ARCHITECTURE COMPLETE — AWAITING IMPLEMENTATION APPROVAL  
**Source of Truth:** `04_phantom_audit_project_spec_kiroween_2026.md`, `docs/PHASE_ROADMAP.md`

---

## 1. Executive Summary & Root Specification Traceability

Phase 9 represents the comprehensive **Security, Privacy & Accessibility Hardening** phase of **Phantom Audit** (corresponding to Sprint 6 of `04_phantom_audit_project_spec_kiroween_2026.md`).

The foundational principle of Phantom Audit is:

> _"Ensure the accessibility scanner is itself accessible, secure, and respectful of user privacy."_

While Phases 1 through 8 established robust core features (Mansion UI, active-tab injection, scanner engine, finding identity, remediation catalog, local history, and privacy-first reporting), Phase 9 performs a systematic hardening audit across the entire extension surface. It identifies and eliminates subtle security trust boundary gaps, prevents potential privacy leakages in logs and error traces, disambiguates screen reader accessible names, verifies WCAG 2.2 Level AA compliance on the dashboard itself via automated in-page `axe-core` audits, and hardens extension configuration against framing and clickjacking.

### 1.1 Specification Traceability Matrix

| Requirement ID     | Specification Requirement                                                                                                                                                           | Priority | Architectural Hardening Scope in Phase 9                                                                                                                                                                                                    |
| :----------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Section 10.1**   | **Privacy Defaults:** Scan only upon explicit invocation; process locally; zero telemetry; redact sensitive excerpts; allow complete history deletion.                              |  **P0**  | Verify complete isolation of page DOM processing; audit error handling to ensure zero unredacted URLs or tokens leak to console; verify permanent erasure on single/clear-all storage actions.                                              |
| **Section 10.2**   | **Extension Security:** Manifest V3; local axe-core bundling; strict CSP; message sender validation; untrusted page input escaping; zero broad host permissions.                    |  **P0**  | Hardening `manifest.json` CSP with explicit `extension_pages` policy (`script-src 'self'; object-src 'none'; frame-ancestors 'none'`); validating message sender origins in background service worker (`sender.id === browser.runtime.id`). |
| **Section 10.4**   | **Threat Model:** Protect against malicious page DOM exploiting dashboard, malformed scan results, excessive permissions, and misleading compliance claims.                         |  **P0**  | Formalize complete Threat Model and Risk Register; implement defensive hardening against all identified P1/P2 risks; verify AST text-only rendering across all components.                                                                  |
| **Section 11**     | **Accessibility Methodology & Limitations:** Zero false compliance claims; explicit disclosure of 30–50% automated tool limits; manual review checklist.                            |  **P0**  | Ensure disclosures are prominent across all screens (not just export modal); verify no misleading "100% accessible" claims exist across any UI view or documentation.                                                                       |
| **Section 13.5**   | **Test Phantom Audit's Own Accessibility:** Run automated axe-core audit against extension dashboard; keyboard-only flow; screen reader names; focus order; contrast; zoom; reflow. |  **P0**  | Integrate automated dashboard auditing using locally bundled axe-core; disambiguate accessible names (`aria-label`) on interactive cards and table buttons; add `aria-pressed` to SVG rooms.                                                |
| **Sprint 6 Tasks** | **Hardening Tasks:** Reduced-motion support; keyboard navigation and focus management; semantic text alternatives to mansion; safe error handling for large DOMs.                   |  **P0**  | Verify `@media (prefers-reduced-motion)` and in-app motion toggle across all components; ensure zero keyboard traps; verify reflow at 200% zoom without horizontal scrolling.                                                               |

---

## 2. Deep Security Review

### 2.1 Manifest V3 Configuration & Extension Security Boundaries

#### 2.1.1 Permission Least-Privilege Verification

The current production manifest ([`.output/chrome-mv3/manifest.json`](file:///c:/Users/Atul2/OneDrive/Desktop/KiroHackethon/phantom/.output/chrome-mv3/manifest.json)) declares:

```json
{
  "manifest_version": 3,
  "name": "Phantom Audit — Haunted Mansion Accessibility Auditor",
  "version": "0.1.0",
  "permissions": ["activeTab", "scripting", "storage"]
}
```

- **`activeTab`:** Granted strictly upon user gesture (clicking the extension action icon). Does not grant persistent host access or background web traffic interception.
- **`scripting`:** Used strictly to inject `vendor/axe.min.js` and `runInPageAxeScan` into the user-selected active tab.
- **`storage`:** Used exclusively for `chrome.storage.local` persistence of scan summaries and remediation notes.
- **Zero Excessive Permissions:** No `downloads` permission, no `webRequest`, no `cookies`, no `<all_urls>` or `http://*/*` host permissions.

#### 2.1.2 Content Security Policy (CSP) Hardening

- **Current State:** The extension currently relies on the default Manifest V3 extension page CSP (`script-src 'self'; object-src 'self';`).
- **Security Finding (SEC-001):** The default CSP permits `object-src 'self'` and does not define `frame-ancestors 'none'`. If another extension or privileged context attempts to frame `dashboard.html`, clickjacking or UI redress attacks are theoretically possible.
- **Hardening Recommendation:** Explicitly declare `content_security_policy.extension_pages` in `wxt.config.ts`:
  ```json
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'none'; frame-ancestors 'none';"
  }
  ```
  This eliminates object embedding and guarantees that the Phantom Audit dashboard cannot be framed by any origin.

### 2.2 Service Worker Communication & Message Trust Boundaries

#### 2.2.1 Sender Origin Verification

- **Current State:** In `src/entrypoints/background.ts`:
  ```ts
  browser.runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
    const parseResult = RequestMessageSchema.safeParse(rawMessage);
    ...
  });
  ```
- **Security Finding (SEC-002):** The `_sender` parameter is currently unused. While Phantom Audit does not specify `externally_connectable` in its manifest (preventing regular web pages from calling `chrome.runtime.sendMessage`), any script running within the extension ID (such as an injected content script or frame) could theoretically dispatch messages to the service worker.
- **Hardening Recommendation:**
  1. Verify `sender.id === browser.runtime.id`.
  2. For privileged commands like `START_SCAN_REQUEST`, verify that the sender is an internal extension dashboard tab (`sender.url?.startsWith(browser.runtime.getURL(''))`) rather than a script injected into a web page.

#### 2.2.2 Message Schema Validation

- All incoming messages are validated via Zod (`RequestMessageSchema.safeParse`). Unknown or malformed message structures are immediately rejected with code `VALIDATION_FAILED` without executing background logic or crashing the service worker.

### 2.3 Active-Tab Access & Scanner Script Injection

#### 2.3.1 Restricted Page Protection

- Before injecting scripts or executing scans, `validateTabEligibility` (`src/features/tab-management/url-validator.ts`) enforces strict scheme allowlisting:
  - Allowed: `http:`, `https:`, `file:`.
  - Disallowed: `chrome:`, `chrome-extension:`, `devtools:`, `edge:`, `about:`, `view-source:`, `data:`, `blob:`.
- Ineligible tabs immediately display an atmospheric warning notice, and the scan button is disabled (`aria-disabled="true"`).

#### 2.3.2 Execution World Isolation

- In `src/features/scanner/scanner-service.ts`, `chrome.scripting.executeScript` injects `vendor/axe.min.js` and `runInPageAxeScan`.
- By default in Chrome MV3, execution occurs in the `ISOLATED` world.
- The isolated world cannot access JavaScript prototypes, closures, or variables created by page scripts, and page scripts cannot tamper with or inspect the injected `axe` instance.
- Results returned to the extension service worker are pure JSON-serializable structured data clones, preventing prototype pollution or object-reference smuggling.

#### 2.3.3 Concurrency & Navigation Protection

- Concurrency locks (`tabTracker.isScanLocked(tabId)`) prevent duplicate concurrent scans on the same tab.
- Post-scan verification detects if the tab navigated during execution (`postTab.url !== initialTab.url`), safely aborting with `TAB_NAVIGATED` rather than associating stale results with a new page.
- 15-second timeout race prevents hung scripts on oversized or adversarial DOM structures.

### 2.4 DOM Inspection & Untrusted Content Rendering

#### 2.4.1 Zero `dangerouslySetInnerHTML` Policy

- A codebase-wide AST audit confirms **0 occurrences** of `dangerouslySetInnerHTML`, `eval()`, or `new Function()` in `src/`.
- All page-derived strings (element selectors, HTML snippets, failure summaries, page titles, URLs) are rendered as standard React child text nodes (`<code>{node.htmlExcerpt}</code>`, `<pre>{selector}</pre>`).
- React automatically applies text encoding, rendering malicious HTML tags (e.g. `<img src=x onerror=alert(1)>`) as inert text without executing scripts.

#### 2.4.2 In-Page HTML Excerpt Sanitization

- In `src/features/scanner/in-page-runner.ts`, `sanitizeExcerpt()` redacts:
  - Form field values: `value="..."` -> `value="[REDACTED]"`.
  - Password inputs: `type="password"` -> `value="[PASSWORD_REDACTED]"`.
  - Sensitive data attributes: `data-token`, `data-secret`, `data-auth`, `data-key`, `data-password`.
  - Bounded string length: truncated to `maxHtmlExcerptLength` (default 1,000 characters).

### 2.5 Local Storage Security

- Storage keys: `phantom_scan_history_v1`, `phantom_scan_summaries_v1`, `phantom_remediation_records_v1`, `phantom_user_preferences_v1`.
- Max snapshot retention: Enforces a strict FIFO ceiling of 50 snapshots.
- Storage sanitization: `sanitizeUrlForStorage` purges credentials (`user:pass@`), tokens, and auth queries before saving to disk.
- Zod schema validation: All records read from storage pass through `ScanRecordSchema.safeParse`. Corrupted or tampered records are rejected safely without crashing the dashboard.

### 2.6 Dependency & Supply Chain Security

- Production dependencies are pinned to exact versions:
  - `axe-core`: `4.14.0` (locally vendored in `public/vendor/axe.min.js`, license text included).
  - `react`: `^19.0.0`
  - `zod`: `^3.24.2`
  - `clsx`: `^2.1.1`, `tailwind-merge`: `^3.0.2`, `lucide-react`: `^1.16.0`
- Zero remote runtime scripts or external CDN links.
- `pnpm audit` verifies 0 known critical or high vulnerabilities.

---

## 3. Deep Privacy Review

### 3.1 Data Minimization & Local-First Processing

1. **Zero External Communication:**
   - Phantom Audit operates 100% locally on the user's machine.
   - Zero telemetry, zero analytics SDKs, zero remote logging, zero external APIs.
   - Network requests are physically impossible from the extension background service worker or dashboard (no network origins declared in manifest).
2. **User-Initiated Auditing:**
   - The scanner never runs automatically in the background or upon page load.
   - Audits execute solely when the user clicks the "Start Accessibility Audit" button on the dashboard.
3. **No Credential or State Storage:**
   - Phantom Audit never accesses, queries, or stores browser cookies, localStorage, sessionStorage, or IndexedDB from the audited tab.
   - Form inputs with `type="password"` or `name="token"` have their values scrubbed before leaving the target tab.

### 3.2 Console & Error Log Privacy (PRIV-001)

- **Audit Finding:** In several component catch handlers (e.g. `App.tsx` lines 127, 193, 248), errors are logged via `console.warn('Failed to persist scan record:', err)`. If `err` contains a full `ScanRecord` or URL string containing query parameters, sensitive URLs could appear in the extension Developer Tools console.
- **Hardening Recommendation:** Enforce a unified privacy-safe logger utility (`logSafeWarning`, `logSafeError`) that extracts only `err.message` or a predefined error code, ensuring no raw objects or unsanitized URLs are printed to browser logs.

### 3.3 Storage Erasure Integrity

- **Individual Snapshot Deletion:** `storageService.deleteScan(id)` immediately removes the snapshot from `phantom_scan_history_v1` and its summary from `phantom_scan_summaries_v1`.
- **Bulk History Purge:** Clicking "Purge All Past Hauntings" invokes `storageService.clearAllScans()`, resetting storage arrays to `[]`.
- **UI State Synchronization:** Deleting or purging historical snapshots immediately resets active UI inspection state, preventing orphaned references.

---

## 4. Deep Accessibility Review (WCAG 2.2 AA)

### 4.1 Interface Component Inspection & Semantic Gaps

| Component                                    | Current Implementation                                                           | Accessibility Finding / Gap                                                                                                                            | Hardening Action                                                                               |
| :------------------------------------------- | :------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| **`MansionRoom.tsx`** (SVG Room)             | Renders `<g role="button" tabIndex={0} aria-label="...">`.                       | **A11Y-001 (P2):** Lacks `aria-pressed={isSelected}` attribute. Screen reader users cannot programmatically determine if a room is currently selected. | Add `aria-pressed={isSelected}` to `<g role="button">`.                                        |
| **`RoomListView.tsx`** (Table View)          | Action button renders `<button>Inspect</button>` or `<button>Selected</button>`. | **A11Y-002 (P2):** Button accessible name lacks context ("Inspect", "Selected"). Violates WCAG 2.4.4 / 2.5.3 in rotor list of buttons.                 | Add explicit `aria-label={isSelected ? `${room.name} selected`:`Inspect ${room.name}`}`.       |
| **`ScanHistoryDrawer.tsx`** (Archive Cards)  | Card button renders `<button><Eye /><span>Inspect</span></button>`.              | **A11Y-003 (P2):** Card inspect button text is ambiguous ("Inspect") across 50 list items.                                                             | Add explicit `aria-label={`Inspect snapshot for ${summary.pageTitle} from ${formattedDate}`}`. |
| **`FindingInspector.tsx`** (Inspector Panel) | Close button renders `<button><X /></button>`.                                   | Verified: already has `aria-label="Close Finding Inspector"`.                                                                                          | Confirm focus restores to triggering finding card upon dismissal.                              |
| **`ExportReportDialog.tsx`** (Modal Dialog)  | WAI-ARIA modal dialog pattern.                                                   | Verified in Phase 8: `role="dialog"`, `aria-modal="true"`, focus trap, Escape dismiss.                                                                 | Verified compliant.                                                                            |
| **`ActiveTabExplainer.tsx`** (Privacy Modal) | Modal dialog explaining activeTab permission.                                    | Modal dialog should follow the same focus trap and Escape dismiss standard as Export dialog.                                                           | Verify focus trap and Escape key listener are fully implemented.                               |
| **`ComparisonSelector.tsx`** (Diff Selector) | Select dropdowns for baseline and target scans.                                  | Select elements must have explicit `<label>` associations and accessible descriptions.                                                                 | Verify `<label htmlFor="...">` and `aria-describedby` associations.                            |

### 4.2 Keyboard Navigation & Focus Management

1. **Focus Visibility:** All interactive buttons, cards, links, tabs, and form controls have high-visibility focus indicators (`focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none`).
2. **Keyboard Trap Prevention:**
   - Both the export modal and the scan history drawer implement robust Tab / Shift+Tab focus trapping.
   - Escape key dismisses modals and drawers, restoring focus to the button that triggered them.
3. **Skip-to-Content Link:** The dashboard header includes an accessible `<a href="#main-content" className="sr-only focus:not-sr-only ...">` skip link allowing keyboard users to bypass header controls directly to the primary workspace.

### 4.3 Color Contrast & Visual Design Hardening

1. **Text Contrast:**
   - Primary text (`#f3e8ff`, `#ffffff`) against dark base surfaces (`#0a0612`, `#120a1f`) achieves contrast ratios **> 15:1** (WCAG AAA requires 7:1).
   - Secondary text (`#cbd5e1`, `#94a3b8`) against surfaces achieves contrast ratios **> 7:1** (WCAG AA requires 4.5:1).
   - Muted helper text achieves **> 4.5:1**.
2. **Non-Color Severity Indicators:**
   - Room states use both atmospheric colors and explicit text badges (`Haunted (3 issues)`, `Quiet (0 issues)`, `Not Yet Checked`).
   - Finding severities use both color tokens and textual labels (`Critical`, `Serious`, `Moderate`, `Minor`).
   - Comparison categories use distinct icon indicators alongside labels (Checkmark for `verified-fix`, EyeOff for `disappeared`, MinusCircle for `unchanged`, AlertTriangle for `new`).

### 4.4 Zoom, Reflow & Reduced Motion

1. **Zoom & Reflow:** The dashboard is built with responsive Tailwind utilities (`grid-cols-1 md:grid-cols-2`, `flex-wrap`, relative rem units). It reflows cleanly up to 200% zoom without horizontal scrolling or clipping.
2. **Reduced Motion:**
   - All CSS animations and transitions are governed by `--motion-duration-*` design tokens.
   - When the user enables the in-app "Reduced Motion" toggle or system `prefers-reduced-motion` is active, transition durations collapse to `0.01ms`, instantly disabling motion and flickering.

---

## 5. Comprehensive Threat Model & Risk Register

| Risk ID      | Component                | Threat / Failure Scenario                                                                | Evidence / Reproduction                                                      | Severity | Existing Mitigation                                               | Recommended Hardening Action                                                                             | Required Regression Test                                                  |
| :----------- | :----------------------- | :--------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------- | :------: | :---------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------ |
| **SEC-001**  | `wxt.config.ts`          | Extension dashboard framed by external or malicious extension contexts (Clickjacking).   | Default MV3 CSP does not define `frame-ancestors 'none'`.                    |  **P2**  | None explicitly declared in manifest.                             | Add explicit `content_security_policy.extension_pages` with `frame-ancestors 'none'; object-src 'none'`. | Manifest inspection test verifying CSP header.                            |
| **SEC-002**  | `background.ts`          | Service worker message handler accepts requests from unexpected or external senders.     | `_sender` parameter in `browser.runtime.onMessage` is currently ignored.     |  **P2**  | Extension does not declare `externally_connectable`.              | Validate `sender.id === browser.runtime.id` and restrict `START_SCAN_REQUEST` to extension URLs.         | Unit test sending messages with spoofed/external sender ID.               |
| **SEC-003**  | `use-target-tab.ts`      | Malformed or adversarial URL in dashboard query parameters (e.g. `?url=javascript:...`). | Query parameter `url` decoded and validated via `validateTabEligibility`.    |  **P2**  | `validateTabEligibility` marks non-HTTP/HTTPS URLs as ineligible. | Sanitize query params on mount via `sanitizeUrlForStorage` and validate protocol explicitly.             | Unit test mounting `useTargetTab` with `javascript:` query URL.           |
| **PRIV-001** | `App.tsx`                | Console logs leak sensitive URLs or error traces in development/debugging environments.  | `console.warn` called with raw error objects containing scan URLs.           |  **P3**  | Low impact (local console only).                                  | Create and enforce `logSafeWarning` utility that strips sensitive payload details.                       | Unit test verifying logger outputs only clean error messages.             |
| **A11Y-001** | `MansionRoom.tsx`        | Screen reader users cannot determine if an SVG room is currently selected.               | `<g role="button">` lacks `aria-pressed` attribute.                          |  **P2**  | Card visually highlights with border and glow.                    | Add `aria-pressed={isSelected}` to `<g role="button">`.                                                  | Component test asserting `aria-pressed` toggles with `isSelected`.        |
| **A11Y-002** | `RoomListView.tsx`       | Action buttons in table view lack contextual room name in accessible name.               | Button text is simply "Inspect" or "Selected" without room identifier.       |  **P2**  | Room name is in same table row.                                   | Add `aria-label={isSelected ? `${room.name} selected`:`Inspect ${room.name}`}`.                          | Component test asserting button accessible name contains room name.       |
| **A11Y-003** | `ScanHistoryDrawer.tsx`  | Snapshot inspect buttons lack contextual accessible name in archive drawer.              | Button text is simply "Inspect" across up to 50 list items.                  |  **P2**  | Page title is in same article card.                               | Add `aria-label={`Inspect snapshot for ${summary.pageTitle} from ${formattedDate}`}`.                    | Component test asserting snapshot button has unambiguous accessible name. |
| **A11Y-004** | `ActiveTabExplainer.tsx` | Explainer modal lacks keyboard focus trapping or Escape dismiss listener.                | Modal dialog lacks comprehensive focus trap implementation.                  |  **P2**  | Has visible close button.                                         | Implement standard focus trap and Escape key dismiss matching Export dialog pattern.                     | Component test verifying Tab wrapping and Escape dismiss.                 |
| **A11Y-005** | Dashboard Shell          | Extension dashboard screens have undetected automated accessibility violations.          | Dashboard accessibility has not been audited via automated in-page axe-core. |  **P1**  | Manual styling against design tokens.                             | Create automated `@axe-core` test running axe against all 4 dashboard states and modals.                 | Playwright test executing `axe.run()` against all main dashboard screens. |

---

## 6. Architectural Hardening Decisions

### 6.1 Decision 1: Explicit Manifest Content Security Policy

- **Decision:** Declare `content_security_policy.extension_pages: "script-src 'self'; object-src 'none'; frame-ancestors 'none';"` in `wxt.config.ts`.
- **Rationale:** Ensures least-privilege defense against framing/clickjacking and disallows plugin/object embedding entirely.

### 6.2 Decision 2: Message Sender Authentication in Service Worker

- **Decision:** Check `sender.id === browser.runtime.id` in `background.ts`. For `START_SCAN_REQUEST`, confirm `sender.url` starts with `browser.runtime.getURL('')`.
- **Rationale:** Guarantees that only trusted extension dashboard pages can trigger axe-core execution on user tabs.

### 6.3 Decision 3: Semantic Name Disambiguation

- **Decision:** Add explicit `aria-label` attributes to table Inspect buttons, drawer Inspect buttons, and add `aria-pressed` to SVG room buttons.
- **Rationale:** Conforms directly to WCAG 2.4.4 (Link Purpose in Context) and WCAG 4.1.2 (Name, Role, Value).

### 6.4 Decision 4: Automated In-Page axe-core Dashboard Audit

- **Decision:** In Playwright tests, load `public/vendor/axe.min.js` into the dashboard page context and run `axe.run(document)` against all 4 core views (Dormant, Scanned, Historical, Comparison) and all dialogs (Export, ActiveTab, Archive).
- **Rationale:** Directly fulfills Section 13.5 of the project specification without introducing new external packages or network dependencies. Zero automated violations tolerance.

---

## 7. Conclusion & Next Steps

The Phase 9 architecture review confirms that Phantom Audit's core security, privacy, and accessibility architecture is exceptionally solid. The identified hardening opportunities (SEC-001 through SEC-003, PRIV-001, and A11Y-001 through A11Y-005) represent targeted improvements that elevate the extension to gold-standard release quality.

The execution plan detailing the 5 proposed workstreams is documented in [`docs/phase-9/PHASE_9_EXECUTION_PLAN.md`](file:///c:/Users/Atul2/OneDrive/Desktop/KiroHackethon/phantom/docs/phase-9/PHASE_9_EXECUTION_PLAN.md).
