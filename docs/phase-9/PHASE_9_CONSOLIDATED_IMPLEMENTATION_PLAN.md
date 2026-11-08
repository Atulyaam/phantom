# Phantom Audit — Phase 9 Consolidated Implementation Blueprint

## Structured Implementation Plan for Workstreams 3, 4, and 5

**Document Version:** 1.0.0  
**Status:** Approved for Implementation Execution  
**Target:** Phase 9 Workstreams 3, 4, and 5  
**Prerequisites:** Workstream 1 (PASS), Workstream 2 (PASS)

---

## Architecture & Implementation Principles

1. **Zero Production Code Drift Until Review:** All architectural changes are specified here in complete detail with exact file paths, diff blueprints, and verification commands.
2. **Strict Manifest V3 Compliance:** Retain `script-src 'self'; object-src 'none';` with zero external network downloads or CDN dependencies.
3. **No Added Dependencies:** Use existing `react`, `lucide-react`, `clsx`, `tailwind-merge`, and pinned `public/vendor/axe.min.js`.
4. **Zero Regressions:** Maintain 100% pass rates across existing 681 unit tests and 55 E2E tests.

---

## Batch 1: Component Accessibility Hardening (Workstream 3)

### Objective

Resolve all catalogued accessibility defects (DEF-931 through DEF-936) across interactive mansion rooms, list views, snapshot history drawer, and activeTab privacy explainer modal.

### Files to Modify

1. `src/components/mansion/MansionRoom.tsx`
2. `src/components/mansion/RoomListView.tsx`
3. `src/components/history/ScanHistoryDrawer.tsx`
4. `src/components/scan/ActiveTabExplainer.tsx`
5. `src/components/scan/ScanControlBar.tsx`
6. `tests/unit/components/mansion.test.tsx`
7. `tests/unit/components/history-components.test.tsx`

---

### Detailed Code Blueprints for Batch 1

#### 1. `src/components/mansion/MansionRoom.tsx` (DEF-931)

- **Problem:** Missing `group` class on parent `<g>` breaks `group-focus-visible:opacity-100` on the focus rectangle `<rect>`. Missing `aria-pressed={isSelected}`.
- **Blueprint Diff:**

```tsx
<<<<
      className="cursor-pointer focus:outline-none transition-transform duration-200"
      style={{ transformOrigin: `${x + width / 2}px ${y + height / 2}px` }}
    >
====
      aria-pressed={isSelected}
      className="group cursor-pointer focus:outline-none transition-transform duration-200"
      style={{ transformOrigin: `${x + width / 2}px ${y + height / 2}px` }}
    >
>>>>
```

#### 2. `src/components/mansion/RoomListView.tsx` (DEF-932)

- **Problem:** Action button text is simply `"Inspect"` or `"Selected"` without room context, creating identical ambiguous items for screen readers.
- **Blueprint Diff:**

```tsx
<<<<
                  <button
                    type="button"
                    onClick={() => onSelectRoom(room.id)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-purple-800 text-white font-semibold'
                        : 'bg-surface-raised hover:bg-surface text-gray-300 hover:text-white border border-border-subtle'
                    }`}
                  >
                    {isSelected ? 'Selected' : 'Inspect'}
                  </button>
====
                  <button
                    type="button"
                    onClick={() => onSelectRoom(room.id)}
                    aria-label={
                      isSelected
                        ? `${room.name} room selected`
                        : `Inspect ${room.name} room details`
                    }
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-purple-800 text-white font-semibold'
                        : 'bg-surface-raised hover:bg-surface text-gray-300 hover:text-white border border-border-subtle'
                    }`}
                  >
                    {isSelected ? 'Selected' : 'Inspect'}
                  </button>
>>>>
```

#### 3. `src/components/history/ScanHistoryDrawer.tsx` (DEF-933)

- **Problem:** Inspect button in snapshot cards has no `aria-label`, unlike the compare and delete buttons which include full snapshot details.
- **Blueprint Diff:**

```tsx
<<<<
                              <button
                                type="button"
                                onClick={() => handleReopen(summary)}
                                disabled={isCurrent}
                                className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
                                  isCurrent
                                    ? 'bg-cyan-900/40 text-cyan-300 border border-cyan-700/40 cursor-default'
                                    : 'bg-purple-800/80 hover:bg-purple-700 text-white border border-purple-600/50'
                                }`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>{isCurrent ? 'Viewing' : 'Inspect'}</span>
                              </button>
