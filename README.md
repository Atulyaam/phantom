# Phantom Audit 👻🏰

> **Kiroween 2026 | Costume Contest Category**  
> Privacy-first Chromium browser extension that turns web accessibility defects into an interactive haunted Victorian mansion.

---

## 1. What is Phantom Audit?

Accessibility audits can often be intimidating, technical, and dry. **Phantom Audit** transforms real website accessibility findings into rooms inside a haunted mansion:

- **The Name Chamber:** Missing or invalid accessible names (`button-name`, `link-name`).
- **The Contrast Crypt:** Contrast violations on text and interface elements.
- **The Portrait Gallery:** Images missing alternative text (`image-alt`).
- **The Form Cellar:** Form controls missing associated labels.
- **The Structure Hall:** Broken heading hierarchies, landmarks, and list structures.
- **The Focus Corridor:** Focus traps, invisible indicators, and keyboard order issues.
- **The Unmapped Catacombs:** Unmapped or emerging WCAG findings.

Fix the accessibility bug in your source code, rescan the page, and watch that room become peaceful.

---

## 2. Product Principles & Privacy Guarantees

1. **Real Findings First:** Every ghost represents a genuine automated finding detected on the active page via locally bundled `axe-core`.
2. **Privacy by Default:** Scans run 100% locally in the browser sandbox. Zero page HTML, form values, cookies, or credentials are sent to external servers.
3. **No False Certification Claims:** Zero automated findings does not certify WCAG 2.2 conformance. Manual keyboard, screen-reader, and cognitive testing are essential.
4. **Self-Accessibility:** Phantom Audit's interface is itself built to meet WCAG 2.2 AA standards (keyboard-operable, high-contrast focus rings, reduced-motion controls, and tabular view alternatives).
5. **Minimal Permissions:** Declares only `activeTab`, `scripting`, and `storage`. No `<all_urls>` or broad host permissions.

---

## 3. Technology Stack

- **Extension Framework:** [WXT](https://wxt.dev/) (Manifest V3)
- **UI Framework:** React 19 + TypeScript (Strict Mode)
- **Styling:** Tailwind CSS + Custom CSS Variables (`tokens.css`)
- **Data Validation:** Zod
- **Testing:** Vitest, fast-check (Property-Based Testing), Playwright (E2E & Smoke Testing)
- **Code Quality:** ESLint 9 (Flat Config), Prettier
- **Package Manager:** `pnpm`

---

## 4. Quick Start & Local Development

### Prerequisites

- **Node.js:** `>= 20.0.0` (Recommended: v22 LTS or v24)
- **pnpm:** `>= 9.0.0` (Recommended: v11.25.0)

### 1. Installation

```bash
git clone https://github.com/username/phantom-audit.git
cd phantom-audit
pnpm install
```

### 2. Development Mode

Starts WXT development server with Hot Module Replacement (HMR):

```bash
pnpm dev
```

### 3. Production Build

Compiles the extension into `.output/chrome-mv3`:

```bash
pnpm build
```

---

## 5. Loading the Extension in Chromium (Chrome / Edge / Brave)

1. Open your browser and navigate to `chrome://extensions` (or `edge://extensions`).
2. Toggle on **Developer mode** in the top right corner.
3. Click **Load unpacked**.
4. Select the `.output/chrome-mv3` folder inside the project directory.
5. The **Phantom Audit** icon will appear in your browser extension bar.
6. Open any regular webpage and click the extension icon to launch the haunted mansion dashboard.

---

## 6. Testing & Quality Commands

```bash
# Run Vitest unit & property-based tests (27 tests)
pnpm test

# Run Playwright Chromium smoke test suite (4 tests)
pnpm test:e2e

# Run strict TypeScript typechecking
pnpm typecheck

# Run ESLint
pnpm lint

# Run Prettier code style check
pnpm format:check

# Run complete quality validation pipeline (typecheck + lint + test + build)
pnpm validate
```

---

## 7. Project Documentation

- **Master Specification:** [`04_phantom_audit_project_spec_kiroween_2026.md`](./04_phantom_audit_project_spec_kiroween_2026.md) (Preserved Primary Reference)
- **System Architecture:** [`docs/architecture.md`](./docs/architecture.md)
- **Architecture Decision Record (ADR-001):** [`docs/architecture-decisions/ADR-001-architecture.md`](./docs/architecture-decisions/ADR-001-architecture.md)
- **Privacy Policy & Guarantees:** [`docs/privacy.md`](./docs/privacy.md)
- **Security & Threat Model:** [`docs/security.md`](./docs/security.md)
- **Quality & Testing Strategy:** [`docs/testing.md`](./docs/testing.md)
- **Kiro Intelligence:** [`.kiro/steering/`](./.kiro/steering/) and [`.kiro/specs/`](./.kiro/specs/)

---

## 8. License

Licensed under the [Apache License, Version 2.0](./LICENSE).
