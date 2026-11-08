# Phantom Audit — Phase 9 Final Acceptance Criteria

## Master Measurable Verification Gates Across Security, Privacy, Accessibility & Release

**Document Version:** 1.0.0  
**Effective Phase:** Phase 9 (Security, Privacy & Accessibility Hardening)  
**Authority:** Root Specification `04_phantom_audit_project_spec_kiroween_2026.md`

---

## 1. Extension Security Boundary Criteria (SEC)

| Gate ID         | Criterion                    | Measurable Target                                                                                        | Verification Method                                                      |
| :-------------- | :--------------------------- | :------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| **SEC-CRIT-01** | Manifest CSP Strictness      | `script-src 'self'; object-src 'none';`                                                                  | Production manifest `.output/chrome-mv3/manifest.json` verification test |
| **SEC-CRIT-02** | Zero Remotely Hosted Code    | Zero external CDN URLs in HTML, JS, or manifests                                                         | Static repository analysis + build artifact regex scan                   |
| **SEC-CRIT-03** | Manifest Permissions         | Strictly `["activeTab", "scripting", "storage"]`                                                         | Manifest schema check; 0 excess or wildcard host permissions             |
| **SEC-CRIT-04** | Sender Origin Validation     | 100% of background runtime messages validated against `chrome.runtime.id`                                | `tests/unit/security/security-boundaries.test.ts` passing                |
| **SEC-CRIT-05** | Query Parameter Sanitization | All dashboard navigation query params validated against safe schema                                      | `query-validator.test.ts` passing                                        |
| **SEC-CRIT-06** | HTML Snippet XSS Immunity    | All affected element excerpts rendered strictly as text (`<pre><code>`) with 0 `dangerouslySetInnerHTML` | AST / Grep verification in `src/`                                        |

---

## 2. Privacy & Storage Integrity Criteria (PRIV)

| Gate ID          | Criterion                            | Measurable Target                                                                      | Verification Method                                                     |
| :--------------- | :----------------------------------- | :------------------------------------------------------------------------------------- | :---------------------------------------------------------------------- |
| **PRIV-CRIT-01** | Zero Unredacted URLs in Logs         | 0 plain URLs with query strings or hashes in console output                            | `tests/unit/security/privacy-hardening.test.ts` (14 assertions passing) |
| **PRIV-CRIT-02** | Sensitive Token & Password Redaction | Auth tokens, passwords, and API keys redacted to `[REDACTED]` or `[PASSWORD_REDACTED]` | Unit regex tests in `tests/unit/security/privacy-hardening.test.ts`     |
| **PRIV-CRIT-03** | Zero Remote Network Telemetry        | 0 outgoing network requests (fetch, XMLHttpRequest, Beacon)                            | Playwright network intercept check (`page.route('**', route.abort())`)  |
| **PRIV-CRIT-04** | Storage Quota & Bounded Capacity     | Max 50 scan snapshots in `chrome.storage.local` with FIFO eviction                     | Storage unit tests with 60 simulated sequential scans                   |
| **PRIV-CRIT-05** | Safe State Purge on Clear            | Clearing scan history resets active scan, comparison, and verification state           | Component lifecycle test in `history-components.test.tsx`               |

---

## 3. Interface Accessibility & Semantic Disambiguation Criteria (A11Y)

| Gate ID          | Criterion                                | Measurable Target                                                                      | Verification Method                                                                             |
| :--------------- | :--------------------------------------- | :------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------- |
| **A11Y-CRIT-01** | Automated axe-core Violations            | **Exactly 0 violations** for `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`    | `tests/e2e/phase9-accessibility.test.ts` across all 8 UI states                                 |
| **A11Y-CRIT-02** | Mansion Room Visible Focus (DEF-931)     | Purple dashed outline (`#c084fc`, 2px) fully visible on keyboard focus                 | Visual / DOM class check (`group` class on `<g>`, `opacity-100` on focus)                       |
| **A11Y-CRIT-03** | Mansion Room State Semantics             | `aria-pressed` explicitly communicates selection state                                 | DOM attribute test in `mansion.test.tsx`                                                        |
| **A11Y-CRIT-04** | Table Action Disambiguation (DEF-932)    | Every table inspect button has unique accessible name including room name              | DOM rotor query test: `getByRole('button', { name: /inspect the name chamber room details/i })` |
| **A11Y-CRIT-05** | History Inspect Disambiguation (DEF-933) | Every snapshot inspect button has unique accessible name including page title and date | DOM rotor query test in `history-components.test.tsx`                                           |
| **A11Y-CRIT-06** | Privacy Explainer Focus Trap (DEF-934)   | Tab and Shift+Tab strictly cycle inside `ActiveTabExplainer` modal                     | Unit & Playwright keyboard traversal test                                                       |
| **A11Y-CRIT-07** | Privacy Explainer Escape Key             | Pressing `Escape` closes modal immediately                                             | Keyboard event simulation test                                                                  |
| **A11Y-CRIT-08** | Focus Restoration on Modal Close         | Focus returns to initiating trigger button upon close of all 3 dialogs                 | Playwright & Testing Library focus assertions                                                   |
| **A11Y-CRIT-09** | Windows High Contrast / Forced Colors    | Text, borders, and interactive states remain visible in forced colors                  | Manual QA Protocol A checklist                                                                  |
| **A11Y-CRIT-10** | 200% and 400% Zoom Reflow                | No horizontal scrollbar on body at 200% zoom; readable text at 400%                    | Manual QA Protocol B checklist                                                                  |
| **A11Y-CRIT-11** | Reduced Motion Honored                   | Decorative pulse and spinning animations disabled when `reducedMotion` is true         | Unit test in `shared.test.tsx` + E2E verification                                               |
| **A11Y-CRIT-12** | Screen Reader Live Announcements         | Scan progress, snapshot loading, and archive purges announced via `role="status"`      | Testing Library live region text assertions                                                     |

---

## 4. Packaging, Performance & Build Release Criteria (REL)

| Gate ID         | Criterion                     | Measurable Target                          | Verification Method                |
| :-------------- | :---------------------------- | :----------------------------------------- | :--------------------------------- |
| **REL-CRIT-01** | TypeScript Strictness         | 0 type errors (`tsc --noEmit` exit code 0) | `pnpm typecheck`                   |
| **REL-CRIT-02** | ESLint Code Quality           | 0 errors, 0 warnings (`--max-warnings 0`)  | `pnpm lint`                        |
| **REL-CRIT-03** | Prettier Compliance           | 100% formatted                             | `pnpm format:check`                |
| **REL-CRIT-04** | Complete Unit Test Suite      | 100% passing (681+ tests, 0 failures)      | `pnpm test`                        |
| **REL-CRIT-05** | Complete Playwright E2E Suite | 100% passing (63+ tests across Chromium)   | `pnpm test:e2e`                    |
| **REL-CRIT-06** | Uncompressed Extension Size   | **< 3.5 MB** (current build: ~1.44 MB)     | PowerShell bundle size measurement |
| **REL-CRIT-07** | Compressed Extension ZIP Size | **< 1.0 MB**                               | `pnpm zip` archive measurement     |
| **REL-CRIT-08** | Clean Git Working Tree        | Zero untracked or uncommitted temp files   | `git status --porcelain` check     |

---

## Acceptance Sign-Off Matrix

When all 26 criteria across SEC, PRIV, A11Y, and REL are verified green, Phase 9 will be signed off as **COMPLETE** and the project will advance to Phase 10 (Performance & Browser Compatibility).
