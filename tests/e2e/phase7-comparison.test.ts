import { test, expect, type Page } from '@playwright/test';

test.describe('Phantom Audit Phase 7 — Interactive Cross-Scan Comparison Suite', () => {
  // Test UUIDs conforming to RFC 4122
  const SCAN_A_ID = '770e8400-e29b-41d4-a716-446655440001';
  const SCAN_B_ID = '770e8400-e29b-41d4-a716-446655440002';
  const SCAN_INCOMPATIBLE_ID = '770e8400-e29b-41d4-a716-446655440003';

  // Seed storage with compatible baseline & target scans, and an incompatible cross-URL scan
  const seedComparisonData = async (page: Page) => {
    await page.evaluate(
      async ({ scanAId, scanBId, scanIncompId }) => {
        const mockFinding1 = {
          fingerprint: 'fp-button-spectral-1',
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

        const mockFinding2 = {
          fingerprint: 'fp-contrast-crypt-2',
          ruleId: 'color-contrast',
          impact: 'serious',
          description: 'Faint inscription in ballroom foyer',
          help: 'Elements must meet minimum color contrast ratio',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast',
          wcagTags: ['wcag2aa', 'wcag143'],
          roomId: 'contrast-crypt',
          affectedNodeCount: 1,
          nodes: [
            {
              target: ['p.inscription'],
              htmlExcerpt: '<p class="inscription">Secret path</p>',
              failureSummary: 'Contrast ratio 2.0:1 below threshold',
            },
          ],
          firstSeenAt: '2026-10-31T20:00:00.000Z',
          reviewed: false,
        };

        const mockFinding3 = {
          fingerprint: 'fp-portrait-ghost-3',
          ruleId: 'image-alt',
          impact: 'critical',
          description: 'Portrait in ballroom lacks alternative text',
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

        // Scan A: Baseline (Finding 1 & 2)
        const scanA = {
          id: scanAId,
          schemaVersion: 1,
          tabUrl: 'https://haunted-manor.example.com/ballroom',
          pageTitle: 'The Haunted Ballroom — Baseline Audit',
          hostname: 'haunted-manor.example.com',
          scannedAt: '2026-10-31T20:00:00.000Z',
          axeVersion: '4.10.2',
          extensionVersion: '1.0.0',
          browserName: 'chrome',
          status: 'completed',
          findings: [mockFinding1, mockFinding2],
          incompleteChecksCount: 0,
          passesCount: 15,
          inapplicableCount: 5,
        };

        // Scan B: Rescan (Finding 1 resolved with Phase 6 verification, Finding 2 disappeared without verification, Finding 3 new)
        const scanB = {
          id: scanBId,
          schemaVersion: 1,
          tabUrl: 'https://haunted-manor.example.com/ballroom',
          pageTitle: 'The Haunted Ballroom — Rescan Audit',
          hostname: 'haunted-manor.example.com',
          scannedAt: '2026-11-01T20:00:00.000Z',
          axeVersion: '4.10.2',
          extensionVersion: '1.0.0',
          browserName: 'chrome',
          status: 'completed',
          findings: [mockFinding3], // Finding 1 and 2 absent
          incompleteChecksCount: 0,
          passesCount: 17,
          inapplicableCount: 5,
        };

        // Incompatible Scan: Different URL
        const scanIncomp = {
          id: scanIncompId,
          schemaVersion: 1,
          tabUrl: 'https://haunted-manor.example.com/crypt',
          pageTitle: 'The Crypt Annex',
          hostname: 'haunted-manor.example.com',
          scannedAt: '2026-11-02T20:00:00.000Z',
          axeVersion: '4.10.2',
          extensionVersion: '1.0.0',
          browserName: 'chrome',
          status: 'completed',
          findings: [mockFinding2],
          incompleteChecksCount: 0,
          passesCount: 10,
          inapplicableCount: 8,
        };

        // Authoritative Phase 6 Verification Record for Finding 1 (certifying it fixed in scan B)
        const remediationRecords = {
          'fp-button-spectral-1': {
            fingerprint: 'fp-button-spectral-1',
            status: 'verified',
            notes: 'Added accessible title attribute',
            updatedAt: '2026-11-01T20:00:00.000Z',
            verifiedAtScanId: scanBId,
          },
        };

        const summaryA = {
          id: scanA.id,
          schemaVersion: 1,
          tabUrl: scanA.tabUrl,
          pageTitle: scanA.pageTitle,
          hostname: scanA.hostname,
          scannedAt: scanA.scannedAt,
          status: scanA.status,
          totalFindings: 2,
          criticalCount: 1,
          seriousCount: 1,
          moderateCount: 0,
          minorCount: 0,
          passesCount: 15,
          incompleteChecksCount: 0,
        };

        const summaryB = {
          id: scanB.id,
          schemaVersion: 1,
          tabUrl: scanB.tabUrl,
          pageTitle: scanB.pageTitle,
          hostname: scanB.hostname,
          scannedAt: scanB.scannedAt,
          status: scanB.status,
          totalFindings: 1,
          criticalCount: 1,
          seriousCount: 0,
          moderateCount: 0,
          minorCount: 0,
          passesCount: 17,
          incompleteChecksCount: 0,
        };

        const summaryIncomp = {
          id: scanIncomp.id,
          schemaVersion: 1,
          tabUrl: scanIncomp.tabUrl,
          pageTitle: scanIncomp.pageTitle,
          hostname: scanIncomp.hostname,
          scannedAt: scanIncomp.scannedAt,
          status: scanIncomp.status,
          totalFindings: 1,
          criticalCount: 0,
          seriousCount: 1,
          moderateCount: 0,
          minorCount: 0,
          passesCount: 10,
          incompleteChecksCount: 0,
        };

        const allScans = [scanB, scanA, scanIncomp];
        const allSummaries = [summaryB, summaryA, summaryIncomp];

        localStorage.setItem('phantom_scan_history_v1', JSON.stringify(allScans));
        localStorage.setItem('phantom_scan_summaries_v1', JSON.stringify(allSummaries));
        localStorage.setItem(
          'phantom_remediation_v1',
          JSON.stringify(remediationRecords)
        );

        if (window.chrome?.storage?.local) {
          await window.chrome.storage.local.set({
            phantom_scan_history_v1: allScans,
            phantom_scan_summaries_v1: allSummaries,
            phantom_remediation_v1: remediationRecords,
          });
        }
      },
      {
        scanAId: SCAN_A_ID,
        scanBId: SCAN_B_ID,
        scanIncompId: SCAN_INCOMPATIBLE_ID,
      }
    );
  };

  test('User Journey 1: Open archive, navigate to Compare Hauntings tab, select baseline & target scans', async ({
    page,
  }) => {
    await page.goto('/dashboard.html?demo=1');
    await seedComparisonData(page);

    // Open Archive drawer
    const archiveBtn = page.getByRole('button', { name: /the archive/i });
    await archiveBtn.click();

    const drawer = page.getByRole('dialog', {
      name: /the archive of past hauntings/i,
    });
    await expect(drawer).toBeVisible();

    // Click Compare Hauntings tab
    const compareTab = drawer.getByRole('tab', { name: /compare hauntings/i });
    await expect(compareTab).toBeVisible();
    await compareTab.click();
    await expect(compareTab).toHaveAttribute('aria-selected', 'true');

    // Cross-Scan Comparison Engine form is displayed
    await expect(
      drawer.getByRole('heading', { name: /cross-scan comparison engine/i })
    ).toBeVisible();

    const baselineSelect = drawer.getByLabel(/baseline haunting \(before\)/i);
    const targetSelect = drawer.getByLabel(/target haunting \(after \/ rescan\)/i);
    await expect(baselineSelect).toBeVisible();
    await expect(targetSelect).toBeVisible();

    // Select baseline A and target B
    await baselineSelect.selectOption(SCAN_A_ID);
    await targetSelect.selectOption(SCAN_B_ID);

    const runBtn = drawer.getByRole('button', { name: /run comparison/i });
    await expect(runBtn).toBeEnabled();
  });

  test('User Journey 2: Run compatible comparison and view Spectral Comparison Banner', async ({
    page,
  }) => {
    await page.goto('/dashboard.html?demo=1');
    await seedComparisonData(page);

    // Open drawer and start comparison
    const archiveBtn = page.getByRole('button', { name: /the archive/i });
    await archiveBtn.click();

    const drawer = page.getByRole('dialog', {
      name: /the archive of past hauntings/i,
    });
    await drawer.getByRole('tab', { name: /compare hauntings/i }).click();

    await drawer.getByLabel(/baseline haunting \(before\)/i).selectOption(SCAN_A_ID);
    await drawer
      .getByLabel(/target haunting \(after \/ rescan\)/i)
      .selectOption(SCAN_B_ID);

    await drawer.getByRole('button', { name: /run comparison/i }).click();

    // Drawer closes and Spectral Cross-Scan Comparison banner appears
    await expect(drawer).not.toBeVisible();

    const banner = page.getByRole('complementary', {
      name: /cross-scan comparison & diff intelligence/i,
    });
    await expect(banner).toBeVisible();
    await expect(banner.getByText(/spectral cross-scan comparison/i)).toBeVisible();

    // Verified score badge (1 verified fix - 1 regression = 0% net verified score)
    await expect(banner.getByText(/0% verified score/i)).toBeVisible();

    // Audit status in simulation bar shows comparison mode
    await expect(page.getByText(/spectral comparison \(3 findings\)/i)).toBeVisible();
  });

  test('User Journey 3: Separate inspection of Verified Fixes vs Disappeared (Unverified) findings', async ({
    page,
  }) => {
    await page.goto('/dashboard.html?demo=1');
    await seedComparisonData(page);

    // Start comparison directly
    await page.getByRole('button', { name: /the archive/i }).click();
    const drawer = page.getByRole('dialog', {
      name: /the archive of past hauntings/i,
    });
    await drawer.getByRole('tab', { name: /compare hauntings/i }).click();
    await drawer.getByLabel(/baseline haunting \(before\)/i).selectOption(SCAN_A_ID);
    await drawer
      .getByLabel(/target haunting \(after \/ rescan\)/i)
      .selectOption(SCAN_B_ID);
    await drawer.getByRole('button', { name: /run comparison/i }).click();

    const banner = page.getByRole('complementary', {
      name: /cross-scan comparison & diff intelligence/i,
    });
    await expect(banner).toBeVisible();

    // Disappeared callout must be visible explaining unverified absence
    await expect(banner.getByText(/1 disappeared finding \(unverified\)/i)).toBeVisible();
    await expect(
      banner.getByText(/disappearance alone is never classified/i)
    ).toBeVisible();

    // Verify badges on cards in finding list
    await expect(page.getByText('Verified Fix', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Disappeared (Unverified)', { exact: true })
    ).toBeVisible();
    await expect(page.getByText('New Issue', { exact: true })).toBeVisible();
  });

  test('User Journey 4: Category filter chips filter visible findings', async ({
    page,
  }) => {
    await page.goto('/dashboard.html?demo=1');
    await seedComparisonData(page);

    // Start comparison
    await page.getByRole('button', { name: /the archive/i }).click();
    const drawer = page.getByRole('dialog', {
      name: /the archive of past hauntings/i,
    });
    await drawer.getByRole('tab', { name: /compare hauntings/i }).click();
    await drawer.getByLabel(/baseline haunting \(before\)/i).selectOption(SCAN_A_ID);
    await drawer
      .getByLabel(/target haunting \(after \/ rescan\)/i)
      .selectOption(SCAN_B_ID);
    await drawer.getByRole('button', { name: /run comparison/i }).click();

    const banner = page.getByRole('complementary', {
      name: /cross-scan comparison & diff intelligence/i,
    });

    // 1. Click Verified Fixes filter chip
    await banner.getByRole('button', { name: /filter by verified fixes/i }).click();

    // Only button-name should be visible in findings
    await expect(page.getByText(/buttons must have discernible text/i)).toBeVisible();
    await expect(
      page.getByText(/elements must meet minimum color contrast/i)
    ).not.toBeVisible();
    await expect(page.getByText(/images must have alternate text/i)).not.toBeVisible();

    // 2. Click Disappeared filter chip
    await banner.getByRole('button', { name: /filter by disappeared/i }).click();

    await expect(
      page.getByText(/elements must meet minimum color contrast/i)
    ).toBeVisible();
    await expect(page.getByText(/buttons must have discernible text/i)).not.toBeVisible();

    // 3. Click New Issues filter chip
    await banner.getByRole('button', { name: /filter by new issues/i }).click();
    await expect(page.getByText(/images must have alternate text/i)).toBeVisible();
    await expect(page.getByText(/buttons must have discernible text/i)).not.toBeVisible();

    // 4. Click All Findings chip to restore
    await banner.getByRole('button', { name: /filter by all findings/i }).click();
    await expect(page.getByText(/buttons must have discernible text/i)).toBeVisible();
    await expect(
      page.getByText(/elements must meet minimum color contrast/i)
    ).toBeVisible();
    await expect(page.getByText(/images must have alternate text/i)).toBeVisible();
  });

  test('User Journey 5: Incompatible scans show prominent rejection notice with zero progress claimed', async ({
    page,
  }) => {
    await page.goto('/dashboard.html?demo=1');
    await seedComparisonData(page);

    await page.getByRole('button', { name: /the archive/i }).click();
    const drawer = page.getByRole('dialog', {
      name: /the archive of past hauntings/i,
    });
    await drawer.getByRole('tab', { name: /compare hauntings/i }).click();

    // Select Baseline A and Incompatible Crypt Scan
    await drawer.getByLabel(/baseline haunting \(before\)/i).selectOption(SCAN_A_ID);
    await drawer
      .getByLabel(/target haunting \(after \/ rescan\)/i)
      .selectOption(SCAN_INCOMPATIBLE_ID);

    await drawer.getByRole('button', { name: /run comparison/i }).click();

    const banner = page.getByRole('complementary', {
      name: /cross-scan comparison & diff intelligence/i,
    });
    await expect(banner).toBeVisible();

    // Incomparable warning alert
    await expect(
      banner.getByText(/incomparable hauntings — remediation verification inapplicable/i)
    ).toBeVisible();
    await expect(banner.getByText(/scan targets differ/i)).toBeVisible();
    await expect(banner.getByText(/zero verified progress is claimed/i)).toBeVisible();
  });

  test('User Journey 6: Quick compare button on individual archive card pre-selects baseline', async ({
    page,
  }) => {
    await page.goto('/dashboard.html?demo=1');
    await seedComparisonData(page);

    await page.getByRole('button', { name: /the archive/i }).click();
    const drawer = page.getByRole('dialog', {
      name: /the archive of past hauntings/i,
    });

    // In archive list, click the compare button on Baseline A card
    await drawer
      .getByRole('button', {
        name: /compare scan snapshot the haunted ballroom — baseline audit/i,
      })
      .click();

    // Should have transitioned to Compare Hauntings tab
    const compareTab = drawer.getByRole('tab', { name: /compare hauntings/i });
    await expect(compareTab).toHaveAttribute('aria-selected', 'true');

    // Baseline selector should be pre-populated with SCAN_A_ID
    const baselineSelect = drawer.getByLabel(/baseline haunting \(before\)/i);
    await expect(baselineSelect).toHaveValue(SCAN_A_ID);
  });

  test('User Journey 7: Deleting selected snapshot while comparison is active safely exits comparison', async ({
    page,
  }) => {
    await page.goto('/dashboard.html?demo=1');
    await seedComparisonData(page);

    // Run comparison
    await page.getByRole('button', { name: /the archive/i }).click();
    let drawer = page.getByRole('dialog', {
      name: /the archive of past hauntings/i,
    });
    await drawer.getByRole('tab', { name: /compare hauntings/i }).click();
    await drawer.getByLabel(/baseline haunting \(before\)/i).selectOption(SCAN_A_ID);
    await drawer
      .getByLabel(/target haunting \(after \/ rescan\)/i)
      .selectOption(SCAN_B_ID);
    await drawer.getByRole('button', { name: /run comparison/i }).click();

    // Verify comparison is active
    await expect(page.getByText(/spectral cross-scan comparison/i)).toBeVisible();

    // Reopen archive and delete one of the compared snapshots (Scan B)
    await page.getByRole('button', { name: /the archive/i }).click();
    drawer = page.getByRole('dialog', {
      name: /the archive of past hauntings/i,
    });
    await drawer.getByRole('tab', { name: /preserved snapshots/i }).click();

    await drawer
      .getByRole('button', {
        name: /delete scan snapshot the haunted ballroom — rescan audit/i,
      })
      .click();

    const confirmYes = drawer.getByRole('button', { name: /yes/i });
    await confirmYes.click();

    // Close drawer
    await drawer.getByRole('button', { name: /close archive drawer/i }).click();

    // Comparison banner should be gone since a member snapshot was deleted
    await expect(page.getByText(/spectral cross-scan comparison/i)).not.toBeVisible();
  });

  test('User Journey 8: Exit comparison restores state and finding inspector is read-only in comparison mode', async ({
    page,
  }) => {
    await page.goto('/dashboard.html?demo=1');
    await seedComparisonData(page);

    // Start comparison
    await page.getByRole('button', { name: /the archive/i }).click();
    const drawer = page.getByRole('dialog', {
      name: /the archive of past hauntings/i,
    });
    await drawer.getByRole('tab', { name: /compare hauntings/i }).click();
    await drawer.getByLabel(/baseline haunting \(before\)/i).selectOption(SCAN_A_ID);
    await drawer
      .getByLabel(/target haunting \(after \/ rescan\)/i)
      .selectOption(SCAN_B_ID);
    await drawer.getByRole('button', { name: /run comparison/i }).click();

    // Inspect the first finding (Verified Fix)
    const inspectBtn = page.getByRole('button', { name: /inspect/i }).first();
    await inspectBtn.click();

    // Inspector should open with Comparison Diff badge
    const inspectorHeading = page.locator('#inspector-heading');
    await expect(inspectorHeading).toBeVisible();
    await expect(page.getByText(/comparison diff/i)).toBeVisible();

    // Remediation action buttons must NOT be visible (strictly read-only)
    await expect(page.getByText(/mark as attempted/i)).not.toBeVisible();

    // Close inspector
    await page.getByRole('button', { name: /close finding inspector/i }).click();
    await expect(inspectorHeading).not.toBeVisible();

    // Click Exit Comparison
    const exitBtn = page.getByRole('button', {
      name: /exit cross-scan comparison/i,
    });
    await exitBtn.click();

    // Spectral Comparison Banner is dismissed
    await expect(page.getByText(/spectral cross-scan comparison/i)).not.toBeVisible();
  });

  test('User Journey 9: Category filter with zero matches displays semantic empty state without unmounting explorer (DEF-711 & DEF-713)', async ({
    page,
  }) => {
    await page.goto('/dashboard.html?demo=1');
    await seedComparisonData(page);

    // Start comparison
    await page.getByRole('button', { name: /the archive/i }).click();
    const drawer = page.getByRole('dialog', {
      name: /the archive of past hauntings/i,
    });
    await drawer.getByRole('tab', { name: /compare hauntings/i }).click();
    await drawer.getByLabel(/baseline haunting \(before\)/i).selectOption(SCAN_A_ID);
    await drawer
      .getByLabel(/target haunting \(after \/ rescan\)/i)
      .selectOption(SCAN_B_ID);
    await drawer.getByRole('button', { name: /run comparison/i }).click();

    const banner = page.getByRole('complementary', {
      name: /cross-scan comparison & diff intelligence/i,
    });
    await expect(banner).toBeVisible();

    // In All Findings mode, verify finding cards do NOT expose review toggle buttons (DEF-711 read-only invariant)
    const reviewToggleButtons = page.getByRole('button', {
      name: /mark .* as reviewed/i,
    });
    await expect(reviewToggleButtons).toHaveCount(0);

    // Click Unchanged filter chip (which has 0 findings in this dataset)
    await banner.getByRole('button', { name: /filter by unchanged/i }).click();

    // Explorer should NOT vanish; instead it displays the zero-results empty state (DEF-713)
    await expect(page.getByText(/no matching accessibility findings/i)).toBeVisible();
    await expect(page.getByText(/no issues match the active search term/i)).toBeVisible();

    // Return to All Findings
    await banner.getByRole('button', { name: /filter by all findings/i }).click();
    await expect(page.getByText(/no matching accessibility findings/i)).not.toBeVisible();
    await expect(page.getByText(/buttons must have discernible text/i)).toBeVisible();
  });
});
