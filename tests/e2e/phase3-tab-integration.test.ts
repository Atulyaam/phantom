import { test, expect } from '@playwright/test';

test.describe('Phantom Audit Phase 3 — Tab Integration & Messaging Suite', () => {
  test('renders target tab integration section and live connection badge', async ({
    page,
  }) => {
    await page.goto(
      '/dashboard.html?tabId=42&url=https%3A%2F%2Fexample.com&title=Example%20Domain'
    );

    // Verify Tab Integration Section
    await expect(
      page.getByRole('heading', { name: /target tab integration/i })
    ).toBeVisible();

    // Verify Tab Status Badge
    await expect(page.getByText('Target Tab Live')).toBeVisible();

    // Verify Audit Invocation Button
    const startAuditBtn = page.getByRole('button', {
      name: /start accessibility audit/i,
    });
    await expect(startAuditBtn).toBeVisible();
    await expect(startAuditBtn).toBeEnabled();
  });

  test('opens and closes activeTab permission explainer dialog', async ({ page }) => {
    await page.goto('/dashboard.html?tabId=42');

    // Click activeTab Privacy link button
    const privacyBtn = page.getByRole('button', { name: /activetab privacy/i });
    await expect(privacyBtn).toBeVisible();
    await privacyBtn.click();

    // Verify Dialog opened
    const dialog = page.getByRole('dialog', {
      name: /privacy-first page access/i,
    });
    await expect(dialog).toBeVisible();
    await expect(page.getByText(/user-gesture required/i)).toBeVisible();
    await expect(page.getByText(/ephemeral lifecycle/i)).toBeVisible();
    await expect(page.getByText(/zero remote code/i)).toBeVisible();

    // Click Understood button to close
    const understoodBtn = page.getByRole('button', { name: /understood/i });
    await understoodBtn.click();
    await expect(dialog).not.toBeVisible();
  });

  test('disables audit button and displays ineligible badge on restricted browser pages', async ({
    page,
  }) => {
    await page.goto('/dashboard.html?tabId=1&unsupported=1&url=chrome%3A%2F%2Fsettings');

    // Target status must indicate ineligible
    await expect(page.getByText('Ineligible Target')).toBeVisible();

    // Start Audit button must be disabled
    const startAuditBtn = page.getByRole('button', {
      name: /start accessibility audit/i,
    });
    await expect(startAuditBtn).toBeDisabled();

    // Unsupported alert banner must be visible
    await expect(
      page.getByRole('heading', { name: /ineligible inspection target/i })
    ).toBeVisible();
  });

  test('handles standalone launch when no tabId is supplied', async ({ page }) => {
    await page.goto('/dashboard.html');

    // Connection badge shows Standalone Launch
    await expect(page.getByText('Standalone Launch', { exact: true })).toBeVisible();

    // Audit button is disabled since no target page exists
    const startAuditBtn = page.getByRole('button', {
      name: /start accessibility audit/i,
    });
    await expect(startAuditBtn).toBeDisabled();
  });
});
