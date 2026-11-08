# Phantom Audit — Phase 9 Execution Plan

## Security, Privacy & Accessibility Hardening

**Document Version:** 1.0.0  
**Phase:** Phase 9 of 12 — Security, Privacy & Accessibility Hardening  
**Execution Status:** PROPOSED — PENDING ARCHITECTURE REVIEW APPROVAL  
**Source of Truth:** `04_phantom_audit_project_spec_kiroween_2026.md`, `docs/PHASE_ROADMAP.md`, `docs/phase-9/PHASE_9_ARCHITECTURE_REVIEW.md`

---

## 1. Overview & Scope Boundaries

Phase 9 implements systematic hardening of **Phantom Audit** across its security boundaries, privacy safeguards, and user interface accessibility, fulfilling Sprint 6 of the authoritative project specification.

### Core Objectives:

1. **Security Hardening:** Enforce an explicit Manifest V3 Content Security Policy with `frame-ancestors 'none'` and `object-src 'none'`. Validate sender origin on all runtime messages in the background service worker. Sanitize dashboard query parameters on mount.
2. **Privacy Hardening:** Implement a privacy-safe logger utility that prevents raw error objects or sensitive URLs from appearing in extension developer logs. Verify complete and permanent erasure upon individual snapshot deletion and bulk history purge.
3. **Accessibility Hardening:** Eliminate semantic ambiguities by adding `aria-pressed` states to SVG mansion rooms and contextual `aria-label` descriptions to table and archive action buttons. Ensure modal focus trapping and Escape dismissal across all dialogs.
4. **Automated Dashboard axe-core Auditing:** Run locally bundled `axe-core` directly against all dashboard screens, states, modals, and drawers in Playwright E2E tests, verifying zero automated accessibility violations.
5. **Release Gate Verification:** Execute full regression suites across Phases 1 through 8, verify production bundle integrity (1.42 MB), and provide an actionable manual assistive technology testing protocol.

### Strict Scope Boundaries:

- **Zero Production Code in this Plan:** No implementation code is written until this plan is formally approved.
- **Zero Added Permissions:** Manifest permissions remain strictly `["activeTab", "scripting", "storage"]`.
- **Zero Remote Services / Telemetry:** The extension remains 100% local-first and user-initiated.
- **Zero New Dependencies:** Dashboard axe-core testing utilizes our already-bundled, audited `public/vendor/axe.min.js`.
- **Zero Unrelated Redesigns:** The Haunted Victorian Mansion design tokens and layout are preserved.

---

## 2. Workstream Dependency Graph

```mermaid
flowchart TD
    WS1["Workstream 1: Extension Security Boundary, CSP & Message Origin Verification"]
    WS2["Workstream 2: Privacy Hardening, Logger Safety & Storage Integrity"]
    WS3["Workstream 3: Interface Accessibility Hardening & Semantic Disambiguation"]
    WS4["Workstream 4: Automated Dashboard axe-core Audit & E2E A11y Suite"]
    WS5["Workstream 5: Final Release Gate, Regression Verification & Manual QA"]

    WS1 --> WS2
    WS2 --> WS3
    WS3 --> WS4
    WS1 --> WS4
    WS4 --> WS5
    WS2 --> WS5
```

---

## 3. Detailed Workstream Specifications

### Workstream 1: Extension Security Boundary, CSP Hardening & Message Origin Verification

#### 1. Scope & Objective

Harden extension security by configuring an explicit Manifest V3 extension page CSP in `wxt.config.ts`, authenticating message sender origins in `background.ts`, and defensively sanitizing dashboard launch parameters.

#### 2. Files to Create / Modify

- **Modify:** `wxt.config.ts` — Declare `content_security_policy.extension_pages: "script-src 'self'; object-src 'none'; frame-ancestors 'none';"`.
- **Modify:** `src/entrypoints/background.ts` — Verify `sender.id === browser.runtime.id` in `onMessage`. Restrict `START_SCAN_REQUEST` strictly to internal extension dashboard callers (`sender.url?.startsWith(browser.runtime.getURL(''))`).
- **Modify:** `src/features/tab-management/use-target-tab.ts` — Sanitize `url` and `title` search parameters using `sanitizeUrlForStorage` and protocol validation.
- **Create:** `tests/unit/security/security-boundaries.test.ts` — Unit tests for message sender authentication, CSP configuration, and query parameter sanitization.

