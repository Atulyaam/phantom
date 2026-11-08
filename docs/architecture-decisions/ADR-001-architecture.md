# ADR-001: Core Architecture, Technology Stack & Extension Boundaries

**Status:** Accepted  
**Date:** 2026-11-06  
**Deciders:** Coordinated Senior Engineering Team (Architect, Extension, React, Security, Accessibility, QA)  
**Consulted:** Kiroween 2026 Phantom Audit Specification (`04_phantom_audit_project_spec_kiroween_2026.md`)

---

## 1. Context and Problem Statement

Phantom Audit requires a lightweight, privacy-first, secure Chromium extension that performs local accessibility audits using `axe-core`, presents findings through an interactive haunted-mansion interface, supports rescan comparisons, and exports reports.

We must select an architecture that:

1. Conforms to Chrome/Edge Manifest V3 (MV3) security, lifecycle, and service worker constraints.
2. Ensures that page scanning occurs strictly locally with user-initiated permissions.
3. Provides high developer velocity, type safety, deterministic builds, and fast automated testing.
4. Avoids bloat, unnecessary cloud dependencies, or unneeded runtime layers (such as Next.js, external databases, or heavy 3D engines).

---

## 2. Decision Drivers

- **Security & Privacy:** Local-first analysis; no telemetry, remote script execution, or cloud data storage in MVP.
- **Manifest V3 Stability:** Robust handling of background service worker termination, active tab permissions, and extension communication.
- **Performance:** Sub-2.5s initial dashboard load; extension package size under 5 MB compressed.
- **Accessibility:** 100% compliant with self-accessibility goals (WCAG 2.2 AA target), full keyboard support, visible focus, reduced-motion adherence, and screen-reader announcements.
- **Maintainability & Modularity:** Clear separation between extension background runtime, dashboard UI, scanner adapter, domain models, validation, and storage.

---

## 3. Considered Options

1. **Option A: WXT + React 19 + TypeScript + Tailwind CSS (Selected)**
   - Specialized Next-gen Web Extension framework built on Vite.
   - Native support for file-based entrypoints (background, dashboard, popup).
   - Strict TypeScript, lightning-fast HMR, automatic Manifest V3 generation, and unified asset bundling.
   - 2D SVG/CSS Mansion visualization (zero Three.js overhead).

2. **Option B: Next.js + Standalone Web App + Companion Extension**
   - _Rejected:_ Violates local-first architecture; introduces unnecessary server infrastructure, CORS complexity, and potential data transmission risks.

3. **Option C: Plain Webpack / Vite custom extension boilerplate**
   - _Rejected:_ Requires maintaining hundreds of lines of brittle manifest-handling, polyfills, reload scripts, and browser-specific build scripts without the tested abstractions of WXT.

4. **Option D: Three.js 3D Mansion Canvas**
   - _Rejected:_ Adds 600KB+ to bundle size, introduces canvas accessibility barriers (inaccessible to screen readers without extensive shadow DOM trees), drains mobile laptop battery, and violates the "useful before beautiful" principle.

---

## 4. Decision Outcome

We choose **Option A: WXT + React + TypeScript + Tailwind CSS + Zod + Vitest + fast-check + Playwright**.

### Chosen Stack Components:

- **Package Manager:** `pnpm` (fast, deterministic, strict dependency isolation).
- **Extension Framework:** `WXT` (`wxt`).
- **Language:** TypeScript 5.x in strict mode (`strict: true`, `noImplicitAny: true`, `exactOptionalPropertyTypes: true`).
- **UI Framework:** React 19 + ReactDOM.
- **Styling & Tokens:** Tailwind CSS + CSS Custom Properties (`tokens.css`) for gothic-mansion palette and WCAG contrast compliance.
- **Data Validation:** `Zod` (schema validation at all untrusted boundaries, including extension messages and storage).
- **Unit & Property Testing:** `Vitest` and `fast-check`.
- **End-to-End & Smoke Testing:** `Playwright`.
- **Code Quality:** ESLint (`typescript-eslint`) + Prettier.

---

## 5. Architectural Boundaries & Module Responsibilities

The system is partitioned into isolated layers with unidirectional data flow:

```text
┌─────────────────────────────────────────────────────────────────┐
│                       Extension Runtime                         │
│  - background.ts (Service Worker)                               │
│  - Captures activeTab gesture, manages tab context               │
│  - Validates tab eligibility (rejects chrome://, edge://, etc.) │
└──────────────┬──────────────────────────────────────────────────┘
               │ chrome.runtime.sendMessage / chrome.tabs
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Dashboard UI (React)                      │
│  - Entrypoint: src/entrypoints/dashboard/                       │
│  - Mansion View (2D SVG Room Map with text alternative)         │
│  - Findings Inspector (Rule ID, selector, safe snippet, fix)    │
│  - Scan Comparison & Local History                              │
│  - Accessible design tokens, reduced-motion controls            │
└──────────────┬──────────────────────────────────────────────────┘
               │ calls
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Scanner Controller                        │
│  - Coordinates scan execution via chrome.scripting.executeScript│
│  - Injects bundled public/axe.min.js                            │
│  - Enforces scan timeout (15s) and duplicate-scan debounce      │
└──────────────┬──────────────────────────────────────────────────┘
               │ returns raw axe output
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Result Normalizer                         │
│  - Zod parsing & validation of raw scanner output               │
│  - Generates deterministic finding fingerprints                 │
│  - Maps rule IDs to Mansion Rooms (Name Chamber, Contrast Crypt)│
│  - Sanitizes and length-limits HTML excerpts (XSS prevention)   │
└──────────────┬──────────────────────────────────────────────────┘
               │ produces ScanRecord
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Local Persistence                         │
│  - chrome.storage.local wrapper (typed, validated via Zod)      │
│  - IndexedDB for large scan snapshots (if required)             │
│  - Export / Import service (JSON / HTML with redaction)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Permissions and Security Boundaries

1. **Permissions Policy:**
   - Manifest permissions limited strictly to:
     - `activeTab`: temporary access granted only upon explicit user invocation.
     - `scripting`: injects the locally bundled scanner script.
     - `storage`: local persistence for scan snapshots, preferences, and comparison history.
   - **Prohibited Permissions:** No `<all_urls>`, broad host permissions, webRequest, or cookies permissions.

2. **Content Security Policy (CSP):**
   - MV3 default CSP enforced: `script-src 'self'`.
   - Disallows `eval()`, inline scripts, and remote code loading.
   - Scanner bundle (`axe.min.js`) must be packaged locally within extension assets.

3. **Untrusted Data Handling:**
   - DOM excerpts and CSS selectors extracted from target pages are treated as untrusted strings.
   - Zero use of `dangerouslySetInnerHTML`. All snippets rendered using safe text containers or syntax-highlighted code blocks with explicit escaping.

---

## 7. Performance and Bundle Strategy

- Sub-2.5s initial usable dashboard render.
- Compressed extension build target: < 3.5 MB (budget limit 5.0 MB).
- Fast local property-based and unit tests with Vitest (< 2s execution).
- SVG-based 2D mansion rendering ensures zero GPU overhead and instant responsive reflow.

---

## 8. Future Extension Points

- **Phase 2+ Integration:** Pluggable axe-core rule configurations and custom audit checks.
- **Rule Guidance Catalog:** Curated, extensible JSON/TypeScript guidance dictionary with WCAG 2.2 mappings and remediation code samples.
- **Report Redaction Engine:** Configurable privacy filters (stripping query parameters, auth tokens, and HTML excerpts).