====
                              <button
                                type="button"
                                onClick={() => handleReopen(summary)}
                                disabled={isCurrent}
                                aria-label={
                                  isCurrent
                                    ? `Currently viewing snapshot for ${summary.pageTitle || 'Untitled Page'}`
                                    : `Inspect snapshot for ${summary.pageTitle || 'Untitled Page'} (${formattedDate})`
                                }
                                className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
                                  isCurrent
                                    ? 'bg-cyan-900/40 text-cyan-300 border border-cyan-700/40 cursor-default'
                                    : 'bg-purple-800/80 hover:bg-purple-700 text-white border border-purple-600/50'
                                }`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>{isCurrent ? 'Viewing' : 'Inspect'}</span>
                              </button>
>>>>
```

#### 4. `src/components/scan/ActiveTabExplainer.tsx` (DEF-934)

- **Problem:** Lacks keyboard trap, Escape dismissal, auto-focus, backdrop dismiss, and focus restoration to the trigger button.
- **Blueprint Implementation:**

```tsx
import { useEffect, useRef } from 'react';
import { ShieldCheck, Info, X } from 'lucide-react';
import { Button } from '@/components/shared';

interface ActiveTabExplainerProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export function ActiveTabExplainer({ isOpen, onClose, triggerRef }: ActiveTabExplainerProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus close button on open
    const timer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const focusableElements = Array.from(focusable).filter(
          (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
        );

        if (focusableElements.length === 0) return;

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (!dialogRef.current.contains(document.activeElement)) {
          e.preventDefault();
          first?.focus();
          return;
        }

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };

    const triggerEl = triggerRef?.current;
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      triggerEl?.focus();
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="explainer-title"
        className="w-full max-w-md p-6 rounded-2xl bg-surface-raised border border-purple-500/50 shadow-glow space-y-4 text-xs"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-900/40 text-purple-300 border border-purple-700/40">
              <ShieldCheck className="w-5 h-5 text-spectral-accent" aria-hidden="true" />
            </div>
            <h3
              id="explainer-title"
              className="text-sm font-bold text-white font-display"
            >
              Privacy-First Page Access
            </h3>
          </div>
          <Button
            ref={closeButtonRef}
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close Privacy Dialog"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
        ...
```

#### 5. `src/components/scan/ScanControlBar.tsx` (DEF-935)

- **Problem:** Does not instantiate or pass a `triggerRef` to `ActiveTabExplainer`.
- **Blueprint Implementation:**
  - Instantiate `const privacyTriggerRef = useRef<HTMLButtonElement | null>(null);`
  - Attach `ref={privacyTriggerRef}` to the `"activeTab Privacy"` button.
  - Pass `triggerRef={privacyTriggerRef}` to `<ActiveTabExplainer />`.

#### 6. Unit Test Updates (`tests/unit/components/mansion.test.tsx` & `history-components.test.tsx`) (DEF-936)

- Update assertions in `mansion.test.tsx` to verify:
  - `MansionRoom` has `group` class and `aria-pressed`.
  - `RoomListView` inspect buttons have explicit room names in accessible labels: `screen.getByRole('button', { name: /inspect the name chamber room details/i })`.
- Update `history-components.test.tsx` to verify snapshot inspect button accessible names include the snapshot title.

---

## Batch 2: Automated axe-core E2E Test Suite (Workstream 4)

### Objective

Implement an automated end-to-end Playwright accessibility testing suite (`tests/e2e/phase9-accessibility.test.ts`) that executes axe-core across 8 distinct UI states using the local pre-bundled `public/vendor/axe.min.js`.

### File to Create

- `tests/e2e/phase9-accessibility.test.ts`

### Test Architecture Blueprint