#### 3. Requirements Covered

- Root Spec Section 10.2 (Extension Security & CSP).
- SEC-001 (Manifest CSP frame-ancestors & object-src).
- SEC-002 (Service worker message sender validation).
- SEC-003 (Dashboard query parameter defense).

#### 4. Implementation Tasks

1. Update `wxt.config.ts` manifest object with `content_security_policy` configuration.
2. In `src/entrypoints/background.ts`, inspect `_sender`:
   - Reject with `VALIDATION_FAILED` if `_sender.id !== browser.runtime.id`.
   - For `START_SCAN_REQUEST`, verify that `_sender.url` starts with `browser.runtime.getURL('')`.
3. In `src/features/tab-management/use-target-tab.ts`, sanitize parsed `rawUrl` using `sanitizeUrlForStorage` and verify protocol is HTTP, HTTPS, or file.
4. Run `pnpm build` and verify `.output/chrome-mv3/manifest.json` reflects the hardened CSP.

#### 5. Verification & Tests

- `tests/unit/security/security-boundaries.test.ts`:
  - Rejects runtime messages from mismatched `sender.id`.
  - Rejects `START_SCAN_REQUEST` from non-dashboard origins.
  - Sanitizes credentialed or malformed query parameters on `useTargetTab` mount.
- Manifest verification test inspecting built `manifest.json`.

#### 6. Acceptance Criteria

- Built `manifest.json` contains `extension_pages: "script-src 'self'; object-src 'none'; frame-ancestors 'none';"`.
- Service worker drops unauthorized or spoofed messages without throwing unhandled exceptions.
- Zero TypeScript, ESLint, or build errors.

---

### Workstream 2: Privacy Hardening, Logger Safety & Storage Integrity

#### 1. Scope & Objective

Prevent accidental leakage of sensitive URLs or error traces in browser developer consoles and verify permanent erasure integrity upon individual snapshot deletion and history purge.

#### 2. Files to Create / Modify

- **Create:** `src/lib/logger.ts` — Privacy-safe logging utility (`logSafeWarning`, `logSafeError`) that strips sensitive URLs, tokens, and raw objects before printing.
- **Modify:** `src/entrypoints/dashboard/App.tsx` — Replace raw `console.warn` calls with `logSafeWarning`.
- **Modify:** `src/features/scanner/scanner-service.ts` — Ensure error propagation sanitizes internal stack traces and URLs.
- **Modify:** `src/lib/storage/index.ts` — Ensure storage service methods sanitize error outputs and confirm deletion completeness.
- **Create:** `tests/unit/security/privacy-hardening.test.ts` — Unit tests verifying logger sanitization, storage purge completeness, and token non-leakage.

#### 3. Requirements Covered

- Root Spec Section 10.1 (Privacy Defaults).
- Root Spec Section 10.4 (Threat Model — Sensitive page content leaks).
- PRIV-001 (Console error log privacy).

#### 4. Implementation Tasks

1. Create `src/lib/logger.ts`:
   - Extracts only `err.message` or pre-defined string codes.
   - Cleans any embedded URLs using `sanitizeUrlForStorage`.
   - In production builds, suppresses debug-level logging.
2. Refactor `App.tsx` and storage call sites to utilize `logSafeWarning` / `logSafeError`.
3. Verify `storageService.clearAllScans()` purges all snapshot history and summary records.

#### 5. Verification & Tests

- `tests/unit/security/privacy-hardening.test.ts`:
  - Logging an Error containing `https://user:pass@secret.com?token=1234` outputs only sanitized text (`[REDACTED]`).
  - Purging history leaves `phantom_scan_history_v1` and `phantom_scan_summaries_v1` completely empty.

#### 6. Acceptance Criteria

- Zero raw Error objects with unsanitized URLs logged to console.
- Storage purge removes 100% of historical scan records.
- Zero regressions in existing Phase 7 storage tests.

---

### Workstream 3: Interface Accessibility Hardening & Semantic Disambiguation

#### 1. Scope & Objective

Disambiguate interactive button accessible names, add ARIA pressed states to SVG room buttons, and ensure complete keyboard focus trapping and Escape dismissal across all modal dialogs.

#### 2. Files to Create / Modify

