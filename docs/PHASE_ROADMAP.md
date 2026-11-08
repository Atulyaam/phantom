# Phantom Audit — 12-Phase Engineering Roadmap

**Document Version:** 1.0.0  
**Effective Date:** Kiroween 2026  
**Primary Reference:** `04_phantom_audit_project_spec_kiroween_2026.md`

---

## 1. Roadmap Architecture & Reconciliation

The Phantom Audit project decomposes the 8 development sprints outlined in the root master specification into 12 granular, verifiable engineering phases. This ensures strict task-by-task validation, independent auditing, zero unverified assumptions, and high hackathon competitiveness.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   PHASE 1: Foundation & Architecture (DONE)            │
│  - Environment audit, WXT + React 19 + TS strict setup                 │
│  - MV3 minimal permissions, tokens.css, Vitest & Playwright infra      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│      PHASE 2: Premium UI Foundation & Haunted Mansion (DONE)           │
│  - Accessible 2D SVG vector mansion map & room visual states           │
│  - Dual representation: visual map + accessible tabular list           │
│  - Gothic atmospheric design, high-contrast focus, reduced motion      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│  PHASE 3: Browser Extension Integration & Active-Tab Management (DONE) │
│  - Active tab lifecycle, permissions grant handling, tab switching     │
│  - Background service worker to dashboard messaging protocols          │
│  - Rejection & graceful messaging for restricted browser targets       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│             PHASE 4: Real axe-core Scanning Engine (DONE)              │
│  - Local bundling of axe.min.js in extension assets (zero remote code) │
│  - Injected execution via chrome.scripting on explicit user action     │
│  - Scan timeout (15s), debounce, and progress state tracking           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│      PHASE 5: Finding Identity, Aggregation & Comparison Engine (DONE) │
│  - Deep canonical fingerprint resilience (selector normalization, sort)│
│  - Multi-dimensional aggregation & grouping (room, severity, review)   │
│  - Cross-scan comparison foundations (resolved, unchanged, new diffing)│
│  - Finding search, severity filters, and copyable selector actions     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│            PHASE 6: Intelligent Remediation Guidance (DONE)            │
│  - Curated local guidance catalogue for P0 demo rules                  │
│  - Plain-language explanations, user impact, and copyable safe fixes   │
│  - Official Deque / WCAG 2.2 references & manual check reminders       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│            PHASE 7: Rescan, Comparison & Local History (DONE)          │
│  - Local snapshot persistence in chrome.storage.local (max 50)         │
│  - Before/after scan comparison: resolved vs unchanged vs new findings │
│  - Verified progress tracking without false compliance claims          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│         PHASE 8: Reporting & Privacy Export (DONE)                     │
│  - Validated JSON report export against schema                         │
│  - Readable HTML export with audit metadata and limitations            │
│  - Privacy redaction options: strip excerpts & query parameters        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│      PHASE 9: Security, Privacy & Accessibility Hardening (IN PROGRESS)│
│  - Workstream 1: Extension Security Boundary & CSP Hardening (APPROVED)│
│  - Workstream 2: Privacy Hardening, PII & Logger Safety     (APPROVED)│
│  - Workstream 3: Interface A11y Hardening & Disambiguation  (BLUEPRINT)│
│  - Workstream 4: Automated Dashboard axe-core E2E Suite     (BLUEPRINT)│
│  - Workstream 5: Release Gate, Regressions & Manual QA      (BLUEPRINT)│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│          PHASE 10: Performance & Browser Compatibility                 │
│  - Package size optimization (< 3.5 MB uncompressed, < 1.0 MB zipped) │
│  - Startup time benchmarking (< 2.5s first render)                     │
│  - Chrome and Edge desktop compatibility validation                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│       PHASE 11: Hackathon Differentiation & Advanced Polish            │
│  - Interactive atmospheric animations (respecting reduced-motion)      │
│  - Enhanced room sound effects (optional/muted by default)             │
│  - Compelling Kiroween storytelling & demo site alignment              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│         PHASE 12: Final QA, Packaging, Demo & Submission               │
│  - Full automated regression suite (unit, property, integration, E2E)  │
│  - Production extension ZIP packaging & release verification           │
│  - 2m 40s demo video storyboard execution & Devpost documentation      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase-by-Phase Alignment Matrix

