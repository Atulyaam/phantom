import { test, expect } from '@playwright/test';

test.describe('Phantom Audit Phase 7 — Haunted Mansion History UI Suite', () => {
  test('AppHeader contains The Archive button with accessible attributes', async ({
    page,
  }) => {
    await page.goto('/dashboard.html?demo=1');

    const archiveBtn = page.getByRole('button', { name: /the archive/i });
    await expect(archiveBtn).toBeVisible();
    await expect(archiveBtn).toHaveAttribute('aria-label', /The Archive/i);
  });

  test('opens and closes The Archive drawer with backdrop and close button', async ({
    page,
  }) => {
    await page.goto('/dashboard.html?demo=1');

    // Click The Archive button
    const archiveBtn = page.getByRole('button', { name: /the archive/i });
    await archiveBtn.click();

    // Drawer should open with dialog semantics
    const drawer = page.getByRole('dialog', { name: /the archive of past hauntings/i });
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute('aria-modal', 'true');

    // Heading and description
    await expect(
      drawer.getByRole('heading', { name: /the archive of past hauntings/i })
    ).toBeVisible();

    // Close via close button
    const closeBtn = drawer.getByRole('button', { name: /close archive drawer/i });
    await closeBtn.click();
    await expect(drawer).not.toBeVisible();
  });

  test('closes The Archive drawer via Escape key and restores focus', async ({
    page,
  }) => {
    await page.goto('/dashboard.html?demo=1');

    const archiveBtn = page.getByRole('button', { name: /the archive/i });
    await archiveBtn.click();

    const drawer = page.getByRole('dialog', { name: /the archive of past hauntings/i });
    await expect(drawer).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();

    // Focus restored to The Archive button
    await expect(archiveBtn).toBeFocused();
  });

  test('displays empty archive state when no scans are saved', async ({ page }) => {
    await page.goto('/dashboard.html?demo=1');

    // Clear history keys in storage
    await page.evaluate(async () => {
      localStorage.removeItem('phantom_scan_history_v1');
      localStorage.removeItem('phantom_scan_summaries_v1');
      if (window.chrome?.storage?.local) {
        await window.chrome.storage.local.remove([
          'phantom_scan_history_v1',
          'phantom_scan_summaries_v1',
        ]);
      }
    });

    const archiveBtn = page.getByRole('button', { name: /the archive/i });
    await archiveBtn.click();

    const drawer = page.getByRole('dialog', { name: /the archive of past hauntings/i });
    await expect(drawer).toBeVisible();

    // Verify empty state messaging
    await expect(
      drawer.getByRole('heading', { name: /the archive is silent/i })
    ).toBeVisible();
    await expect(
      drawer.getByText(/no past hauntings have been recorded yet/i)
    ).toBeVisible();
  });

  test('reopens a historical scan snapshot and inspects historical findings', async ({
    page,
  }) => {
    await page.goto('/dashboard.html?demo=1');

    // Seed storage with a saved scan snapshot using valid UUIDs
    await page.evaluate(async () => {
      const mockScan = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        schemaVersion: 1,
        tabUrl: 'https://haunted-manor.example.com/ballroom',
        pageTitle: 'The Haunted Ballroom',
        hostname: 'haunted-manor.example.com',
        scannedAt: '2026-10-31T23:59:59.000Z',
        axeVersion: '4.10.2',
        extensionVersion: '1.0.0',
        browserName: 'chrome',
        status: 'completed',
        findings: [
          {
            fingerprint: 'fp-button-name-spectral',
            ruleId: 'button-name',
            impact: 'critical',
            description: 'Critical button in ballroom lacks an accessible name',
            help: 'Buttons must have discernible text',
            helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/button-name',
            wcagTags: ['wcag2a', 'wcag412'],
            roomId: 'name-chamber',
            affectedNodeCount: 1,
            nodes: [
              {
                target: ['button.spectral-btn'],
                htmlExcerpt: '<button class="spectral-btn"></button>',
                failureSummary:
                  'Fix any of the following: Element has no title attribute',
              },
            ],
            firstSeenAt: '2026-10-31T23:59:59.000Z',
            reviewed: false,
          },
        ],
        incompleteChecksCount: 0,
        passesCount: 15,
        inapplicableCount: 5,
      };

      const mockSummary = {
        id: mockScan.id,
        schemaVersion: 1,
        tabUrl: mockScan.tabUrl,
        pageTitle: mockScan.pageTitle,
        hostname: mockScan.hostname,
        scannedAt: mockScan.scannedAt,
        status: mockScan.status,
        totalFindings: 1,
        criticalCount: 1,
        seriousCount: 0,
        moderateCount: 0,
        minorCount: 0,
        passesCount: 15,
        incompleteChecksCount: 0,
      };

      localStorage.setItem('phantom_scan_history_v1', JSON.stringify([mockScan]));
      localStorage.setItem('phantom_scan_summaries_v1', JSON.stringify([mockSummary]));
      if (window.chrome?.storage?.local) {
        await window.chrome.storage.local.set({
          phantom_scan_history_v1: [mockScan],
          phantom_scan_summaries_v1: [mockSummary],
        });
      }
    });

    // Open drawer
    const archiveBtn = page.getByRole('button', { name: /the archive/i });
    await archiveBtn.click();

    const drawer = page.getByRole('dialog', { name: /the archive of past hauntings/i });
    await expect(drawer).toBeVisible();

    // Verify snapshot card in drawer
    await expect(drawer.getByText('The Haunted Ballroom')).toBeVisible();
    await expect(
      drawer.getByText('https://haunted-manor.example.com/ballroom')
    ).toBeVisible();
    await expect(drawer.getByText(/1 issue:/i)).toBeVisible();

    // Click "Inspect" button
    const inspectBtn = drawer.getByRole('button', { name: /^Inspect$/i });
    await inspectBtn.click();

    // Drawer closes
    await expect(drawer).not.toBeVisible();

    // HistoricalSnapshotBanner is now visible
    const banner = page.locator(
      'aside[aria-label="Historical Snapshot Inspection Mode"]'
    );
    await expect(banner).toBeVisible();
    await expect(banner.getByText('Historical Snapshot')).toBeVisible();
    await expect(banner.getByText('ID: 550e8400')).toBeVisible();
    await expect(banner.getByText('The Haunted Ballroom')).toBeVisible();
    await expect(
      banner.getByText(/real-time live auditing paused while inspecting historical data/i)
    ).toBeVisible();

    // Findings section now displays the historical finding
    await expect(
      page.getByRole('heading', { level: 4, name: /buttons must have discernible text/i })
    ).toBeVisible();

    // Click "Browse Archive" in banner to reopen drawer
    const browseArchiveBtn = banner.getByRole('button', { name: /browse archive/i });
    await browseArchiveBtn.click();
    await expect(drawer).toBeVisible();

    // The card has "Currently Viewing" badge
    await expect(drawer.getByText(/currently viewing/i)).toBeVisible();

    // Close drawer
    await drawer.getByRole('button', { name: /close archive drawer/i }).click();

    // Click "Return to Live Scan" in banner
    const returnBtn = banner.getByRole('button', { name: /return to live scan/i });
    await returnBtn.click();

    // Banner is removed
    await expect(banner).not.toBeVisible();
  });

  test('confirms and deletes an individual snapshot from storage', async ({ page }) => {
    await page.goto('/dashboard.html?demo=1');

    // Seed storage with a saved scan snapshot using valid UUID
    await page.evaluate(async () => {
      const mockScan = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        schemaVersion: 1,
        tabUrl: 'https://ephemeral.example.com',
        pageTitle: 'Ephemeral Page',
        hostname: 'ephemeral.example.com',
        scannedAt: '2026-10-31T20:00:00.000Z',
        axeVersion: '4.10.2',
        extensionVersion: '1.0.0',
        browserName: 'chrome',
        status: 'completed',
        findings: [],
        incompleteChecksCount: 0,
        passesCount: 5,
        inapplicableCount: 0,
      };

      const mockSummary = {
        id: mockScan.id,
        schemaVersion: 1,
        tabUrl: mockScan.tabUrl,
        pageTitle: mockScan.pageTitle,
        hostname: mockScan.hostname,
        scannedAt: mockScan.scannedAt,
        status: mockScan.status,
        totalFindings: 0,
        criticalCount: 0,
        seriousCount: 0,
        moderateCount: 0,
        minorCount: 0,
        passesCount: 5,
        incompleteChecksCount: 0,
      };

      localStorage.setItem('phantom_scan_history_v1', JSON.stringify([mockScan]));
      localStorage.setItem('phantom_scan_summaries_v1', JSON.stringify([mockSummary]));
      if (window.chrome?.storage?.local) {
        await window.chrome.storage.local.set({
          phantom_scan_history_v1: [mockScan],
          phantom_scan_summaries_v1: [mockSummary],
        });
      }
    });

    const archiveBtn = page.getByRole('button', { name: /the archive/i });
    await archiveBtn.click();

    const drawer = page.getByRole('dialog', { name: /the archive of past hauntings/i });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText('Ephemeral Page')).toBeVisible();

    // Click delete button
    const deleteBtn = drawer.getByTitle(/delete this snapshot/i);
    await deleteBtn.click();

    // Inline confirmation appears
    await expect(drawer.getByText('Delete?')).toBeVisible();

    // Click Yes to confirm deletion
    const yesBtn = drawer.getByRole('button', { name: 'Yes' });
    await yesBtn.click();

    // Snapshot is deleted and empty archive state displays
    await expect(
      drawer.getByRole('heading', { name: /the archive is silent/i })
    ).toBeVisible();
    await expect(drawer.getByText('Ephemeral Page')).not.toBeVisible();
  });

  test('deleting currently viewed snapshot exits historical mode and returns to live state', async ({
    page,
  }) => {
    await page.goto('/dashboard.html?demo=1');

    await page.evaluate(async () => {
      const mockScan = {
        id: '550e8400-e29b-41d4-a716-446655440099',
        schemaVersion: 1,
        tabUrl: 'https://doomed.example.com',
        pageTitle: 'Doomed Chamber',
        hostname: 'doomed.example.com',
        scannedAt: '2026-10-31T21:00:00.000Z',
        axeVersion: '4.10.2',
        extensionVersion: '1.0.0',
        browserName: 'chrome',
        status: 'completed',
        findings: [],
        incompleteChecksCount: 0,
        passesCount: 10,
        inapplicableCount: 0,
      };

      const mockSummary = {
        id: mockScan.id,
        schemaVersion: 1,
        tabUrl: mockScan.tabUrl,
        pageTitle: mockScan.pageTitle,
        hostname: mockScan.hostname,
        scannedAt: mockScan.scannedAt,
        status: mockScan.status,
        totalFindings: 0,
        criticalCount: 0,
        seriousCount: 0,
        moderateCount: 0,
        minorCount: 0,
        passesCount: 10,
        incompleteChecksCount: 0,
      };

      localStorage.setItem('phantom_scan_history_v1', JSON.stringify([mockScan]));
      localStorage.setItem('phantom_scan_summaries_v1', JSON.stringify([mockSummary]));
      if (window.chrome?.storage?.local) {
        await window.chrome.storage.local.set({
          phantom_scan_history_v1: [mockScan],
          phantom_scan_summaries_v1: [mockSummary],
        });
      }
    });

    const archiveBtn = page.getByRole('button', { name: /the archive/i });
    await archiveBtn.click();

    const drawer = page.getByRole('dialog', { name: /the archive of past hauntings/i });
    await expect(drawer).toBeVisible();

    // Inspect the snapshot
    const inspectBtn = drawer.getByRole('button', { name: /^Inspect$/i });
    await inspectBtn.click();
    await expect(drawer).not.toBeVisible();

    // Banner is visible
    const banner = page.locator(
      'aside[aria-label="Historical Snapshot Inspection Mode"]'
    );
    await expect(banner).toBeVisible();
    await expect(banner.getByText('Doomed Chamber')).toBeVisible();

    // Reopen drawer via banner
    await banner.getByRole('button', { name: /browse archive/i }).click();
    await expect(drawer).toBeVisible();

    // Delete the currently viewing snapshot
    await drawer.getByTitle(/delete this snapshot/i).click();
    await drawer.getByRole('button', { name: 'Yes' }).click();

    // Close drawer
    await drawer.getByRole('button', { name: /close archive drawer/i }).click();

    // Banner must be removed immediately, returning to live/demo mode
    await expect(banner).not.toBeVisible();
  });

  test('purging all history via clear-all exits historical mode and restores live view', async ({
    page,
  }) => {
    await page.goto('/dashboard.html?demo=1');

    await page.evaluate(async () => {
      const mockScan = {
        id: '550e8400-e29b-41d4-a716-446655440088',
        schemaVersion: 1,
        tabUrl: 'https://purge.example.com',
        pageTitle: 'Chamber to Purge',
        hostname: 'purge.example.com',
        scannedAt: '2026-10-31T22:00:00.000Z',
        axeVersion: '4.10.2',
        extensionVersion: '1.0.0',
        browserName: 'chrome',
        status: 'completed',
        findings: [],
        incompleteChecksCount: 0,
        passesCount: 8,
        inapplicableCount: 0,
      };

      const mockSummary = {
        id: mockScan.id,
        schemaVersion: 1,
        tabUrl: mockScan.tabUrl,
        pageTitle: mockScan.pageTitle,
        hostname: mockScan.hostname,
        scannedAt: mockScan.scannedAt,
        status: mockScan.status,
        totalFindings: 0,
        criticalCount: 0,
        seriousCount: 0,
        moderateCount: 0,
        minorCount: 0,
        passesCount: 8,
        incompleteChecksCount: 0,
      };

      localStorage.setItem('phantom_scan_history_v1', JSON.stringify([mockScan]));
      localStorage.setItem('phantom_scan_summaries_v1', JSON.stringify([mockSummary]));
      if (window.chrome?.storage?.local) {
        await window.chrome.storage.local.set({
          phantom_scan_history_v1: [mockScan],
          phantom_scan_summaries_v1: [mockSummary],
        });
      }
    });

    const archiveBtn = page.getByRole('button', { name: /the archive/i });
    await archiveBtn.click();

    const drawer = page.getByRole('dialog', { name: /the archive of past hauntings/i });
    await expect(drawer).toBeVisible();

    // Inspect the snapshot
    await drawer.getByRole('button', { name: /^Inspect$/i }).click();
    await expect(drawer).not.toBeVisible();

    const banner = page.locator(
      'aside[aria-label="Historical Snapshot Inspection Mode"]'
    );
    await expect(banner).toBeVisible();

    // Reopen drawer
    await banner.getByRole('button', { name: /browse archive/i }).click();
    await expect(drawer).toBeVisible();

    // Clear all history
    await drawer.getByRole('button', { name: /clear archive/i }).click();
    await expect(drawer.getByText(/purge all past hauntings/i)).toBeVisible();
    await drawer.getByRole('button', { name: /confirm purge/i }).click();

    // Close drawer
    await drawer.getByRole('button', { name: /close archive drawer/i }).click();

    // Banner is removed immediately
    await expect(banner).not.toBeVisible();
  });
});
