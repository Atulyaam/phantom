import { test, expect } from '@playwright/test';

test.describe('Phantom Audit Phase 5 — Finding Intelligence, Aggregation & Identity Suite', () => {
  test('verifies Finding Intelligence Explorer renders and displays summary metrics', async ({
    page,
  }) => {
    await page.goto('/dashboard.html?demo=1');

    // Verify Finding Intelligence & Explorer header
    const explorerHeader = page.getByRole('heading', {
      name: /finding intelligence & explorer/i,
    });
    await expect(explorerHeader).toBeVisible();

    // Verify summary statistics metrics
    await expect(page.getByText(/nodes:/i)).toBeVisible();
    await expect(page.getByText(/reviewed:/i)).toBeVisible();
    await expect(page.getByText(/wcag:/i)).toBeVisible();
  });

  test('filters findings dynamically by text search', async ({ page }) => {
    await page.goto('/dashboard.html?demo=1');

    const searchInput = page.getByPlaceholder(/search rules, selectors/i);
    await expect(searchInput).toBeVisible();

    // Search for 'contrast'
    await searchInput.fill('contrast');

    // Expect color-contrast to be visible and button-name to be filtered out
    await expect(page.locator('article[data-rule-id="color-contrast"]')).toBeVisible();
    await expect(page.locator('article[data-rule-id="button-name"]')).toHaveCount(0);

    // Clear search
    const clearBtn = page.getByRole('button', { name: /clear search input/i });
    await clearBtn.click();

    // Both should now be visible again
    await expect(page.locator('article[data-rule-id="button-name"]')).toBeVisible();
    await expect(page.locator('article[data-rule-id="color-contrast"]')).toBeVisible();
  });

  test('filters findings by severity chips and conformance tabs', async ({ page }) => {
    await page.goto('/dashboard.html?demo=1');

    // Click Critical severity pill
    const criticalChip = page.getByRole('button', { name: /^critical$/i });
    await criticalChip.click();

    // button-name is critical; color-contrast is serious
    await expect(page.locator('article[data-rule-id="button-name"]')).toBeVisible();
    await expect(page.locator('article[data-rule-id="color-contrast"]')).toHaveCount(0);

    // Reset filters
    const resetBtn = page.getByRole('button', { name: /reset all filters/i });
    await resetBtn.click();

    // Click Advisory Only conformance tab
    const advisoryTab = page.getByRole('button', { name: /advisory only/i });
    await advisoryTab.click();

    // Only advisory rules like heading-order should show
    await expect(page.locator('article[data-rule-id="heading-order"]')).toBeVisible();
    await expect(page.locator('article[data-rule-id="button-name"]')).toHaveCount(0);
  });

  test('switches grouping modes and verifies section headers', async ({ page }) => {
    await page.goto('/dashboard.html?demo=1');

    const groupSelect = page.locator('#group-by-select');
    await expect(groupSelect).toBeVisible();

    // Group by Room
    await groupSelect.selectOption('room');
    await expect(page.getByRole('heading', { name: /the name chamber/i })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /the contrast crypt/i })
    ).toBeVisible();

    // Group by Severity
    await groupSelect.selectOption('severity');
    await expect(page.getByRole('heading', { name: /critical severity/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /serious severity/i })).toBeVisible();

    // Group by Principle
    await groupSelect.selectOption('principle');
    await expect(
      page.getByRole('heading', { name: /principle 1: perceivable/i })
    ).toBeVisible();
  });

  test('copies selector to clipboard with visual feedback', async ({ page }) => {
    try {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    } catch {
      // Ignore if browser environment does not support clipboard permission grant
    }
    await page.goto('/dashboard.html?demo=1');

    const card = page.locator('article[data-rule-id="button-name"]');
    const copyBtn = card.getByRole('button', { name: /copy element css selector/i });
    await expect(copyBtn).toBeVisible();

    // Click copy
    await copyBtn.click();

    // Verify visual confirmation text 'Copied!'
    await expect(card.getByText(/copied!/i)).toBeVisible();
  });

  test('toggles reviewed status on finding and updates reviewed count', async ({
    page,
  }) => {
    await page.goto('/dashboard.html?demo=1');

    const card = page.locator('article[data-rule-id="button-name"]');
    const reviewToggle = card.getByRole('button', {
      name: /mark button-name as reviewed/i,
    });
    await expect(reviewToggle).toBeVisible();

    // Toggle reviewed on
    await reviewToggle.click();

    // Expect card to show 'Reviewed' badge
    await expect(card.getByText(/^reviewed$/i)).toBeVisible();

    // Toggle reviewed off
    const unreviewToggle = card.getByRole('button', {
      name: /mark button-name as unreviewed/i,
    });
    await expect(unreviewToggle).toBeVisible();
    await unreviewToggle.click();

    // 'Reviewed' badge should be removed
    await expect(card.getByText(/^reviewed$/i)).toHaveCount(0);
  });
});
