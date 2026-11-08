# Phantom Audit — Self-Accessibility Steering

## 1. Compliance Target: WCAG 2.2 AA

Phantom Audit's user interface must itself be accessible to all developers and testers.

## 2. Mandatory Accessibility Rules

1. **Keyboard Operability (2.1.1, 2.1.2):**
   - Every interactive control must be operable via Tab / Enter / Space / Arrow keys.
   - Zero keyboard traps.
   - Visible skip-to-content link on the dashboard.
2. **Focus Visibility (2.4.7, 2.4.11):**
   - High-contrast 3px focus ring with 2px offset (`var(--focus-ring)`). Never use `outline: none` without replacement.
3. **Reduced Motion (2.3.3):**
   - Automatically adhere to `@media (prefers-reduced-motion: reduce)`.
   - Provide explicit in-app toggle for reduced motion. Zero non-essential animations when active.
4. **Color & Contrast (1.4.1, 1.4.3, 1.4.11):**
   - Normal text contrast >= 4.5:1 against dark surfaces.
   - Large text and graphical components >= 3:1 contrast.
   - Status must never be conveyed by color alone (always combine color with text badges and semantic icons).
5. **Alternative Representations (1.1.1):**
   - The 2D SVG Haunted Mansion must always offer a full, accessible tabular/list view alternative with identical data.
6. **Assistive Technology Announcements (4.1.3):**
   - Use `aria-live="polite"` regions for scan progress and scan status changes to avoid overwhelming screen-reader users.
