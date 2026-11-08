# Phantom Audit — Phase 7 Architecture & Risk Review

## Rescan, Comparison & Local History

**Document Version:** 1.0.0  
**Status:** Architecture Review & Approval Gate  
**Phase:** Phase 7 of 12  
**Target Release:** Kiroween 2026 Hackathon (Costume Contest Track)  
**Primary Reference:** `04_phantom_audit_project_spec_kiroween_2026.md` (Sprint 5, FR-050–FR-054, FR-063, FR-064)  
**Dependent Completed Phases:** Phase 1 (Foundation), Phase 2 (Mansion UI), Phase 3 (Active Tab), Phase 4 (axe-core Engine), Phase 5 (Finding Identity & Aggregation), Phase 6 (Remediation Guidance)

---

## 1. Executive Summary & Phase 7 Mandate

Phase 7 ("Rescan, Comparison & Local History") delivers persistent local scan snapshots and multi-scan comparison capabilities to Phantom Audit. While Phase 5 established canonical finding fingerprints and Phase 6 established the real-time consecutive rescan verification lifecycle, Phase 7 elevates Phantom Audit into a repeatable compliance tracking tool for QA engineers and developers.

Users can:

1. **Persist and Reopen Historical Scans**: Store up to 50 complete scan snapshots in `chrome.storage.local`, browsing them through an atmospheric Gothic interface ("The Archive of Past Hauntings") and reopening any historical snapshot to inspect the exact mansion state and findings at that point in time.
2. **Perform Arbitrary Scan-to-Scan Comparison**: Compare any two scans (e.g. current live scan against last week's baseline, or snapshot A vs snapshot B on the same page), evaluating net progress without false compliance claims.
3. **Rigorous Differentiation of Disappeared vs. Verified**: Clearly distinguish a finding that simply disappeared from the DOM (e.g. element removed or conditionally unmounted) from an issue that was formally certified as resolved through the Phase 6 remediation verification lifecycle.
4. **Data Minimization & Local Privacy**: Guarantee that authentication tokens, session cookies, form values, and oversized DOM dumps are never written to local storage.

---

## 2. Source of Truth & Spec Requirements Matrix

The root project specification (`04_phantom_audit_project_spec_kiroween_2026.md`) and the engineering roadmap (`docs/PHASE_ROADMAP.md`) define the following requirements for Phase 7:

| Requirement ID | Specification Requirement      | Priority | Architectural Implementation in Phase 7                                                                                                  |
| -------------- | ------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **FR-050**     | Save scan snapshots locally    | P0       | Persist full validated `ScanRecord` structures to `chrome.storage.local`, reopenable in the active profile session.                      |
| **FR-051**     | Compare two scans              | P0       | Classify findings into resolved, unchanged, new, and uncertain matches using stable fingerprints.                                        |
| **FR-052**     | Use stable finding fingerprint | P0       | Reuse Phase 5 canonical fingerprint (`v1:ruleId:normalizedSelector:targetHash`).                                                         |
| **FR-053**     | Show comparison summary        | P0       | Display counts of resolved, unchanged, new findings, uncertain matches, and net progress score.                                          |
| **FR-054**     | Avoid false "fixed" claims     | P0       | Display clear methodology notices; distinguish unobserved/disappeared elements from verified remediation fixes.                          |
| **FR-063**     | Store history locally          | P0       | Provide "The Archive of Past Hauntings" drawer/modal to view, reopen, and delete historical snapshots.                                   |
| **FR-064**     | Clear all local data           | P0       | Provide explicit single-scan deletion and confirmed full storage wipe.                                                                   |
| **NFR-008**    | Privacy                        | P0       | 100% local extension processing; zero cloud databases, zero telemetry, zero remote AI.                                                   |
| **NFR-009**    | Data minimization              | P0       | Strip sensitive URL tokens (e.g. `access_token`, `auth`, `token`); bound HTML excerpts to 200 chars; never store cookies or form inputs. |
| **NFR-011**    | Testability                    | P0       | Fast-check property tests for comparison idempotency; Playwright E2E for history reopening and comparison.                               |

---

## 3. Analysis of Existing Codebase & Reusability Audit

To prevent redundant code and conflicting sources of truth, Phase 7 reuses existing implementations:

### 3.1 Reusable Modules (Zero Duplication)

- **Canonical Fingerprinting (`src/features/normalization/fingerprint.ts`)**: Reuse deterministic fingerprint generation and multi-target sorting established in Phase 5.
- **Cross-Scan Comparator (`src/features/comparison/scan-comparator.ts`)**: Reuse `compareScans()` and `evaluateUncertainMatch()` heuristic matching. Extend to support arbitrary scan pairs.
- **URL Normalization & Comparability (`src/features/remediation/rescan-verifier.ts`)**: Reuse `normalizeUrlForComparison()` and `evaluateScanComparability()` with SPA hash route preservation.
- **Remediation Tracker (`src/features/remediation/remediation-tracker.ts`)**: Reuse the anti-regression state machine and certifying scan ID references.
- **Comparison UI Banner (`src/components/findings/CrossScanDiffBanner.tsx`)**: Reuse the Gothic crimson/emerald diff presentation.
- **Storage Subsystem (`src/lib/storage/index.ts`)**: Extend existing `StorageService` methods (`getScanHistory`, `saveScan`, `deleteScan`, `clearAllData`).

### 3.2 Modules Requiring Modification

- **`src/domain/scan.ts` & `src/domain/report.ts`**:
  - Add lightweight `ScanSummary` interface for efficient history listing without loading megabytes of DOM nodes.
  - Add `ScanSource` indicator (`'live'` vs `'snapshot'`).
  - Refine `ScanComparison` to distinguish `disappeared` (absent from DOM) from `verified` (remediation certified).
- **`src/lib/storage/index.ts`**:
  - Add `getScanSummaries()`: returns metadata only (`id`, `tabUrl`, `pageTitle`, `hostname`, `scannedAt`, `totalFindings`, `status`, `roomStats`).
  - Add `getScanById(scanId)`: retrieves full `ScanRecord` on demand.
  - Implement URL query parameter sanitization (stripping tokens like `token`, `access_token`, `auth`, `session`).
  - Enforce atomic updates and 50-scan LRU retention.
- **`src/entrypoints/dashboard/App.tsx`**:
  - Add `viewingSnapshot` state: tracks whether user is inspecting a live tab scan or a historical snapshot.
  - Add `selectedBaselineScanId`: allows user to designate any historical scan as the comparison baseline.
  - Add "Historical Snapshot" banner with "Return to Live" action.
- **New UI Component: `src/components/history/ScanHistoryDrawer.tsx`**:
  - Gothic-themed drawer ("The Archive of Past Hauntings") listing historical scans with sorting, search, deletion, and comparison actions.

---

## 4. Architectural Risk Register & Mitigations

| Risk ID     | Severity   | Category                | Risk Description                                                                                                          | Mitigation Strategy                                                                                                                                                                                                                                                            |
| ----------- | ---------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **RSK-701** | **High**   | Storage Quota           | Storing 50 full scans with hundreds of finding nodes could exceed `chrome.storage.local` limits (typically 10 MB).        | 1. Implement 50-scan hard FIFO ceiling.<br>2. Sanitize and bound HTML excerpts to $\le 200$ chars.<br>3. Introduce `ScanSummary` metadata cache so listing scans does not deserialize entire finding arrays.<br>4. Provide storage usage indicator and clear-history controls. |
| **RSK-702** | **High**   | False Verification      | User assumes an absent finding in an arbitrary historical comparison means the defect was fixed.                          | Strictly distinguish **Verified Resolved** (certified by Phase 6 remediation tracker) from **Absent / Unobserved** (finding simply not detected in the rescan DOM). Display educational tooltip.                                                                               |
| **RSK-703** | **Medium** | Incompatible Comparison | User attempts to compare scans from different domains or different SPA hash routes.                                       | Use `evaluateScanComparability()`. If normalized URLs differ, comparison is rejected with `isComparable: false`, disabling comparison metrics and displaying an explanatory warning.                                                                                           |
| **RSK-704** | **Medium** | Context Confusion       | User viewing an old historical snapshot clicks "Start Accessibility Audit" and gets confused about which tab was audited. | When viewing a snapshot, display a prominent Gothic banner: _"Viewing Historical Snapshot from [Date]. Real-time auditing is paused."_ Provide a one-click _"Return to Live Scan"_ button.                                                                                     |
| **RSK-705** | **Medium** | Privacy & Leakage       | Persisting URLs containing session tokens, query credentials, or sensitive form values.                                   | Implement `sanitizeUrlForStorage()` that strips common credential tokens (`auth`, `token`, `access_token`, `apiKey`, `session`). Never store form inputs or cookies.                                                                                                           |
| **RSK-706** | **Low**    | Keyboard Trap           | History drawer traps keyboard focus or fails to restore focus to trigger button upon close.                               | Implement standard WAI-ARIA dialog pattern: `role="dialog"`, `aria-modal="true"`, focus trapping within drawer, `Escape` key close handler, and focus restoration to opener button.                                                                                            |

---

## 5. Disappeared vs. Verified Resolution Model

A core architectural invariant of Phantom Audit is: **disappearance $\ne$ verification**.

```text
                               Finding in Baseline Scan
                                          │
                        ┌─────────────────┴─────────────────┐
                        │                                   │
              Present in Rescan?                   Absent from Rescan?
                        │                                   │
                ┌───────┴───────┐                   ┌───────┴───────┐
                ▼               ▼                   ▼               ▼
           Fingerprint      Shifted            Tracked with     Not Tracked /
              Match?        Selector?           Attempted        No Attempt
                │               │               Lifecycle?           │
                ▼               ▼                   │                │
            Unchanged       Uncertain               ▼                ▼
             Finding          Match              Verified        Unobserved /
                                                Resolution       Disappeared
```

### Definitions:

1. **Unchanged Finding**: Canonical fingerprint matches exactly in both baseline and rescan.
2. **Uncertain Match**: Selector shifted on a matching HTML tag or with an identical failure summary. Must never be classified as resolved.
3. **Verified Resolution**: The finding was tracked in the remediation system, marked attempted, and confirmed absent in a subsequent completed scan on the identical URL with 0 candidate matches. Certifying scan UUID is stamped.
4. **Unobserved / Disappeared**: The finding was absent from the rescan, but was NOT part of an attempted remediation lifecycle. It may have been removed, or the containing element was unmounted. It is reported as "Absent / Disappeared", NOT "Verified Compliant".

---

## 6. Proposed Workstream Sequence

```text
┌────────────────────────────────────────────────────────────────────────┐
│  Workstream 1: Local History Domain, Snapshot Schema & Storage Service  │
│  - ScanSummary, sanitized storage, 50-scan quota, getScanById          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│  Workstream 2: Arbitrary Scan Comparison & Disappeared vs Verified Engine│
│  - Multi-scan comparator, explicit resolution classification, SPA check│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│  Workstream 3: Haunted Mansion History UI ("Archive of Past Hauntings") │
│  - ScanHistoryDrawer, snapshot viewer banner, delete & clear controls  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│  Workstream 4: Interactive Historical Comparison & Progress Diff UI    │
│  - Arbitrary scan selection, diff banner integration, filter chips     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│  Workstream 5: Independent Verification, E2E Testing & Release Gate    │
│  - Full quality gates, Playwright browser tests, audit documentation   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Approval Recommendation

The architecture is sound, builds directly on Phase 5 and 6 foundations with zero code duplication, and strictly aligns with the root project specification.

**Status:** ARCHITECTURE REVIEW COMPLETE. Awaiting user approval to begin Workstream 1.
