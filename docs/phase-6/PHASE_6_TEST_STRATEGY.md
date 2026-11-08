# Phantom Audit — Phase 6 Test & Verification Strategy

## Quality Assurance, Property Testing & End-to-End Validation

**Document Version:** 1.0.0  
**Phase:** 6 of 12  
**Parent Document:** `docs/PHASE_6_EXECUTION_PLAN.md`

---

## 1. Test Architecture & Coverage Matrix

Phase 6 implements a four-tiered testing pyramid:

```text
       ┌─────────────────────────────┐
       │   Playwright E2E Suites     │  6 scenarios
       │   (Real Chromium Extension) │
       ├─────────────────────────────┤
       │   React Component Tests     │  12 tests
       │   (Testing Library / JSDOM) │
       ├─────────────────────────────┤
       │   Property-Based Tests      │  2 fast-check suites (200 runs)
       │   (Malformed HTML Fuzzing)  │
       ├─────────────────────────────┤
       │   Deterministic Unit Tests  │  25 tests
       │   (Engine, Catalog, Tracker)│
       └─────────────────────────────┘
```

---

## 2. Unit Testing Strategy (`tests/unit/remediation/`)

### 2.1 Guidance Engine (`guidance-engine.test.ts`)

- **P0 Rule Coverage:** Validates that all 10 core rules (`button-name`, `link-name`, `color-contrast`, `image-alt`, `svg-img-alt`, `label`, `select-name`, `heading-order`, `landmark-one-main`, `tabindex`) produce complete `RemediationGuidance` objects.
- **Context Awareness:**
  - Given `<button class="btn-close"><svg>...</svg></button>`, verifies the generated snippet preserves `class="btn-close"` and adds an accessible label.
  - Given `<input type="email" id="user-email">`, verifies the generated snippet produces `<label for="user-email">` and `<input type="email" id="user-email">`.
- **Graceful Fallbacks:** Given an unknown or custom rule ID (e.g. `custom-aria-widget`), verifies the engine produces a safe generic remediation guidance structure rather than throwing an error or returning `null`.
- **Escaped Text Guarantees:** Ensures no HTML strings returned by the engine contain executable script or unescaped entity tags.

### 2.2 Remediation Tracker & State Machine (`remediation-tracker.test.ts`)

- **Initial State:** Default status is strictly `'suggested'`.
- **Developer State Toggles:** Successfully transitions `'suggested'` $\to$ `'attempted'` $\to$ `'suggested'`.
- **Anti-Fraud Invariant:** Manual transition to `'verified'` without a rescan is rejected.
- **Cross-Scan Reconciliation:**
  - When finding $\in$ `comparison.resolved` and previous status was `'attempted'`, status transitions to `'verified'`.
  - When finding $\in$ `comparison.unchanged` or `comparison.uncertainMatches` and previous status was `'attempted'`, status transitions to `'unresolved'`.
- **Storage Persistence:** Verifies read/write from `StorageService` under key `phantom_remediation_v1`.

### 2.3 Property-Based Fuzzing (`remediation-fuzz.test.ts`)

Using `fast-check`, fuzzes the guidance engine with arbitrary strings:

```typescript
fc.assert(
  fc.property(
    fc.string(), // arbitrary ruleId
    fc.string(), // arbitrary htmlExcerpt (malformed HTML, script injection, empty)
    (ruleId, excerpt) => {
      const guidance = generateRemediationGuidance({
        ruleId,
        nodes: [{ target: ['#el'], htmlExcerpt: excerpt, failureSummary: 'Fail' }],
      } as any);
      // Invariants:
      // 1. Must never throw
      // 2. Must return valid RemediationGuidance schema
      // 3. Must have non-empty badExample and goodExamples
      return Boolean(guidance && guidance.goodExamples.length > 0);
    }
  ),
  { numRuns: 100 }
);
```

---

## 3. Component & UI Interaction Testing (`tests/unit/components/remediation.test.tsx`)

- **`CodeSnippetViewer`**:
  - Renders syntax tabs (HTML, React, CSS).
  - Clicking a tab switches active code snippet.
  - Clicking "Copy Code" triggers clipboard write and displays visual confirmation `Copied!`.
- **`RemediationGuidancePanel`**:
  - Renders problem description, human impact banner, before/after code blocks, pitfalls, and verification steps.
  - Changing the status dropdown dispatches the `onStatusChange` callback.
- **`VerificationChecklist`**:
  - Toggling checkboxes updates interactive state.

---

## 4. End-to-End Test Suite (`tests/e2e/phase6-remediation.test.ts`)

Executed against the production Chromium extension build:

1. **Inspector Guidance Flow:** Open dashboard in demo mode $\to$ select a finding $\to$ verify remediation guidance panel opens with before/after snippets and human impact callout.
2. **Snippet Tab Switching:** Click "React / JSX" tab $\to$ confirm JSX snippet appears; click "HTML" $\to$ confirm HTML snippet appears.
3. **Copy Code Snippet:** Click "Copy Code" $\to$ confirm visual "Copied!" feedback is displayed.
4. **Remediation Status Lifecycle:** Mark a finding as "Attempted" $\to$ verify the `RemediationStatusBadge` updates to "Attempted" on both the Inspector and Finding Card.
5. **Cross-Scan Verification:** Perform a rescan where a finding is resolved $\to$ verify remediation status automatically transitions to "Verified" with a celebratory indicator.

---

## 5. Regression Test Gate

Executing the complete verification gate:

1. `pnpm typecheck` (0 errors)
2. `pnpm lint` (0 errors)
3. `pnpm format:check` (100% compliant)
4. `pnpm test` (All 165 existing tests + all Phase 6 unit tests pass)
5. `pnpm test:e2e` (All 23 existing E2E tests + Phase 6 E2E tests pass)
6. `pnpm build` (Package size verified under 1.25 MB)
7. `pnpm validate` (Exit code 0)
