# Phantom Audit — Phase 7 Detailed Execution Plan

## Rescan, Comparison & Local History

**Document Version:** 1.0.0  
**Status:** Approved for Implementation Planning  
**Phase:** Phase 7 of 12  
**Target Release:** Kiroween 2026 Hackathon (Costume Contest Track)  
**Primary Reference:** `04_phantom_audit_project_spec_kiroween_2026.md` (Sprint 5, FR-050–FR-054, FR-063, FR-064)  
**Dependent Completed Phases:** Phases 1–6 (Fully Verified)

---

## 1. Phase Objectives & Scope

Phase 7 delivers reliable, privacy-preserving local scan snapshots and multi-scan comparison capabilities.

### In-Scope Deliverables:

1. **Persistent Local Snapshots**: Persist up to 50 complete scans in `chrome.storage.local` with strict data minimization (sanitizing sensitive URL query parameters, bounding HTML excerpts, omitting cookies/tokens).
2. **Scan Summary Indexing**: Introduce lightweight `ScanSummary` metadata to allow instant loading of historical scan lists without deserializing megabytes of DOM nodes.
3. **The Archive of Past Hauntings (History UI)**: An accessible, Gothic-themed drawer allowing users to browse past audits, filter by host, inspect violation counts, delete scans, and reopen snapshots.
4. **Historical Snapshot Viewer**: Reopening a past scan populates the Haunted Mansion map, room detail cards, and finding inspector exactly as they appeared at that snapshot, with a prominent "Viewing Historical Snapshot" banner.
5. **Arbitrary Scan Comparison Engine**: Compare any baseline scan from history with any subsequent scan on the same normalized URL (or compare current live scan to any historical baseline), computing resolved, unchanged, new, and uncertain findings.
6. **Disappeared vs. Verified Differentiation**: Formally distinguish findings that simply vanished from the DOM (unobserved/absent) from findings certified resolved via the Phase 6 remediation tracker.
7. **Single Scan Deletion & Storage Wipe**: Provide individual snapshot deletion and confirmed "Clear All Scan History" controls.

### Explicit Out-of-Scope Constraints:

- No remote backend, cloud database, or external sync.
- No automated webpage modification.
- No AI/LLM API calls or telemetry.
- No PDF export (reserved for Phase 8).
- No Three.js 3D mansion (P2 feature).

---

## 2. Workstream Breakdown

