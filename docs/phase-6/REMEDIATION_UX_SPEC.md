# Phantom Audit — Remediation User Experience & Interface Specification

## Subsystem: `src/components/remediation/`

**Document Version:** 1.0.0  
**Phase:** 6 of 12  
**Parent Document:** `docs/PHASE_6_EXECUTION_PLAN.md`

---

## 1. UX Design Philosophy

Remediation guidance in Phantom Audit must never resemble dry regulatory compliance checklists. It is engineered as an **interactive masterclass** in modern, accessible frontend development:

1. **Clear Mental Model:** Emphasizes _Why It Matters_ first to build developer empathy.
2. **Contextual Actionability:** Code snippets mirror the developer's actual HTML context.
3. **Multi-Syntax Fluency:** Provides instant tabbed switches between Vanilla HTML, React JSX, and CSS.
4. **Honest Progress Feedback:** Triage statuses (`Suggested` $\to$ `Attempted` $\to$ `Verified` / `Unresolved`) maintain absolute truth in advertising — never declaring victory until verified by a rescan.

```text
┌────────────────────────────────────────────────────────────────────────┐
│  Remediation Guidance: button-name                                     │
│  The Name Chamber • WCAG 4.1.2 Level A                                │
├────────────────────────────────────────────────────────────────────────┤
│  👤 Human Impact                                                       │
│  "Screen reader users hear 'button' with zero purpose. Voice control   │
│   users cannot speak the button name to activate it."                 │
├────────────────────────────────────────────────────────────────────────┤
│  ❌ Current Anti-Pattern                                               │
│  <button class="btn-icon"><svg>...</svg></button>                      │
│  Why this fails: Missing accessible name.                              │
├────────────────────────────────────────────────────────────────────────┤
│  ✅ Recommended Solutions                                              │
│  [HTML (Native)]   [React / JSX]   [CSS Utility]      [📋 Copy Code]  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 1 <button class="btn-icon" type="button" aria-label="Close">     │  │
│  │ 2   <svg aria-hidden="true" viewBox="0 0 24 24">...</svg>        │  │
│  │ 3 </button>                                                      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│  ⚠️ Pitfalls to Avoid                                                  │
│  • Do not add aria-hidden="true" to the <button> element itself.       │
│  • Always specify type="button" to prevent unwanted form submissions.  │
├────────────────────────────────────────────────────────────────────────┤
│  🔍 How to Verify This Correction                                      │
│  [ ] 1. Keyboard: Press Tab to focus element; confirm visible ring.    │
│  [ ] 2. Screen Reader: Focus element; hear 'Close, button'.           │
│  [ ] 3. Audit Rescan: Click 'Start Audit' to verify via diff.          │
├────────────────────────────────────────────────────────────────────────┤
│  Status: [ Suggested | Attempted | Verified | Unresolved ]             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Architecture & Hierarchy

```
src/components/remediation/
├── index.ts                      # Clean barrel exports
├── RemediationGuidancePanel.tsx  # Main orchestration container in FindingInspector
├── CodeSnippetViewer.tsx         # Multi-language code viewer with tabs & copy
├── BeforeAfterDiffView.tsx       # Visual side-by-side comparison of bad vs good code
├── HumanImpactCallout.tsx        # Empathy banner with user group icons
├── VerificationChecklist.tsx     # Interactive verification steps with checkboxes
└── RemediationStatusBadge.tsx    # Compact status pill indicator
```

---

## 3. Detailed Component Specifications

### 3.1 `RemediationStatusBadge`

Renders a semantic pill reflecting the finding's remediation lifecycle state:

| Status       | Badge Color / Styling                                      | Meaning                              | Icon           |
| ------------ | ---------------------------------------------------------- | ------------------------------------ | -------------- |
| `suggested`  | `bg-purple-950/60 text-purple-300 border-purple-700/50`    | Issue detected, guidance ready       | `Sparkles`     |
| `attempted`  | `bg-amber-950/60 text-amber-300 border-amber-700/50`       | Developer marked fix applied in code | `Wrench`       |
| `verified`   | `bg-emerald-950/60 text-emerald-300 border-emerald-700/50` | Rescan confirmed finding resolved    | `CheckCircle2` |
| `unresolved` | `bg-red-950/60 text-red-300 border-red-700/50`             | Attempted fix failed upon rescan     | `AlertCircle`  |

### 3.2 `CodeSnippetViewer`

- **Language Tabs:** `HTML (Native)`, `React / JSX`, `CSS`.
- **Keyboard Navigation:** Tab switches accessible via Arrow Left / Arrow Right (`role="tablist"`).
- **Line Numbers:** Accessible monospace numbers in muted purple.
- **Copy Action:**
  - Accessible button with `aria-label="Copy code snippet to clipboard"`.
  - Visual feedback: icon transitions from `Copy` to `Check` and text switches to `"Copied!"` for 2 seconds.
- **Security:** Renders text strictly inside `<pre><code>{escapedSnippet}</code></pre>`.

### 3.3 `HumanImpactCallout`

- Distinct visual container (`bg-cyan-950/20 border-cyan-800/40 text-cyan-200`).
- Highlights user groups affected (e.g. `Screen Readers`, `Keyboard Only`, `Low Vision`, `Cognitive`).

### 3.4 `VerificationChecklist`

- Interactive step-by-step checklist:
  - Step 1: Keyboard test instructions (keys to press, expected focus behavior).
  - Step 2: Screen reader announcement expectations.
  - Step 3: Rescan instruction linking to the extension scan action.
- Checkboxes maintain local UI state so developers can check off steps as they test.

---

## 4. Accessibility Specifications (WCAG 2.2 AA)

1. **Color Contrast:** All text in the remediation panel meets minimum $4.5:1$ contrast against dark surfaces (`--color-surface-raised` and `--color-base`).
2. **Focus Visibility:** All interactive tabs, copy buttons, and status toggles have a prominent `focus-visible:ring-2 focus-visible:ring-cyan-400`.
3. **Screen Reader Announcements:** When a snippet is copied, an invisible `aria-live="polite"` region announces _"Code snippet copied to clipboard"_.
4. **Reduced Motion:** Syntax tab transitions and copy feedback respect `--motion-safe` tokens.