- **Modify:** `src/components/mansion/MansionRoom.tsx` — Add `aria-pressed={isSelected}` to `<g role="button">`.
- **Modify:** `src/components/mansion/RoomListView.tsx` — Add contextual `aria-label={isSelected ? `${room.name} selected`:`Inspect ${room.name}`}` to table action buttons.
- **Modify:** `src/components/history/ScanHistoryDrawer.tsx` — Add contextual `aria-label={`Inspect snapshot for ${summary.pageTitle} from ${formattedDate}`}` to snapshot inspect buttons.
- **Modify:** `src/components/scan/ActiveTabExplainer.tsx` — Implement standard focus trapping, outside-focus capture, and Escape dismiss matching `ExportReportDialog` pattern.
- **Create:** `tests/unit/components/accessibility-hardening.test.tsx` — Component tests verifying ARIA attributes, button names, focus trapping, and keyboard controls.

#### 3. Requirements Covered

- WCAG 2.4.4 (Link / Button Purpose in Context).
- WCAG 2.1.2 (No Keyboard Trap).
- WCAG 4.1.2 (Name, Role, Value).
- A11Y-001 through A11Y-004.

#### 4. Implementation Tasks

1. In `MansionRoom.tsx`, add `aria-pressed={isSelected}` to `<g role="button">`.
2. In `RoomListView.tsx`, add `aria-label` to the table row inspect button.
3. In `ScanHistoryDrawer.tsx`, add contextual `aria-label` to the card inspect button.
4. In `ActiveTabExplainer.tsx`, add `useRef`, Tab/Shift+Tab focus trap listener, and Escape key listener.
5. Review visible focus indicators on all interactive controls.

#### 5. Verification & Tests

- `tests/unit/components/accessibility-hardening.test.tsx`:
  - `MansionRoom` renders `aria-pressed="true"` when selected and `"false"` when unselected.
  - Table inspect button accessible name announces specific room (e.g., `"Inspect The Name Chamber"`).
  - Archive inspect button accessible name announces snapshot title and formatted date.
  - `ActiveTabExplainer` traps Tab focus and closes on Escape.

#### 6. Acceptance Criteria

- Every button across the dashboard has an unambiguous accessible name.
- SVG rooms programmatically announce their selected state to screen readers.
- All modal dialogs contain focus and dismiss cleanly via Escape.

---

### Workstream 4: Automated Dashboard axe-core Audit & Assistive Technology Test Suite

#### 1. Scope & Objective

Directly fulfill Section 13.5 of the project specification by executing automated `axe-core` accessibility audits against the Phantom Audit dashboard across all 4 key lifecycle views and all modal dialogs.

#### 2. Files to Create / Modify

- **Create:** `tests/e2e/phase9-dashboard-axe.test.ts` — Playwright E2E suite injecting `public/vendor/axe.min.js` into the dashboard context and running `axe.run()` against:
  1. Dormant / Unscanned State.
  2. Active Audited State (Mansion Map View).
  3. Active Audited State (Room List Table View).
  4. Finding Inspector Drawer Open.
  5. ActiveTab Privacy Explainer Dialog Open.
  6. The Archive Drawer Open.
  7. Cross-Scan Comparison View Active.
  8. Export Report Dialog Open.
- **Verify:** Zero `axe-core` violations across all states (WCAG 2.2 AA ruleset).

#### 3. Requirements Covered