```text
┌────────────────────────────────────────────────────────────────────────┐
│  Workstream 1: Local History Domain, Snapshot Schema & Storage Service  │
│  Duration: Step 1 of 5 | Dependencies: Phase 6 completed               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│  Workstream 2: Arbitrary Scan Comparison & Disappeared vs Verified Engine│
│  Duration: Step 2 of 5 | Dependencies: Workstream 1                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│  Workstream 3: Haunted Mansion History UI ("Archive of Past Hauntings") │
│  Duration: Step 3 of 5 | Dependencies: Workstream 1                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│  Workstream 4: Interactive Historical Comparison & Progress Diff UI    │
│  Duration: Step 4 of 5 | Dependencies: Workstreams 2, 3                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│  Workstream 5: Independent Verification, E2E Testing & Release Gate    │
│  Duration: Step 5 of 5 | Dependencies: Workstreams 1–4                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Workstream 1: Local History Domain, Snapshot Schema & Storage Service

#### Objective:

Establish the domain models, runtime validation schemas, and storage layer enhancements for persistent scan history and lightweight snapshot indexing.

#### Tasks:

1. **Domain Models (`src/domain/scan.ts`)**:
   - Define `ScanSummary`:
     ```typescript
     export interface ScanSummary {
       id: string;
       tabUrl: string;
       pageTitle: string;
       hostname: string;
       scannedAt: string;
       status: ScanStatus;
       totalFindings: number;
       criticalCount: number;
       seriousCount: number;
       moderateCount: number;
       minorCount: number;
       roomBreakdown: Record<string, number>;
     }
     ```
   - Add `ScanSource` (`'live'` | `'snapshot'`).
2. **URL Sanitization for Storage (`src/lib/storage/index.ts`)**:
   - Implement `sanitizeUrlForStorage(url: string): string` that strips sensitive query parameter keys (`token`, `access_token`, `auth`, `key`, `apiKey`, `session`, `password`) while preserving non-sensitive functional parameters.
3. **Storage Enhancements (`src/lib/storage/index.ts`)**:
   - Implement `getScanSummaries(): Promise<ScanSummary[]>`: computes and caches lightweight summaries for fast history list rendering.
   - Implement `getScanById(id: string): Promise<ScanRecord | null>`: fetches complete record on demand.
   - Enforce 50-scan hard FIFO quota ceiling.
   - Implement `deleteScan(scanId: string): Promise<void>`.
   - Implement `clearScanHistory(): Promise<void>` (clears only history, preserving user preferences and remediation records).
4. **Validation Schemas (`src/lib/validation/schemas.ts`)**:
   - Add `ScanSummarySchema` with Zod validation.

#### Validation & Quality Gate:

- `pnpm typecheck`
- Unit tests: `tests/unit/storage/scan-history.test.ts` (verifying saving, summary indexing, URL credential sanitization, 50-record FIFO pruning, corrupted item handling, single deletion, and clear history).

---

### Workstream 2: Arbitrary Scan Comparison & Disappeared vs. Verified Engine

#### Objective:

Enhance the cross-scan comparison engine to support arbitrary scan pairs (any baseline vs. any rescan) and enforce the strict architectural distinction between **Verified Resolved** and **Absent / Disappeared**.

#### Tasks:

1. **Extended Domain (`src/domain/report.ts`)**:
   - Refine `ScanComparison`:
     ```typescript
     export interface ScanComparison {
       fromScanId: string;
       toScanId: string;
       generatedAt: string;
       isComparable: boolean;
       incomparabilityReason?: string;
       verifiedResolved: FindingRecord[]; // Confirmed resolved via remediation lifecycle
       disappeared: FindingRecord[]; // Absent from rescan DOM, not formally tracked
       unchanged: FindingRecord[]; // Persisting with identical fingerprint
       newFindings: FindingRecord[]; // Newly introduced defects
       uncertainMatches?: UncertainFindingMatch[];
       metrics?: ScanComparisonMetrics;
     }
     ```
2. **Comparator Enhancement (`src/features/comparison/scan-comparator.ts`)**:
   - Integrate `evaluateScanComparability()` check up-front: if normalized URLs differ (including distinct SPA routes), return `isComparable: false` with explanatory reason.
   - Accept optional `remediationRecords` map:
     - If an absent finding has `status === 'verified'`, place in `verifiedResolved`.
     - If an absent finding does not have `status === 'verified'`, place in `disappeared`.
   - Compute metrics:
     - `netProgress`: `verifiedResolved.length + disappeared.length - newFindings.length`.
     - `verifiedFixesCount`: `verifiedResolved.length`.
     - `unobservedCount`: `disappeared.length`.
3. **Property & Fuzz Tests**:
   - Property tests with `fast-check` verifying comparison determinism, symmetry of unchanged findings, and disjoint partitions:
     $$\text{baselineFindings} = \text{unchanged} \cup \text{uncertain} \cup \text{verifiedResolved} \cup \text{disappeared}$$

#### Validation & Quality Gate:

- `pnpm typecheck`
- Unit & property tests: `tests/unit/comparison/arbitrary-comparator.test.ts`.

---

### Workstream 3: Haunted Mansion History UI ("The Archive of Past Hauntings")

#### Objective:

Build an accessible Gothic drawer/modal allowing users to view, search, reopen, and delete historical scan snapshots.

#### Tasks:

1. **History Drawer Component (`src/components/history/ScanHistoryDrawer.tsx`)**:
   - Accessible slide-out panel or dialog (`role="dialog"`, `aria-label="The Archive of Past Hauntings"`).
   - Header with Gothic typography, scan count badge, and "Clear History" button.
   - Search/filter input: filter past scans by page title or hostname.
   - Chronological list of scan cards:
     - Target page title and hostname.
     - Formatted scan timestamp (e.g. `Oct 31, 2026, 9:45 PM`).
     - Total violation count and severity breakdown pills (Critical, Serious, Moderate, Minor).
     - Status indicator (Completed, Failed, Incomplete).
     - Action buttons: `Reopen Snapshot`, `Compare with Current`, `Delete`.
2. **Historical Snapshot Banner (`src/components/layout/HistoricalSnapshotBanner.tsx`)**:
   - Prominent atmospheric banner displayed when inspecting a historical snapshot:
     _"Viewing Historical Snapshot: [Page Title] ([Timestamp]). Real-time live auditing is paused."_
   - Action: `Return to Live Scan` button.
3. **Accessibility & Interactions**:
   - Keyboard navigation: `Escape` closes the drawer, focus is trapped while open and restored to trigger button upon close.
   - Confirm dialog for "Delete Scan" and "Clear All History".
   - `prefers-reduced-motion` compliance for drawer transitions.

#### Validation & Quality Gate:

- `pnpm typecheck`
- Component tests: `tests/unit/components/history-drawer.test.tsx` (keyboard focus, search filtering, reopen event, delete confirmation).

---

### Workstream 4: Interactive Historical Comparison & Progress Diff UI

#### Objective:

Integrate historical scan comparison into the main dashboard, allowing users to compare the current scan to any historical baseline or compare two arbitrary historical scans.

#### Tasks:

1. **Dashboard State Integration (`src/entrypoints/dashboard/App.tsx`)**:
   - Manage `viewingSnapshot: ScanRecord | null`.
   - Manage `historicalBaselineScan: ScanRecord | null`.
   - Update `handleReopenScan(scanId)`: fetches full record via `storageService.getScanById(scanId)`, sets `viewingSnapshot`, populates rooms, findings, and filters.
   - Update `handleCompareScans(baselineId, targetId)`: computes comparison via enhanced `compareScans` and updates `scanComparison`.
   - Update `handleReturnToLive()`: restores active tab scanning context.
2. **Comparison Diff Enhancement (`src/components/findings/CrossScanDiffBanner.tsx`)**:
   - Display distinct counts for:
     - **Verified Resolved** (Green badge with checkmark: confirmed fixes).
     - **Absent / Disappeared** (Slate badge with eye-off icon: unobserved in DOM).
     - **Unchanged** (Amber badge).
     - **New Defects** (Crimson badge).
   - Display baseline vs. rescan timestamps and target URLs.
   - If scans are incomparable (different URLs/SPA routes), render a warning callout explaining why cross-page comparison is disabled.
3. **Finding Filter Integration**:
   - Add filter chips in `FindingFilterBar`: filter by comparison outcome (`Verified Resolved`, `Disappeared`, `Unchanged`, `New`).

#### Validation & Quality Gate:

- `pnpm typecheck`
- Integration tests: `tests/unit/components/phase7-comparison-integration.test.tsx`.

---

### Workstream 5: Independent Verification, E2E Testing & Release Gate

#### Objective:

Perform an exhaustive independent verification of the entire Phase 7 implementation against all specifications and quality gates.

#### Tasks:

1. **Playwright Browser E2E Suite (`tests/e2e/phase7-history-comparison.test.ts`)**:
   - Test 1: User runs scan -> Scan saved to history -> Opens Archive drawer -> Reopens snapshot -> Verifies mansion map matches snapshot.
   - Test 2: User runs baseline scan on test fixture -> Applies fix -> Runs rescan -> Compares scans -> Verifies resolved vs disappeared vs unchanged.
   - Test 3: User deletes a historical scan -> Verifies scan removed from storage and drawer.
   - Test 4: User clears all scan history -> Verifies empty state in Archive drawer.
   - Test 5: Keyboard navigation in History Drawer (Tab order, Esc to close, focus restoration).
2. **Privacy & Security Audit**:
   - Verify zero credentials, cookies, or form values in `chrome.storage.local`.
   - Verify sensitive query parameter sanitization.
3. **Full Regression Execution**:
   - `pnpm typecheck`
   - `pnpm lint`
   - `pnpm format:check`
   - `pnpm test`
   - `pnpm test:e2e`
   - `pnpm build`
   - `pnpm validate`
4. **Deliverables Creation**:
   - `docs/audits/PHASE_7_FINAL_INDEPENDENT_VERIFICATION.md`
   - `docs/PHASE_7_FINAL_REPORT.md`
   - Update `docs/PHASE_ROADMAP.md` (mark Phase 7 complete).

---

## 3. Risk Register & Mitigation Strategy

| Risk                                      | Severity | Mitigation Strategy                                                                                             |
| ----------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| **Storage Quota Overflow**                | High     | 50-scan FIFO ceiling; `ScanSummary` metadata indexing; bounded HTML excerpts ($\le 200$ chars).                 |
| **False Verification Claims**             | High     | Clear separation between `verifiedResolved` (certified by Phase 6 tracker) and `disappeared` (absent from DOM). |
| **Cross-Page Comparison Errors**          | Medium   | Strict comparability gate using Phase 6 `normalizeUrlForComparison()` with SPA route preservation.              |
| **Snapshot / Live Tab Desynchronization** | Medium   | Prominent "Viewing Historical Snapshot" banner; explicit "Return to Live Scan" button.                          |
| **Sensitive Data Persistence**            | Medium   | Automated query string token sanitization; zero cookie/token persistence.                                       |
| **Focus Trapping / A11y Defects**         | Low      | WAI-ARIA modal dialog semantics; Esc key listener; automated Playwright keyboard testing.                       |

---

## 4. Reusable vs. Modified Modules

### Existing Modules to Reuse (No Duplication):

- `src/features/normalization/fingerprint.ts`: Canonical fingerprint generation.
- `src/features/normalization/axe-normalizer.ts`: Violation normalization and HTML excerpt sanitization.
- `src/features/remediation/rescan-verifier.ts`: URL normalization, SPA route preservation, and scan comparability logic.
- `src/features/remediation/remediation-tracker.ts`: Remediation verification state machine.
- `src/components/findings/FindingCard.tsx`: Status badges and regression indicators.
- `src/components/mansion/MansionMap.tsx`: 2D SVG vector mansion rendering.

### Modules Requiring Modification:

- `src/domain/scan.ts`: Add `ScanSummary` and `ScanSource`.
- `src/domain/report.ts`: Refine `ScanComparison` with `verifiedResolved` and `disappeared`.
- `src/lib/storage/index.ts`: Add summary indexing, `getScanById`, URL credential sanitization, and 50-scan FIFO ceiling.
- `src/features/comparison/scan-comparator.ts`: Support arbitrary scan pairs and remediation-aware classification.
- `src/components/findings/CrossScanDiffBanner.tsx`: Support historical comparisons and disappeared vs. verified metrics.
- `src/entrypoints/dashboard/App.tsx`: State management for historical snapshot viewing and arbitrary comparison.

### New Modules to Create:

- `src/components/history/ScanHistoryDrawer.tsx`: The Archive of Past Hauntings drawer.
- `src/components/layout/HistoricalSnapshotBanner.tsx`: Historical snapshot indicator banner.
- `tests/unit/storage/scan-history.test.ts`: Storage and summary unit tests.
- `tests/unit/comparison/arbitrary-comparator.test.ts`: Arbitrary comparison unit and property tests.
- `tests/unit/components/history-drawer.test.tsx`: Component accessibility and interaction tests.
- `tests/e2e/phase7-history-comparison.test.ts`: End-to-end browser tests in Chromium.

---

## 5. Stop Condition & Approval Gate

**Mandatory Constraint:**
This document concludes the Phase 7 architecture and execution planning stage.
**No production code has been modified. No implementation work has started.**

Implementation will commence with Workstream 1 only after explicit user approval is granted.
