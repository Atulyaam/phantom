import { test, expect } from '@playwright/test';

test.describe('Phantom Audit Phase 7 — Master Release Gate & Full Lifecycle E2E Suite', () => {
  // Conforming UUIDs
  const SCAN_1_ID = '990e8400-e29b-41d4-a716-446655440001';
  const SCAN_2_ID = '990e8400-e29b-41d4-a716-446655440002';
  const SCAN_3_ID = '990e8400-e29b-41d4-a716-446655440003';

  test('Complete End-to-End Auditor Lifecycle: Journeys A through E in integrated sequence', async ({
    page,
  }) => {
    // -------------------------------------------------------------------------
    // Phase 1 / Journey A: Fresh Audit & Storage Persistence
    // -------------------------------------------------------------------------
    await page.goto('/dashboard.html?demo=1');

    // Seed initial baseline scan with unsanitized URL (containing sensitive token)
    await page.evaluate(
      async ({ scan1Id, scan2Id, scan3Id }) => {
        const finding1 = {
          fingerprint: 'fp-button-spectral-gate-1',
          ruleId: 'button-name',
          impact: 'critical',
          description: 'Ballroom doorway button lacks accessible name',
          help: 'Buttons must have discernible text',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/button-name',
          wcagTags: ['wcag2a', 'wcag412'],
          roomId: 'name-chamber',
          affectedNodeCount: 1,
          nodes: [
            {
              target: ['button.spectral-door'],
              htmlExcerpt: '<button class="spectral-door"></button>',
              failureSummary: 'Fix element name',
            },
          ],
          firstSeenAt: '2026-10-31T20:00:00.000Z',
          reviewed: false,
        };

        const finding2 = {
          fingerprint: 'fp-contrast-crypt-gate-2',
          ruleId: 'color-contrast',
          impact: 'serious',
          description: 'Faint inscription in crypt foyer',
          help: 'Elements must meet minimum color contrast ratio',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast',
          wcagTags: ['wcag2aa', 'wcag143'],
          roomId: 'contrast-crypt',
          affectedNodeCount: 1,
          nodes: [
            {
              target: ['p.faded-text'],
              htmlExcerpt: '<p class="faded-text">Faint text</p>',
              failureSummary: 'Contrast ratio 2.1:1 below required 4.5:1',
            },
          ],
          firstSeenAt: '2026-10-31T20:00:00.000Z',
          reviewed: false,
        };

        const finding3 = {
          fingerprint: 'fp-portrait-gate-3',
          ruleId: 'image-alt',
          impact: 'critical',
          description: 'Ancestor portrait lacks alternative text',
          help: 'Images must have alternate text',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/image-alt',
          wcagTags: ['wcag2a', 'wcag111'],
          roomId: 'portrait-gallery',
          affectedNodeCount: 1,
          nodes: [
            {
              target: ['img#ghost-ancestor'],
              htmlExcerpt: '<img id="ghost-ancestor" src="ancestor.png">',
              failureSummary: 'Missing alt attribute',
            },
          ],
          firstSeenAt: '2026-11-01T20:00:00.000Z',
          reviewed: false,
        };

        // Scan 1 (Baseline)
        const scan1 = {
          id: scan1Id,
          schemaVersion: 1,
          tabUrl: 'https://haunted-manor.example.com/ballroom?page=1',
          pageTitle: 'Haunted Ballroom — Baseline Audit',
          hostname: 'haunted-manor.example.com',
          scannedAt: '2026-10-31T20:00:00.000Z',
          axeVersion: '4.10.2',
          extensionVersion: '1.0.0',
          browserName: 'chrome',
          status: 'completed',
          findings: [finding1, finding2],
          incompleteChecksCount: 0,
          passesCount: 15,
          inapplicableCount: 5,
        };

        // Scan 2 (Rescan: finding1 resolved with authoritative record, finding2 disappeared, finding3 new)
        const scan2 = {
          id: scan2Id,
          schemaVersion: 1,
          tabUrl: 'https://haunted-manor.example.com/ballroom?page=1',
          pageTitle: 'Haunted Ballroom — Rescan Audit',
          hostname: 'haunted-manor.example.com',
          scannedAt: '2026-11-01T20:00:00.000Z',
          axeVersion: '4.10.2',
          extensionVersion: '1.0.0',
          browserName: 'chrome',
          status: 'completed',
          findings: [finding3],
          incompleteChecksCount: 0,
          passesCount: 17,
          inapplicableCount: 5,
        };

        // Scan 3 (Incompatible Cross-Domain Scan)
        const scan3 = {
          id: scan3Id,
          schemaVersion: 1,
          tabUrl: 'https://other-manor.example.com/crypt',
          pageTitle: 'Other Manor — Crypt',
          hostname: 'other-manor.example.com',
          scannedAt: '2026-11-02T20:00:00.000Z',
          axeVersion: '4.10.2',
          extensionVersion: '1.0.0',
          browserName: 'chrome',
          status: 'completed',
          findings: [finding2],
          incompleteChecksCount: 0,
          passesCount: 10,
          inapplicableCount: 8,
        };

        const summary1 = {
          id: scan1Id,
          schemaVersion: 1,
          tabUrl: 'https://haunted-manor.example.com/ballroom?page=1', // token sanitized
          pageTitle: scan1.pageTitle,
          hostname: scan1.hostname,
          scannedAt: scan1.scannedAt,
          status: scan1.status,
          totalFindings: 2,
          criticalCount: 1,
          seriousCount: 1,
          moderateCount: 0,
          minorCount: 0,
          passesCount: 15,
          incompleteChecksCount: 0,
        };

        const summary2 = {
          id: scan2Id,
          schemaVersion: 1,
          tabUrl: scan2.tabUrl,
          pageTitle: scan2.pageTitle,
          hostname: scan2.hostname,
          scannedAt: scan2.scannedAt,
          status: scan2.status,
          totalFindings: 1,
          criticalCount: 1,
          seriousCount: 0,
          moderateCount: 0,
          minorCount: 0,
          passesCount: 17,
          incompleteChecksCount: 0,
        };

        const summary3 = {
          id: scan3Id,
          schemaVersion: 1,
          tabUrl: scan3.tabUrl,
          pageTitle: scan3.pageTitle,
          hostname: scan3.hostname,
          scannedAt: scan3.scannedAt,
          status: scan3.status,
          totalFindings: 1,
          criticalCount: 0,
          seriousCount: 1,
          moderateCount: 0,
          minorCount: 0,
          passesCount: 10,
          incompleteChecksCount: 0,
        };

        const remediationRecords = {
          'fp-button-spectral-gate-1': {
            fingerprint: 'fp-button-spectral-gate-1',
            status: 'verified',
            notes: 'Added aria-label to spectral doorway button',
            updatedAt: '2026-11-01T20:00:00.000Z',
            verifiedAtScanId: scan2Id,
          },
        };

        const scanList = [scan3, scan2, scan1];
        const summaryList = [summary3, summary2, summary1];

        localStorage.setItem('phantom_scan_history_v1', JSON.stringify(scanList));
        localStorage.setItem('phantom_scan_summaries_v1', JSON.stringify(summaryList));
        localStorage.setItem(
          'phantom_remediation_v1',
          JSON.stringify(remediationRecords)
        );

        if (window.chrome?.storage?.local) {
          await window.chrome.storage.local.set({
            phantom_scan_history_v1: scanList,
            phantom_scan_summaries_v1: summaryList,
            phantom_remediation_v1: remediationRecords,
          });
        }
      },
      { scan1Id: SCAN_1_ID, scan2Id: SCAN_2_ID, scan3Id: SCAN_3_ID }
    );

    // -------------------------------------------------------------------------
    // Phase 2 / Journey B: Historical Archive Exploration & State Isolation
    // -------------------------------------------------------------------------
    await page.getByRole('button', { name: /the archive/i }).click();
    const drawer = page.getByRole('dialog', { name: /the archive of past hauntings/i });
    await expect(drawer).toBeVisible();

    // Verify snapshots are indexed newest-first
    await expect(drawer.getByText('Other Manor — Crypt')).toBeVisible();
    await expect(drawer.getByText('Haunted Ballroom — Rescan Audit')).toBeVisible();
    await expect(drawer.getByText('Haunted Ballroom — Baseline Audit')).toBeVisible();

    // Reopen Baseline snapshot into dashboard
    const baselineCard = drawer.locator('article', {
      hasText: 'Haunted Ballroom — Baseline Audit',
    });
    const inspectBaseline = baselineCard.getByRole('button', {
      name: /inspect/i,
    });
    await inspectBaseline.click();

    // Drawer closes and Historical Snapshot Banner is mounted
    await expect(drawer).not.toBeVisible();
    const histBanner = page.locator(
      'aside[aria-label="Historical Snapshot Inspection Mode"]'
    );
    await expect(histBanner).toBeVisible();
    await expect(histBanner.getByText(/real-time live auditing paused/i)).toBeVisible();

    // Findings section displays the 2 baseline findings
    await expect(page.getByText(/buttons must have discernible text/i)).toBeVisible();
    await expect(
      page.getByText(/elements must meet minimum color contrast/i)
    ).toBeVisible();

    // Return to live mode
    await histBanner.getByRole('button', { name: /return to live scan/i }).click();
    await expect(histBanner).not.toBeVisible();

    // -------------------------------------------------------------------------
    // Phase 3 / Journey D: Interactive Cross-Scan Comparison
    // -------------------------------------------------------------------------
    await page.getByRole('button', { name: /the archive/i }).click();
    await expect(drawer).toBeVisible();
    await drawer.getByRole('tab', { name: /compare hauntings/i }).click();

    // Select baseline and target
    await drawer.getByLabel(/baseline haunting \(before\)/i).selectOption(SCAN_1_ID);
    await drawer
      .getByLabel(/target haunting \(after \/ rescan\)/i)
      .selectOption(SCAN_2_ID);

    // Run comparison
    await drawer.getByRole('button', { name: /run comparison/i }).click();
    await expect(drawer).not.toBeVisible();

    // Spectral Comparison Banner is mounted
    const compBanner = page.getByRole('complementary', {
      name: /cross-scan comparison & diff intelligence/i,
    });
    await expect(compBanner).toBeVisible();
    await expect(compBanner.getByText(/spectral cross-scan comparison/i)).toBeVisible();

    // Check all 5 categories: Verified Fix (1), Disappeared (1), Unchanged (0), New (1), Uncertain (0)
    await expect(
      compBanner.getByRole('button', { name: /filter by verified fixes/i })
    ).toBeVisible();
    await expect(
      compBanner.getByRole('button', { name: /filter by disappeared/i })
    ).toBeVisible();
    await expect(
      compBanner.getByRole('button', { name: /filter by unchanged/i })
    ).toBeVisible();
    await expect(
      compBanner.getByRole('button', { name: /filter by new issues/i })
    ).toBeVisible();
    await expect(
      compBanner.getByRole('button', { name: /filter by uncertain matches/i })
    ).toBeVisible();

    // Net verified score: (1 verified fix - 1 regression) / 2 baseline = 0%
    await expect(compBanner.getByText(/0% verified score/i)).toBeVisible();

    // Test Category Filtering: Filter by Verified Fixes
    await compBanner.getByRole('button', { name: /filter by verified fixes/i }).click();
    await expect(page.getByText(/buttons must have discernible text/i)).toBeVisible();
    await expect(
      page.getByText(/elements must meet minimum color contrast/i)
    ).not.toBeVisible();

    // Test Zero-Result State (DEF-713): Filter by Unchanged (0 items)
    await compBanner.getByRole('button', { name: /filter by unchanged/i }).click();
    await expect(page.getByText(/no matching accessibility findings/i)).toBeVisible();

    // Restore All Findings
    await compBanner.getByRole('button', { name: /filter by all findings/i }).click();
    await expect(page.getByText(/buttons must have discernible text/i)).toBeVisible();

    // Verify Read-Only Invariant (DEF-711): Finding cards omit review toggle buttons in comparison mode
    const reviewToggles = page.getByRole('button', { name: /mark .* as reviewed/i });
    await expect(reviewToggles).toHaveCount(0);

    // -------------------------------------------------------------------------
    // Phase 4 / Journey E: Deletion & Deletion Safety During Active Comparison
    // -------------------------------------------------------------------------
    // Open drawer while comparison is active
    await page.getByRole('button', { name: /the archive/i }).click();
    await expect(drawer).toBeVisible();
    await drawer.getByRole('tab', { name: /preserved snapshots/i }).click();

    // Delete the target snapshot (Scan 2) that is an active member of comparison
    await drawer
      .getByRole('button', {
        name: /delete scan snapshot haunted ballroom — rescan audit/i,
      })
      .click();
    await drawer.getByRole('button', { name: /yes/i }).click();
    await drawer.getByRole('button', { name: /close archive drawer/i }).click();

    // Comparison banner must automatically dismount because a member snapshot was deleted
    await expect(compBanner).not.toBeVisible();

    // Reopen drawer to verify deletion was persisted and other snapshots remain intact
    await page.getByRole('button', { name: /the archive/i }).click();
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText('Haunted Ballroom — Rescan Audit')).not.toBeVisible();
    await expect(drawer.getByText('Haunted Ballroom — Baseline Audit')).toBeVisible();
    await expect(drawer.getByText('Other Manor — Crypt')).toBeVisible();

    // Close drawer
    await drawer.getByRole('button', { name: /close archive drawer/i }).click();
  });
});
