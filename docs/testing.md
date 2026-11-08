# Phantom Audit — Quality Infrastructure & Testing Strategy

**Document Version:** 1.0.0  
**Phase:** 1 (Foundation)

---

## 1. Testing Philosophy

Phantom Audit verifies both sides of the product:

1. **The Scanner's Correctness:** Deterministic result normalization, finding fingerprinting, room mapping, and report export schemas.
2. **The Product's Own Accessibility:** Full keyboard operability, focus visibility, contrast compliance, and screen-reader semantics targeting WCAG 2.2 AA.

---

## 2. Test Suites

### 2.1 Unit & Property-Based Tests (Vitest + fast-check)

Located in `tests/unit/`:

- **`domain-validation.test.ts`**: Verifies Zod schemas for `ScanRecord`, `FindingRecord`, `Impact`, `RoomId`, and inter-process message envelopes. Tests boundary conditions and rejection of invalid data.
- **`room-mapping.test.ts`**: Validates deterministic mapping from axe rule IDs to Mansion Rooms, coverage of all 7 rooms, and includes fast-check property tests ensuring any arbitrary string input safely produces a valid `RoomId`.
- **`fingerprint.test.ts`**: Tests stable finding fingerprint generation (`v1:{ruleId}:{sortedTargets}`), whitespace normalization, and fast-check property tests proving target array order-invariance.
- **`storage.test.ts`**: Tests `StorageService` for local preferences, atomic scan persistence, retrieval, deletion, and full wipe.
- **`app-shell.test.tsx`**: Tests React application shell rendering, branding, skip-to-content links, reduced motion toggle, Mansion Map vs List View modes, and unsupported page warnings.

### 2.2 Browser Smoke Tests (Playwright)

Located in `tests/e2e/`:

- **`smoke.test.ts`**: Launches Chromium against the extension dashboard build:
  - Validates error-free console output.
  - Verifies keyboard Tab navigation to the skip link and main landmarks.
  - Tests interactive view switching between Mansion Map (2D vector grid) and List View (accessible data table).
  - Tests unsupported browser-internal page alerts.

---

## 3. Execution Commands

```bash
# Run all Vitest unit and property tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with code coverage report
pnpm test:coverage

# Run Playwright Chromium smoke test suite
pnpm test:e2e

# Run complete quality validation pipeline (typecheck + lint + test + build)
pnpm validate
```