| Phase        | Title                                                 | Spec Sprints | Key Deliverables & Functional Scope                                                                                                                                                                         |
| ------------ | ----------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 1**  | Foundation & Architecture                             | Sprint 0, 1  | Repository audit, WXT + React 19 + TS setup, MV3 manifest, tokens.css, Vitest + Playwright setup, Kiro steering, CI workflow. _(Completed)_                                                                 |
| **Phase 2**  | Premium UI Foundation & Haunted Mansion Experience    | Sprint 1     | 2D SVG mansion map, room cards, room states (Haunted, Quiet, Manual Review), list view alternative, typography & theme controls. _(Completed)_                                                              |
| **Phase 3**  | Browser Extension Integration & Active-Tab Management | Sprint 1     | Background service worker tab tracking, `activeTab` gesture handling, dashboard parameter parsing, unsupported page handling. _(Completed)_                                                                 |
| **Phase 4**  | Real axe-core Scanning Engine                         | Sprint 2     | Pinned `axe-core` bundling, `chrome.scripting` injection, timeout protection, duplicate debounce, scan lifecycle states. _(Completed)_                                                                      |
| **Phase 5**  | Finding Identity, Aggregation & Comparison Engine     | Sprint 3     | Deep canonical fingerprint resilience, multi-dimensional grouping, cross-scan comparison foundations, finding search & filtering. _(Completed)_                                                             |
| **Phase 6**  | Intelligent Remediation Guidance                      | Sprint 4     | Curated local guidance catalogue (`button-name`, `image-alt`, `color-contrast`, etc.), fix snippets, copy actions, manual review checklist. _(Completed)_                                                   |
| **Phase 7**  | Rescan, Comparison & Local History                    | Sprint 5     | `chrome.storage.local` persistence, fingerprint set-diffing, comparison view (resolved, unchanged, new), history management. _(Completed — all 5 workstreams approved)_                                     |
| **Phase 8**  | Reporting & Privacy Export                            | Sprint 5     | JSON and HTML report generators, redaction engine (omitting excerpts, sanitizing URLs), clear data actions. _(Completed — all 5 workstreams approved)_                                                      |
| **Phase 9**  | Security, Privacy & Accessibility Hardening           | Sprint 6     | Automated axe audit on extension dashboard, keyboard trap prevention, high-contrast review, CSP & permission audit. _(Workstreams 1 & 2 Approved; Workstreams 3–5 Consolidated Audit & Blueprint Complete)_ |
| **Phase 10** | Performance & Browser Compatibility                   | Sprint 6     | Bundle size benchmarking, memory profiling, Chrome and Edge desktop testing, large DOM resilience.                                                                                                          |
| **Phase 11** | Hackathon Differentiation & Polish                    | Sprint 7     | Subtle gothic animations, sound toggle, Kiroween aesthetic polish, demo sample page preparation.                                                                                                            |
| **Phase 12** | Final QA, Packaging, Demo & Submission                | Sprint 7     | End-to-end regression audit, production ZIP packaging, Devpost writeup, under-3-minute video recording.                                                                                                     |

---

## 3. Reconciliation with Root Specification

The 12-phase roadmap directly implements all requirements from `04_phantom_audit_project_spec_kiroween_2026.md`. No architectural contradictions exist. Building the UI foundation in Phase 2 before active-tab injection (Phase 3) and scanner injection (Phase 4) aligns with the specification's core principle: **"Design first: finalize user journey, mansion map, finding inspector and accessible design tokens."**