```ts
import { test, expect, Page } from '@playwright/test';

// Inject bundled axe.min.js locally (zero CDN / zero network)
async function injectAxe(page: Page) {
  await page.addScriptTag({ path: 'public/vendor/axe.min.js' });
}

// Run WCAG 2.2 AA audit
async function runAxeAudit(page: Page) {
  return await page.evaluate(async () => {
    // @ts-expect-error axe is in global window
    return await window.axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
      },
    });
  });
}

test.describe('Phase 9 — Automated Dashboard axe-core Accessibility Suite', () => {
  // Setup mock chrome API and scan fixtures before each test
  test.beforeEach(async ({ page }) => {
    ...
  });

  test('State 1: Dormant / Unscanned State exhibits 0 axe-core violations', async ({ page }) => {
    await page.goto('/dashboard.html');
    await injectAxe(page);
    const results = await runAxeAudit(page);
    expect(results.violations).toEqual([]);
  });

  test('State 2: Active Audited State (Mansion Map View) exhibits 0 axe-core violations', async ({ page }) => {
    ...
    await injectAxe(page);
    const results = await runAxeAudit(page);
    expect(results.violations).toEqual([]);
  });

  test('State 3: Active Audited State (Room List Table View) exhibits 0 axe-core violations', async ({ page }) => {
    ...
    await injectAxe(page);
    const results = await runAxeAudit(page);
    expect(results.violations).toEqual([]);
  });

  test('State 4: Finding Inspector Open exhibits 0 axe-core violations', async ({ page }) => {
    ...
    await injectAxe(page);
    const results = await runAxeAudit(page);
    expect(results.violations).toEqual([]);
  });

  test('State 5: ActiveTab Privacy Explainer Dialog Open exhibits 0 axe-core violations', async ({ page }) => {
    ...
    await injectAxe(page);
    const results = await runAxeAudit(page);
    expect(results.violations).toEqual([]);
  });

  test('State 6: The Archive Drawer Open exhibits 0 axe-core violations', async ({ page }) => {
    ...
    await injectAxe(page);
    const results = await runAxeAudit(page);
    expect(results.violations).toEqual([]);
  });

  test('State 7: Cross-Scan Comparison View Active exhibits 0 axe-core violations', async ({ page }) => {
    ...
    await injectAxe(page);
    const results = await runAxeAudit(page);
    expect(results.violations).toEqual([]);
  });

  test('State 8: Export Report Dialog Open exhibits 0 axe-core violations', async ({ page }) => {
    ...
    await injectAxe(page);
    const results = await runAxeAudit(page);
    expect(results.violations).toEqual([]);
  });
});
```

---

## Batch 3: Verification, Release Gate & Manual QA Protocols (Workstream 5)

### Objective

Execute the full regression verification suite, validate production bundle budgets, and execute standardized manual QA protocols.

### 1. Automated Verification Pipeline Commands

```powershell
# 1. Typecheck
pnpm typecheck

# 2. Linting (Zero warnings allowed)
pnpm lint

# 3. Code Formatting
pnpm format:check

# 4. Unit & Component Test Suite
pnpm test

# 5. Playwright E2E Suite (Including Phase 9 Accessibility Suite)
pnpm test:e2e

# 6. Production Extension Build
pnpm build

# 7. Production Packaging
pnpm zip
```

### 2. Packaging Budget Verification Check

```powershell
# Measure uncompressed .output/chrome-mv3 bundle size
$distSize = (Get-ChildItem -Recurse .output/chrome-mv3 | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "Uncompressed bundle size: $distSize MB (Budget: < 3.5 MB)"
```

### 3. Standardized Manual QA Protocols

#### Protocol A: Windows High Contrast / Forced Colors Mode

1. Enable Windows High Contrast / Desert or Night Sky mode.
2. Verify all text, icons, borders, and buttons remain distinct.
3. Verify mansion rooms, table rows, and status badges preserve visual boundaries.

#### Protocol B: 200% and 400% Browser Zoom

1. Set browser zoom to 200%.
2. Verify all navigation elements reflow without horizontal scrolling on the root viewport.
3. Increase zoom to 400%.
4. Verify text wraps cleanly inside finding descriptions, cards, and modal dialogs.

#### Protocol C: Keyboard-Only Workflow Traversal

1. Disconnect or ignore mouse.
2. Navigate the complete workflow solely via `Tab`, `Shift+Tab`, `Enter`, `Space`, `Arrow Keys`, and `Escape`:
   - Start scan via keyboard.
   - Switch between Mansion Map and List View.
   - Open Finding Inspector and toggle reviewed status.
   - Open ActiveTab Privacy Explainer and dismiss via Escape.
   - Open Archive Drawer, select a past scan, and return focus to trigger.
   - Open Export Dialog, select HTML report with Full Redaction, and download.

#### Protocol D: Reduced Motion Conformance

1. Enable `prefers-reduced-motion: reduce` in OS / DevTools.
2. Toggle the dashboard "Reduced Motion: Enabled" setting.
3. Verify that pulses, transitions, spinning ghost icons, and drawer slides are replaced with immediate transitions.

#### Protocol E: Screen Reader Announcement Verification

1. Activate NVDA or Windows Narrator.
2. Verify live region announcements on scan completion, historical snapshot loading, and archive purge.
3. Verify that all buttons announced in rotor have distinct, informative accessible names.
