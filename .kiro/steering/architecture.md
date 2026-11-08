# Phantom Audit — Architecture Steering

## 1. Stack Boundaries

- **Extension Framework:** WXT (Manifest V3, Chromium target: Chrome, Edge, Brave).
- **Frontend Framework:** React 19 + TypeScript (strict mode).
- **Styling:** Tailwind CSS + CSS custom properties (`tokens.css`).
- **Validation:** Zod schemas at all untrusted boundaries (extension messaging, scanner payloads, storage).
- **Testing:** Vitest (unit & property tests via `fast-check`), Playwright (E2E & smoke tests).

## 2. Forbidden Architectures

- **No Next.js or Node Server Backend:** Phantom Audit is a client-side browser extension.
- **No Remote Code Loading:** `axe-core` and all scripts must be bundled locally inside extension assets. No external script tags, CDNs, or `eval()`.
- **No Heavy 3D Engines:** Three.js is explicitly prohibited in MVP. The mansion must be built with responsive 2D SVG/CSS vectors.
- **No Unsolicited AI Integrations:** Do not send page DOM or audit results to external LLM APIs by default.

## 3. Modular Separation of Concerns

1. `src/entrypoints/background.ts`: Service worker managing active tab eligibility and dashboard launch.
2. `src/entrypoints/dashboard/`: React application shell for mansion navigation, finding inspector, and reports.
3. `src/domain/`: Pure TypeScript interfaces (`scan.ts`, `finding.ts`, `room.ts`, `report.ts`).
4. `src/features/scanner/`: Injection adapter running `axe.run` against target DOM via `chrome.scripting`.
5. `src/features/normalization/`: Schema validation, deterministic fingerprinting, and room mapping.
6. `src/lib/storage/`: Typed local persistence using `chrome.storage.local`.
