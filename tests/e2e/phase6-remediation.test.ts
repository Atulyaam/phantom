import { test, expect } from '@playwright/test';

test.describe('Phantom Audit Phase 6 — Interactive Remediation Guidance Suite', () => {
  test('inspects a finding and verifies all remediation guidance sections render', async ({
    page,
  }) => {
    await page.goto('/dashboard.html?demo=1');

    // Find and inspect the button-name finding card
    const card = page.locator('article[data-rule-id="button-name"]').first();
    await expect(card).toBeVisible();

    // Verify finding card has initial Suggested remediation badge
    await expect(
      card.getByRole('status', { name: /remediation status: suggested/i })
    ).toBeVisible();

    const inspectBtn = card.getByRole('button', { name: /inspect/i });
    await inspectBtn.click();

    // Inspector should open
    const inspector = page.locator('aside[aria-labelledby="inspector-heading"]');
    await expect(inspector).toBeVisible();

    // Verify Remediation Guidance section header
    await expect(
      inspector.getByRole('heading', { name: /remediation guidance/i })
    ).toBeVisible();

    // Verify Normative WCAG Classification
    await expect(inspector.getByText(/normative wcag failure/i)).toBeVisible();

    // Verify Why it Matters and Root Cause
    await expect(inspector.getByText(/why it matters/i)).toBeVisible();
    await expect(inspector.getByText(/root cause analysis/i)).toBeVisible();

    // Verify Anti-Pattern Inaccessible Code
    await expect(
      inspector.getByText(/anti-pattern \(inaccessible code\)/i)
    ).toBeVisible();

    // Verify Recommended Accessible Solutions
    await expect(inspector.getByText(/recommended accessible solutions/i)).toBeVisible();

    // Verify Verification Checklist
    await expect(inspector.getByText(/verification checklist/i)).toBeVisible();
  });

  test('switches language tabs in CodeSnippetViewer and copies code snippet', async ({
    page,
  }) => {
    try {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    } catch {
      // Ignore if browser environment does not support clipboard permission grant
    }

    await page.goto('/dashboard.html?demo=1');

    const card = page.locator('article[data-rule-id="button-name"]').first();
    await card.getByRole('button', { name: /inspect/i }).click();

    const inspector = page.locator('aside[aria-labelledby="inspector-heading"]');
    await expect(inspector).toBeVisible();

    // Initially HTML tab is active
    const htmlTab = inspector.getByRole('tab', { name: /html/i }).first();
    await expect(htmlTab).toBeVisible();
    await expect(htmlTab).toHaveAttribute('aria-selected', 'true');

    // Click React / JSX tab
    const reactTab = inspector.getByRole('tab', { name: /react/i }).first();
    await expect(reactTab).toBeVisible();
    await reactTab.click();
    await expect(reactTab).toHaveAttribute('aria-selected', 'true');

    // Click Copy Snippet button
    const copySnippetBtn = inspector.getByRole('button', {
      name: /copy .* react/i,
    });
    await expect(copySnippetBtn).toBeVisible();
    await copySnippetBtn.click();

    // Verify Copied! feedback
    await expect(inspector.getByText(/copied!/i)).toBeVisible();
  });

  test('interacts with VerificationChecklist without triggering false verification', async ({
    page,
  }) => {
    await page.goto('/dashboard.html?demo=1');

    const card = page.locator('article[data-rule-id="button-name"]').first();
    await card.getByRole('button', { name: /inspect/i }).click();

    const inspector = page.locator('aside[aria-labelledby="inspector-heading"]');
    await expect(inspector).toBeVisible();

    // Find checkboxes in verification checklist
    const checkboxes = inspector.getByRole('checkbox');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Initial progress counter
    await expect(
      inspector.getByText(new RegExp(`0 of ${count} manual tests checked`, 'i'))
    ).toBeVisible();

    // Click first checkbox
    await checkboxes.first().click();

    // Counter updates
    await expect(
      inspector.getByText(new RegExp(`1 of ${count} manual tests checked`, 'i'))
    ).toBeVisible();

    // Invariant: Status must still be Suggested (manual checklist does not verify)
    await expect(
      inspector.getByRole('status', { name: /remediation status: suggested/i }).first()
    ).toBeVisible();

    // Certification notice is visible
    await expect(inspector.getByText(/certification notice:/i)).toBeVisible();
  });

  test('executes user remediation status transitions (Mark Attempted -> Reset Suggested)', async ({
    page,
  }) => {
    await page.goto('/dashboard.html?demo=1');

    const card = page.locator('article[data-rule-id="button-name"]').first();
    await card.getByRole('button', { name: /inspect/i }).click();

    const inspector = page.locator('aside[aria-labelledby="inspector-heading"]');
    await expect(inspector).toBeVisible();

    // Invariant: Verify that NO manual "Verify" button exists
    await expect(
      inspector.getByRole('button', { name: /mark as verified/i })
    ).toHaveCount(0);
    await expect(inspector.getByRole('button', { name: /^verify$/i })).toHaveCount(0);

    // Click "Mark as Attempted"
    const markAttemptedBtn = inspector.getByRole('button', {
      name: /mark finding remediation as attempted/i,
    });
    await expect(markAttemptedBtn).toBeVisible();
    await markAttemptedBtn.click();

    // Badge updates to Attempted
    await expect(
      inspector.getByRole('status', { name: /remediation status: attempted/i }).first()
    ).toBeVisible();

    // "Mark as Attempted" button is gone, "Reset to Suggested" is now visible
    await expect(markAttemptedBtn).toHaveCount(0);
    const resetSuggestedBtn = inspector.getByRole('button', {
      name: /reset finding remediation status to suggested/i,
    });
    await expect(resetSuggestedBtn).toBeVisible();

    // Click "Reset to Suggested"
    await resetSuggestedBtn.click();

    // Badge reverts to Suggested
    await expect(
      inspector.getByRole('status', { name: /remediation status: suggested/i }).first()
    ).toBeVisible();
  });

  test('displays regression indicator on cards and in inspector when finding regresses', async ({
    page,
  }) => {
    // Navigate and seed a regressed remediation record into localStorage
    await page.goto('/dashboard.html?demo=1');

    await page.evaluate(() => {
      const regressedPayload = {
        'v1:button-name:demo-btn-1': {
          fingerprint: 'v1:button-name:demo-btn-1',
          status: 'unresolved',
          updatedAt: new Date().toISOString(),
          isRegression: true,
          regressionDetectedAt: new Date().toISOString(),
          previouslyVerifiedAtScanId: '00000000-0000-0000-0000-000000000001',
        },
      };
      localStorage.setItem('phantom_remediation_v1', JSON.stringify(regressedPayload));
    });

    // Reload with seeded state
    await page.reload();

    const card = page.locator('article[data-rule-id="button-name"]').first();
    await expect(card).toBeVisible();

    // Verify regression pill indicator is rendered on the finding card
    await expect(card.getByLabel('Regression detected', { exact: true })).toBeVisible();
    await expect(card.getByText('Regression', { exact: true })).toBeVisible();

    // Inspect the finding
    await card.getByRole('button', { name: /inspect/i }).click();
    const inspector = page.locator('aside[aria-labelledby="inspector-heading"]');
    await expect(inspector).toBeVisible();

    // Verify regression alert box is visible inside the inspector
    const alert = inspector.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert.getByText(/regression detected/i)).toBeVisible();
    await expect(
      alert.getByText(/previously verified resolved, but has resurfaced/i)
    ).toBeVisible();
  });
});
