# Phase 6 — Architecture & Design Review Gate

## Independent Senior Architecture Audit & Remediation System Review

**Project:** Phantom Audit  
**Hackathon:** Kiroween 2026 — Costume Contest  
**Phase Under Review:** Phase 6 of 12 (Intelligent Remediation Guidance)  
**Date:** 2026-11-06  
**Reviewer:** Independent Principal Software & Accessibility Architect  
**Review Status:** CRITICALLY AUDITED & PLAN CORRECTED — READY FOR USER APPROVAL

---

## 1. Review Summary & Verdict

A comprehensive architectural and standards review was conducted on the initial Phase 6 planning documents before any production code implementation.

The review identified **5 key architectural defects and overstatements** in the initial design draft. All 5 issues were remediated in the updated planning specifications ([`docs/phase-6/REMEDIATION_RULE_CATALOG.md`](file:///c:/Users/Atul2/OneDrive/Desktop/KiroHackethon/phantom/docs/phase-6/REMEDIATION_RULE_CATALOG.md) and [`docs/phase-6/REMEDIATION_ENGINE_SPEC.md`](file:///c:/Users/Atul2/OneDrive/Desktop/KiroHackethon/phantom/docs/phase-6/REMEDIATION_ENGINE_SPEC.md)).

With these corrections applied, the Phase 6 architecture is sound, safe, high-performing, and 100% aligned with the Kiroween 2026 master specification.

---

## 2. Detailed Audit Findings & Corrections

### Finding 1 (Severity: HIGH) — WCAG Criterion Overstatement & Classification Inaccuracies

- **Issue:** The initial catalog draft classified `heading-order`, `landmark-one-main`, and `tabindex` as normative WCAG 2.2 Level A failures.
- **Verification:** Inspection of `axe-core` 4.14.0 metadata confirmed:
  - `heading-order`: tagged `['cat.semantics', 'best-practice']` — **Axe Best Practice** (not a normative WCAG failure).
  - `landmark-one-main`: tagged `['cat.semantics', 'best-practice']` — **Axe Best Practice** (advisory for structure and bypass).
  - `tabindex`: tagged `['cat.keyboard', 'best-practice']` — **Axe Best Practice** (advisory heuristic; WCAG 2.4.3 evaluates focus order preservation).
  - `label`: axe-core maps `label` directly to `wcag412` (Name, Role, Value Level A), not 3.3.2.
  - `svg-img-alt`: specifically evaluates `<svg>` elements with an explicit `role="img"` or `role="image"`.
- **Correction Applied:** `docs/phase-6/REMEDIATION_RULE_CATALOG.md` was rewritten to strictly distinguish between **Normative WCAG 2.2 Failures** and **Axe Best-Practice Recommendations**. Truth in advertising is maintained; no legal or normative WCAG non-compliance is fabricated.

### Finding 2 (Severity: HIGH) — Fragility of Regex HTML Excerpt Parsing

- **Issue:** The initial specification proposed using regular expressions to parse element tags, classes, and attributes from `htmlExcerpt`. Regex HTML parsing breaks on nested tags, multi-line attributes, embedded SVG coordinate paths, and attribute quotes.
- **Correction Applied:** Upgraded to standard browser `DOMParser` in [`docs/phase-6/REMEDIATION_ENGINE_SPEC.md`](file:///c:/Users/Atul2/OneDrive/Desktop/KiroHackethon/phantom/docs/phase-6/REMEDIATION_ENGINE_SPEC.md). In the Chromium extension dashboard, `new DOMParser().parseFromString(excerpt, 'text/html')` safely extracts `tagName`, `className`, `id`, `type`, and `placeholder` in a detached document fragment without script execution or network requests. Fallback to catalog defaults triggers if parsing produces no elements.

### Finding 3 (Severity: HIGH) — Dual-State Desynchronization in Remediation Lifecycle

- **Issue:** The initial plan proposed storing `remediationStatus` directly on `FindingRecord` while also saving records in `chrome.storage.local`. When an axe-core rescan ran, the fresh normalizer would overwrite findings, causing remediation states to desynchronize or be lost.
- **Correction Applied:** Established `phantom_remediation_v1` in `chrome.storage.local` as the **Single Authoritative Source of Truth**. The UI dynamically joins remediation status to finding records at runtime by matching `finding.fingerprint`.

### Finding 4 (Severity: CRITICAL) — Fraudulent Verification Prevention & Regression Revocation

- **Issue:** The initial state machine lacked explicit safeguards against false verifications when rescans produced uncertain matches or when previously fixed issues resurfaced.
- **Correction Applied:** Enforced strict state transition invariants in `REMEDIATION_ENGINE_SPEC.md`:
  1. Users **cannot** manually set status to `'verified'`.
  2. Findings matching `comparison.uncertainMatches` (shifted selector on same element) are **prohibited** from becoming `'verified'` and transition to `'unresolved'` with an explanatory notice.
  3. **Regression Revocation:** If a finding was previously marked `'verified'`, but on a future rescan the exact same fingerprint or rule reappears on that page, its status is **immediately revoked** to `'unresolved'`.
  4. Failed or cancelled rescans leave existing remediation states untouched.

### Finding 5 (Severity: MEDIUM) — Storage Bloat & Privacy Guardrails

- **Issue:** Potential duplication of HTML excerpts or code snippets in the remediation storage key could exceed storage quotas or retain stale DOM text.
- **Correction Applied:** Explicitly prohibited persisting code snippets or HTML excerpts in `phantom_remediation_v1`. Only `fingerprint`, `status`, `updatedAt`, `attemptedAt`, `verifiedAtScanId`, and optional `notes` (strictly capped at 500 characters and stripped of HTML) are stored. Maximum storage capacity is bounded to 200 records with LRU pruning.

---

## 3. Final Recommended Architecture

The corrected architecture follows a clean 4-tier separation:

```text
┌────────────────────────────────────────────────────────────────────────┐
│  1. DOMAIN & SCHEMA LAYER                                              │
│     - src/domain/remediation.ts                                        │
│     - src/lib/validation/schemas.ts                                    │
│     Strict Zod validation; RemediationStatus union; zero excerpt leak. │
├────────────────────────────────────────────────────────────────────────┤
│  2. REMEDIATION INTELLIGENCE LAYER                                     │
│     - src/features/remediation/remediation-catalog.ts                  │
│     - src/features/remediation/guidance-engine.ts                      │
│     Curated 10 P0/P1 rules; DOMParser context extraction; fallbacks.   │
├────────────────────────────────────────────────────────────────────────┤
│  3. LIFECYCLE & STORAGE LAYER                                          │
│     - src/features/remediation/remediation-tracker.ts                  │
│     - src/lib/storage/index.ts (Key: phantom_remediation_v1)           │
│     Single source of truth; rescan diff reconciliation; regression rev.│
├────────────────────────────────────────────────────────────────────────┤
│  4. UI PRESENTATION LAYER                                              │
│     - src/components/remediation/RemediationGuidancePanel.tsx          │
│     - src/components/remediation/CodeSnippetViewer.tsx                 │
│     - src/components/remediation/VerificationChecklist.tsx             │
│     - src/components/remediation/RemediationStatusBadge.tsx            │
│     Multi-syntax tabs (HTML, React, CSS); copy feedback; checklists.  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Implementation Sequence

Implementation will proceed strictly in 5 sequential workstreams upon approval:

1. **Workstream 1 — Domain Entities & Zod Schemas:**
   - Define `RemediationStatus`, `CodeSnippet`, `HumanImpact`, `VerificationStep`, `RemediationGuidance`, and `StoredRemediationRecord`.
   - Update `src/lib/validation/schemas.ts` and test with Vitest.
2. **Workstream 2 — Catalog & Guidance Synthesizer:**
   - Implement `src/features/remediation/remediation-catalog.ts` with all 10 curated rule definitions.
   - Implement `src/features/remediation/guidance-engine.ts` with `DOMParser` token extraction and fallbacks.
   - Comprehensive unit and fast-check property fuzzing tests.
3. **Workstream 3 — Lifecycle Tracker & Storage Persistence:**
   - Implement `src/features/remediation/remediation-tracker.ts` with state transition invariants and `compareScans` reconciliation.
   - Extend `StorageService` with `getRemediationRecords`, `saveRemediationRecord`, and `clearRemediationData`.
4. **Workstream 4 — UI Components & FindingInspector Integration:**
   - Implement `CodeSnippetViewer.tsx`, `RemediationGuidancePanel.tsx`, `RemediationStatusBadge.tsx`, and `VerificationChecklist.tsx`.
   - Mount in `FindingInspector.tsx` and integrate status pill in `FindingCard.tsx`.
   - Wire status updates and rescan reconciliation into `App.tsx`.
5. **Workstream 5 — Quality Gate & End-to-End Validation:**
   - Unit tests, component tests, and Playwright E2E tests (`tests/e2e/phase6-remediation.test.ts`).
   - Run complete validation gate (`pnpm validate`).

---

## 5. Architectural Approval Status

- [x] All 5 required Phase 6 planning documents authored and verified.
- [x] WCAG classifications audited against axe-core 4.14.0 source.
- [x] Context parsing upgraded to safe `DOMParser`.
- [x] Single source of truth established in local storage.
- [x] Anti-fraud rescan verification and regression revocation defined.
- [x] Zero production code modified (Stop condition strictly respected).

**Recommendation:** **APPROVED TO PROCEED TO PHASE 6 IMPLEMENTATION** upon user instruction.
