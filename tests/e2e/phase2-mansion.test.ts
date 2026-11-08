import { test, expect } from '@playwright/test';

test.describe('Phantom Audit Phase 2 — Mansion UI & Interaction Suite', () => {
  test('renders 2D SVG mansion map with 7 accessible rooms', async ({ page }) => {
    await page.goto('/dashboard.html?demo=1');

    // Verify SVG container
    const mansionSvg = page.locator('svg[role="img"]');
    await expect(mansionSvg).toBeVisible();

    // Verify Demo Banner
    await expect(page.getByText(/demonstration mode active/i)).toBeVisible();
    await expect(page.getByText(/mock data/i)).toBeVisible();

    // Check all 7 rooms exist as interactive SVG elements
    const rooms = [
      'The Name Chamber',
      'The Contrast Crypt',
      'The Portrait Gallery',
      'The Form Cellar',
      'The Structure Hall',
      'The Focus Corridor',
      'The Unmapped Catacombs',
    ];

    for (const room of rooms) {
      const roomEl = page.locator(`g[role="button"][aria-label*="${room}"]`);
      await expect(roomEl).toBeVisible();
    }
  });

  test('interactively inspects room findings and opens finding inspector', async ({
    page,
  }) => {
    await page.goto('/dashboard.html?demo=1');

    // Click on The Name Chamber room in SVG
    const nameChamber = page.locator('g[role="button"][aria-label*="The Name Chamber"]');
    await nameChamber.click();

    // Verify Room Detail Panel opened
    const detailHeading = page.getByRole('heading', {
      name: /the name chamber taxonomy inspector/i,
    });
    await expect(detailHeading).toBeVisible();

    // Verify FindingCard is present with rule and WCAG tags
    await expect(page.getByText(/buttons must have discernible text/i)).toBeVisible();
    await expect(page.locator('article[data-rule-id="button-name"]')).toBeVisible();

    // Click "Show Details" on the button-name card to expand code snippet
    const card = page.locator('article[data-rule-id="button-name"]');
    const showDetailsBtn = card.getByRole('button', { name: /show details/i });
    await showDetailsBtn.click();
    await expect(card.locator('code').first()).toBeVisible();

    // Click "Inspect" button to open full Finding Inspector
    const inspectBtn = card.getByRole('button', { name: /^inspect$/i });
    await inspectBtn.click();

    // Verify Finding Inspector panel opened
    const inspectorHeading = page.locator('#inspector-heading');
    await expect(inspectorHeading).toBeVisible();
    await expect(page.getByText(/remediation guidance/i)).toBeVisible();
    await expect(page.getByText(/affected elements/i)).toBeVisible();

    // Close Inspector
    const closeInspectorBtn = page.getByRole('button', {
      name: /close finding inspector/i,
    });
    await closeInspectorBtn.click();
    await expect(inspectorHeading).not.toBeVisible();
  });

  test('switches to table view and preserves room selection', async ({ page }) => {
    await page.goto('/dashboard.html?demo=1');

    // Select room
    const contrastCrypt = page.locator(
      'g[role="button"][aria-label*="The Contrast Crypt"]'
    );
    await contrastCrypt.click();

    await expect(
      page.getByRole('heading', {
        name: /the contrast crypt taxonomy inspector/i,
      })
    ).toBeVisible();

    // Switch to List View
    const listTab = page.getByRole('button', { name: /list view/i });
    await listTab.click();

    // Table must be visible
    await expect(page.getByRole('table')).toBeVisible();

    // The detail panel should still be open
    await expect(
      page.getByRole('heading', {
        name: /the contrast crypt taxonomy inspector/i,
      })
    ).toBeVisible();
  });

  test('toggles simulation between dormant and demo modes', async ({ page }) => {
    await page.goto('/dashboard.html');

    // Initially Dormant
    await expect(page.getByText('Dormant (Unscanned)')).toBeVisible();

    // Verify unscanned rooms are marked as Not Checked, NOT clean/quiet
    const roomButton = page.locator('g[role="button"][aria-label*="The Name Chamber"]');
    await expect(roomButton).toHaveAttribute('aria-label', /not yet scanned/i);

    // Click Load Demo
    const loadDemoBtn = page.getByRole('button', {
      name: /load demo haunted findings/i,
    });
    await loadDemoBtn.click();

    // Demo Mode is active
    await expect(page.getByText('Haunted Demo (Mock Fixtures)')).toBeVisible();
    await expect(page.getByText(/demonstration mode active/i)).toBeVisible();

    // In demo mode, room shows haunted status with finding count
    await expect(roomButton).toHaveAttribute('aria-label', /finding/i);

    // Switch back to dormant
    const switchBackBtn = page.getByRole('button', {
      name: /switch to unscanned state/i,
    });
    await switchBackBtn.click();
    await expect(page.getByText('Dormant (Unscanned)')).toBeVisible();
  });

  test('toggles reduced-motion preference and applies motion-reduce styling', async ({
    page,
  }) => {
    await page.goto('/dashboard.html');

    const toggleBtn = page.getByRole('button', {
      name: /reduced motion: disabled/i,
    });
    await expect(toggleBtn).toBeVisible();

    // Click to enable
    await toggleBtn.click();
    await expect(
      page.getByRole('button', { name: /reduced motion: enabled/i })
    ).toBeVisible();

    // Check that root container has motion-reduce class
    const rootContainer = page.locator('#main-content').locator('xpath=..');
    await expect(rootContainer).toHaveClass(/motion-reduce/);
  });

  test('verifies responsive layout at narrow mobile viewport (375x667)', async ({
    page,
  }) => {
    // Set viewport to mobile phone
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard.html?demo=1');

    // Header, banner, and mansion map must remain visible without horizontal scrollbar
    await expect(
      page.getByRole('heading', { level: 1, name: /phantom audit/i })
    ).toBeVisible();
    await expect(page.locator('svg[role="img"]')).toBeVisible();

    // Check scroll width does not cause horizontal blowout
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });
});
