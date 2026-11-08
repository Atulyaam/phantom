# Phantom Audit — Phase 7 Workstream 2 Implementation Report

## Arbitrary Scan Comparison & Disappeared vs. Verified Engine

**Project:** Phantom Audit — Kiroween 2026 Hackathon (Costume Contest)  
**Phase:** 7 — Rescan, Comparison & Local History  
**Workstream:** 2 of 5 — Arbitrary Scan Comparison & Disappeared vs. Verified Engine  
**Status:** Completed & Validated  
**Date:** 2026-11-06

---

## 1. Executive Summary

Phase 7 Workstream 2 delivers a deterministic, strictly read-only cross-scan comparison engine capable of comparing any two accessibility scans—whether between live scans, between a live scan and a historical snapshot, or between two arbitrary historical snapshots.

Crucially, the engine implements the fundamental architectural requirement: **Disappeared $\ne$ Verified**. Mere absence of an accessibility finding from a subsequent scan is never confused with compliance. Instead, the engine enforces a strict classification:

1. `verifiedResolved`: Only findings that possess an authoritative Phase 6 verification record (`status === 'verified'`) whose certifying scan ID (`verifiedAtScanId`) matches the target rescan ID being compared.
2. `disappeared`: Baseline findings absent from the target scan that lack certifying verification evidence (e.g. unmounted component, conditional rendering, navigating away, dynamic DOM mutation).
3. `resolved`: A backward-compatible alias union array (`[...verifiedResolved, ...disappeared]`) ensuring all Phase 5 and Phase 6 consumers continue functioning seamlessly without breaking changes.
4. `unchanged`: Findings whose canonical fingerprint exactly matches in both scans.
5. `newFindings`: Unmatched findings in the target scan representing regressions or newly mounted DOM.
6. `uncertainMatches`: Heuristic matches where the selector path shifted on the same element tag and failure summary under the same rule and room.

All operations are strictly read-only with zero side effects on stored remediation records, zero telemetry, and zero remote network requests.

---

## 2. Repository Changes & Architecture

### 2.1 Modified Files

| File                                          | Purpose of Modification                                                                                                                                                                                                                                                             |
| :-------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/report.ts`                        | Extended `ScanComparison` with `verifiedResolved: FindingRecord[]`, `disappeared: FindingRecord[]`, `isComparable: boolean`, and optional `incomparableReason?: string`. Extended `ScanComparisonMetrics` with `verifiedResolvedCount?: number` and `disappearedCount?: number`.    |
| `src/lib/validation/schemas.ts`               | Updated `ScanComparisonSchema` and `ScanComparisonMetricsSchema` with Zod validation rules and backward-compatible defaults (`default([])` for `verifiedResolved` and `disappeared`, `default(true)` for `isComparable`).                                                           |
| `src/features/comparison/scan-comparator.ts`  | Centralized `normalizeUrlForComparison`, `evaluateScanComparability`, `ScanComparabilityResult`, and `CompareScansOptions`. Implemented arbitrary scan pair comparison with comparability gating, heuristic matching, and strict `verifiedResolved` vs. `disappeared` partitioning. |
| `src/features/remediation/rescan-verifier.ts` | Re-exported `normalizeUrlForComparison`, `evaluateScanComparability`, and `ScanComparabilityResult` from `@/features/comparison/scan-comparator` to maintain 100% backward compatibility while eliminating potential circular dependencies.                                         |

### 2.2 New Test Files

| File                                                 | Test Count | Description                                                                                                                                                                                    |
| :--------------------------------------------------- | :--------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/comparison/arbitrary-comparator.test.ts` |  23 tests  | Comprehensive unit and fast-check property tests covering arbitrary scan pairs, verified vs. disappeared invariants, comparability gates, read-only purity, and disjoint partition properties. |

---

## 3. Detailed Technical Implementation

### 3.1 Comparability Gate (`evaluateScanComparability`)

Scans are evaluated before diffing to prevent misleading comparisons:

- **Status Checks:** Scans must have `status === 'completed'`. Incomplete, failed, or cancelled scans immediately fail comparability.
- **URL Normalization (`normalizeUrlForComparison`):**
  - Hostname and scheme are normalized to lowercase.
  - Query parameters are sorted alphabetically to remain parameter-order-agnostic (`?a=1&b=2` $\equiv$ `?b=2&a=1`).
  - In-page element scroll anchors (e.g. `#top`, `#footer`, `#main-content`) are stripped so different scroll views on the same page remain comparable.
  - SPA client routes (e.g. `#/settings`, `#!/dashboard`, or any fragment containing `/`) are preserved so distinct application views are never falsely compared. Trailing slashes in SPA routes are normalized.
