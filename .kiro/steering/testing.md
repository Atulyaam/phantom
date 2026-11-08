# Phantom Audit — Testing Steering

## 1. Test Pyramid & Tooling

- **Unit & Property Tests:** Vitest + `fast-check` (targeting domain models, normalizers, room mappers, fingerprints, storage).
- **Integration Tests:** Fixture-based scanning tests verifying `axe-core` rule detection against controlled HTML samples.
- **Browser E2E / Smoke Tests:** Playwright testing Chromium extension loading, dashboard rendering, keyboard accessibility, and state transitions.

## 2. Test Quality Rules

1. **Determinism:** Tests must be 100% deterministic with zero arbitrary `sleep` or timeout waits. Use event-driven `waitFor`.
2. **Property-based Invariants:**
   - Room mapping must deterministically map any arbitrary string to a valid `RoomId`.
   - Fingerprint generation must be order-invariant regarding target element arrays.
   - Comparison algorithm must strictly categorize findings as `resolved`, `unchanged`, or `new`.
3. **No Test Suppression:** Never delete or skip tests to mask build failures. Fix the root implementation defect.