- Root Spec Section 13.5 (Test Phantom Audit's own accessibility).
- Sprint 6 Task: Run axe-core against Phantom Audit dashboard.
- A11Y-005 (Automated dashboard accessibility validation).

#### 4. Implementation Tasks

1. Author `tests/e2e/phase9-dashboard-axe.test.ts`:
   - Helper function `runAxeAudit(page)` that injects `public/vendor/axe.min.js` (using zero external network dependencies) and invokes `axe.run(document)`.
   - Formats any violations with rule ID, impact, and selector for clear debugging.
2. Execute audits against each view mode and interactive state.
3. Verify zero violations with WCAG 2.0, 2.1, 2.2 Level AA tags.

#### 5. Verification & Tests

- `tests/e2e/phase9-dashboard-axe.test.ts`:
  - 8 distinct UI states evaluated against axe-core 4.14.0.
  - Expects `results.violations.length === 0`.

#### 6. Acceptance Criteria

- 100% pass rate: 0 axe-core violations on the Phantom Audit dashboard itself.
- Tests execute natively in Playwright real Chromium environment without third-party network downloads.

---

### Workstream 5: Final Release Gate, Regression Verification & Manual QA

#### 1. Scope & Objective

Conduct the master integration verification for Phase 9, verify zero regressions across Phases 1 through 8, ensure production build compliance (1.42 MB), and provide an actionable manual testing protocol for assistive technologies.

#### 2. Files to Create / Modify

- **Create:** `docs/phase-9/WORKSTREAM_5_FINAL_RELEASE_GATE_REPORT.md` — Formal release gate report documenting all audit results, defect remediations, and manual testing checklists.
- **Modify:** `docs/PHASE_ROADMAP.md` — Update Phase 9 status to completed upon sign-off.
- **Run:** Full validation suite (`pnpm validate`, `pnpm test:e2e`).

#### 3. Requirements Covered

- Master Release Gate for Phase 9.
- Regression verification for Phases 1–8.
- Manual QA testing matrix (Chrome, Edge, screen readers, contrast themes).

#### 4. Implementation Tasks

1. Execute complete unit test suite (`pnpm test`).
2. Execute complete Playwright E2E suite (`pnpm test:e2e`).
3. Verify production package sizing and manifest permissions.
4. Author comprehensive release gate report.

#### 5. Acceptance Criteria

- All quality gates pass with exit code 0.
- Zero open P0, P1, or P2 defects.
- Production bundle size <= 1.5 MB with zero unnecessary permissions.
- Independent audit sign-off.

---

## 4. Manual Assistive Technology Testing Protocol

While automated axe-core testing covers programmatic compliance (contrast, labels, ARIA syntax), human manual testing is required to verify real assistive technology experiences:

| Test ID       | Assistive Technology / Environment          | Test Scenario & Verification Steps                                                                                                                                      | Success Criteria                                                                                                                   |
| :------------ | :------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------- |
| **M-A11Y-01** | **NVDA / JAWS** (Windows)                   | 1. Open dashboard with NVDA active.<br>2. Tab through header, scan control bar, and mansion rooms.<br>3. Activate rooms with Enter/Space.<br>4. Open Finding Inspector. | Screen reader clearly announces room names, finding counts, and selected states (`aria-pressed`). Focus moves predictably.         |
| **M-A11Y-02** | **VoiceOver** (macOS)                       | 1. Navigate dashboard using VO cursor (Control+Option+Arrows).<br>2. Open The Archive drawer.<br>3. Inspect cards and delete confirmation.                              | Dialog roles announced. Delete confirmation group announced. Focus trapped within drawer while open.                               |
| **M-A11Y-03** | **Windows Contrast Themes** (High Contrast) | 1. Enable _Desert_ or _Aquatic_ high contrast mode in Windows Settings.<br>2. Open Phantom Audit dashboard.                                                             | High-contrast outlines visible on all cards, buttons, and SVG rooms. Text remains distinct and legible against system backgrounds. |
| **M-A11Y-04** | **200% & 400% Browser Zoom**                | 1. Zoom browser to 200%, then 400%.<br>2. Verify mansion map, table, filter bar, and findings list.                                                                     | Layout reflows vertically without horizontal scrollbar. No text overlaps or clipped buttons.                                       |
| **M-A11Y-05** | **Reduced Motion Preference**               | 1. Enable _Show animations in Windows: Off_ or toggle in-app Reduced Motion.<br>2. Expand/collapse finding cards and drawers.                                           | Transitions execute instantly without sliding, fading, or flickering animations.                                                   |

---

## 5. Scope Discipline & Risk Management

1. **No External Network Dependencies:**
   - Testing Phantom Audit's dashboard with axe-core uses our locally vendored `public/vendor/axe.min.js`. No npm package downloads or CDN links are introduced.
2. **Minimal Permissions Preserved:**
   - Permissions remain strictly `["activeTab", "scripting", "storage"]`. Zero additions.
3. **Architecture Preservation:**
   - No changes to scan domain contracts, storage keys, or comparison logic.
4. **Governance Rule:**
   - Stop and await explicit user approval after presenting this architecture review and execution plan.
   - Do NOT implement production code until approved.