- **Structured Outcome:** If incomparable, `compareScans()` returns:
  ```typescript
  {
    fromScanId: baselineScan?.id || '',
    toScanId: rescan?.id || '',
    generatedAt: timestamp,
    isComparable: false,
    incomparableReason: comparability.reason,
    verifiedResolved: [],
    disappeared: [],
    resolved: [],
    unchanged: [],
    newFindings: [],
    uncertainMatches: [],
    metrics: { ...zeroedMetrics, baselineTotal, rescanTotal }
  }
  ```
- **Bypass Option:** `checkComparability: false` can be passed in `CompareScansOptions` when explicit cross-page comparisons are desired.

### 3.2 Disappeared vs. Verified Invariant

When a baseline finding is absent from the target scan and has no uncertain match:

```typescript
const record = remediationRecords ? remediationRecords[finding.fingerprint] : undefined;
if (record && record.status === 'verified' && record.verifiedAtScanId === rescan.id) {
  verifiedResolved.push(finding);
} else {
  disappeared.push(finding);
}
```

#### Why Absence Alone Cannot Equal Verification:

- An element may have been removed from the DOM entirely.
- A React/Vue component may be conditionally unmounted (e.g., collapsed accordions, closed dialogs).
- The user may have navigated away or altered the page's dynamic state.
- Under WCAG and accessibility principles, an issue is only verified if the code was corrected and verified against that scan. Unverifiable absences are labeled `disappeared`.

### 3.3 Metric Consistency & Partition Properties

For any comparison result:
$$\text{baselineTotal} = \text{unchangedCount} + \text{uncertainCount} + \text{verifiedResolvedCount} + \text{disappearedCount}$$
$$\text{rescanTotal} = \text{unchangedCount} + \text{uncertainCount} + \text{newCount}$$
$$\text{resolvedCount} = \text{verifiedResolvedCount} + \text{disappearedCount}$$
$$\text{netProgress} = \text{resolvedCount} - \text{newCount}$$

---

## 4. Test & Verification Results

### 4.1 Test Suites Executed

1. **TypeScript Typecheck:**
   - Command: `pnpm typecheck` (`tsc --noEmit`)
   - Result: Exit Code 0 (0 errors)
2. **ESLint Static Analysis:**
   - Command: `pnpm lint` (`eslint .`)
   - Result: Exit Code 0 (0 errors, 0 warnings)
3. **Prettier Format Check:**
   - Command: `pnpm format:check` (`prettier --check .`)
   - Result: Exit Code 0 (All files conform to style)
4. **Unit & Property Tests (Vitest):**
   - Command: `pnpm test` (`vitest run`)
   - Result: 33 test files passed, 411 tests passed (0 failures)
   - Duration: 18.54s
5. **Playwright E2E Tests:**
   - Command: `pnpm test:e2e` (`playwright test`)
   - Result: 6 workers, 28 tests passed (0 failures)
   - Duration: 6.1s
6. **WXT Production Extension Build:**
   - Command: `pnpm build` (`node scripts/copy-axe.js && wxt build`)
   - Result: Exit Code 0, built cleanly into `.output/chrome-mv3` (1.3 MB)
7. **Master Pipeline Validation:**
   - Command: `pnpm validate` (`pnpm typecheck && pnpm lint && pnpm test && pnpm build`)
   - Result: Exit Code 0 across all gates

---

## 5. Backward Compatibility & Non-Breaking Invariants

- **Phase 5 Compatibility:** All existing tests and components expecting `resolved: FindingRecord[]` and `metrics.resolvedCount` continue working without modification because `resolved` is maintained as `[...verifiedResolved, ...disappeared]`.
- **Phase 6 Verification Pipeline:** `executeRescanVerification` in `rescan-verifier.ts` continues to function with identical behavior, importing the comparison engine without circular references.
- **Zero Data Mutation:** The comparison engine operates purely as a read-only projection over scan snapshots and optional remediation records.

---

## 6. Conclusion & Gate Readiness

Workstream 2 is complete, verified, and adheres strictly to the architectural specifications and Kiroween 2026 hackathon standards.

**Next Workstream:** Workstream 3 — Comparison UX, Historical Snapshot Selector & Cross-Scan Diff Viewer.  
**Approval Required:** Awaiting explicit user approval before proceeding to Workstream 3.
