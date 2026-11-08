import { test, expect } from '@playwright/test';

test.describe('Phantom Audit Extension Dashboard Smoke Suite', () => {
  test('renders the application shell without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(
      '/dashboard.html?tabId=42&url=https%3A%2F%2Fexample.com&title=Example%20Domain'
    );

    // Title verification
    await expect(page).toHaveTitle(/phantom audit/i);

    // Primary landmarks & headings
    const heading = page.getByRole('heading', { level: 1, name: /phantom audit/i });
    await expect(heading).toBeVisible();

    const targetUrl = page.getByText('https://example.com');
    await expect(targetUrl).toBeVisible();

    // Verify footer disclaimer
    const disclaimer = page.getByText(
      /zero automated findings does not certify wcag 2.2 conformance/i
    );
    await expect(disclaimer).toBeVisible();

    // Ensure zero console error regressions
    expect(consoleErrors).toEqual([]);
  });

  test('supports keyboard navigation and skip link focus', async ({ page }) => {
    await page.goto('/dashboard.html');

    // Press Tab once to bring up skip link
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: /skip to main content/i });
    await expect(skipLink).toBeFocused();

    // Activate skip link
    await page.keyboard.press('Enter');
    const mainArea = page.locator('#main-content');
    await expect(mainArea).toBeVisible();
  });

  test('toggles between mansion room map and accessible table', async ({ page }) => {
    await page.goto('/dashboard.html');

    const mansionTab = page.getByRole('button', { name: /mansion map/i });
    const listTab = page.getByRole('button', { name: /list view/i });

    // Initially in Mansion map view
    await expect(
      page.getByRole('region', { name: /haunted mansion 2d map/i })
    ).toBeVisible();

    // Toggle to List View
    await listTab.click();
    await expect(
      page.getByRole('region', { name: /mansion room taxonomy list/i })
    ).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    // Toggle back to Mansion Map
    await mansionTab.click();
    await expect(
      page.getByRole('region', { name: /haunted mansion 2d map/i })
    ).toBeVisible();
  });

  test('displays warning on unsupported internal browser target', async ({ page }) => {
    await page.goto('/dashboard.html?tabId=1&unsupported=1&url=chrome%3A%2F%2Fsettings');

    const alert = page.getByRole('heading', { name: /ineligible inspection target/i });
    await expect(alert).toBeVisible();
  });

  test('verifies initial render performance metrics', async ({ page }) => {
    await page.goto('/dashboard.html');

    const metrics = await page.evaluate(() => {
      const entry = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming;
      return {
        domInteractive: entry?.domInteractive ?? 0,
        domContentLoaded: entry?.domContentLoadedEventEnd ?? 0,
        loadComplete: entry?.loadEventEnd ?? 0,
      };
    });

    // Verification: DOM content loaded must occur well under the 2.5s budget (NFR-001)
    expect(metrics.domContentLoaded).toBeGreaterThan(0);
    expect(metrics.domContentLoaded).toBeLessThan(2500);
  });
});
