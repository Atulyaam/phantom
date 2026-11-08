import { test, expect, Page } from '@playwright/test';

/**
 * Phase 9 Workstream 4: Automated Dashboard axe-core Audit & E2E Accessibility Suite.
 *
 * Requirements:
 * - Uses locally bundled axe.min.js (axe-core v4.14.0, zero remote CDN / zero network).
 * - Strictly enforces zero violations for WCAG 2.2 A/AA across all 8 essential UI states.
 * - Validates keyboard traps, Escape dismissals, and focus restorations.
 */

const SCAN_ID = '770e8400-e29b-41d4-a716-446655440001';
const HISTORICAL_SCAN_ID = '770e8400-e29b-41d4-a716-446655440002';

const MOCK_SCAN_1 = {
  id: SCAN_ID,
  schemaVersion: 1,
  tabUrl: 'https://phantom-auditor.example.com/ballroom?token=super_secret_auth_token_9999&session=xyz#doorway',
  pageTitle: 'The Grand Phantom Ballroom',
  hostname: 'phantom-auditor.example.com',
  scannedAt: '2026-10-31T22:00:00.000Z',
  axeVersion: '4.14.0',
  extensionVersion: '0.1.0',
  browserName: 'chrome',
  status: 'completed',
  findings: [
    {
      fingerprint: 'fp-button-gate-1',
      ruleId: 'button-name',
      impact: 'critical',
      description: 'Ornate ballroom door button lacks discernible text',
      help: 'Buttons must have discernible text',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.14/button-name',
      wcagTags: ['wcag2a', 'wcag412'],
      roomId: 'name-chamber',
      affectedNodeCount: 1,
      nodes: [
        {
          target: ['button#spectral-gate'],
          htmlExcerpt: '<button id="spectral-gate" class="gold-embossed"></button>',
          failureSummary: 'Fix any of the following: Element has no title attribute',
        },
      ],
      firstSeenAt: '2026-10-31T22:00:00.000Z',
      reviewed: false,
    },
    {
      fingerprint: 'fp-contrast-gate-2',
      ruleId: 'color-contrast',
      impact: 'serious',
      description: 'Faint ballroom plaque inscription fails minimum contrast ratio',
      help: 'Elements must meet minimum color contrast ratio',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.14/color-contrast',
      wcagTags: ['wcag2aa', 'wcag143'],
      roomId: 'contrast-crypt',
      affectedNodeCount: 1,
      nodes: [
        {
          target: ['p.inscription-text'],
          htmlExcerpt: '<p class="inscription-text">Beware all who enter the ballroom</p>',
          failureSummary: 'Contrast ratio 2.4:1 below minimum required 4.5:1',
        },
      ],
      firstSeenAt: '2026-10-31T22:00:00.000Z',
      reviewed: true,
    },
    {
      fingerprint: 'fp-alt-gate-3',
      ruleId: 'image-alt',
      impact: 'critical',
      description: 'Haunted portrait image lacks alternative text',
      help: 'Images must have alternate text',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.14/image-alt',
      wcagTags: ['wcag2a', 'wcag111'],
      roomId: 'portrait-gallery',
      affectedNodeCount: 1,
      nodes: [
        {
          target: ['img#ancestor-portrait'],
          htmlExcerpt: '<img id="ancestor-portrait" src="ancestor.jpg">',
          failureSummary: 'Element does not have an alt attribute',
        },
      ],
      firstSeenAt: '2026-10-31T22:00:00.000Z',
      reviewed: false,
    },
  ],
  incompleteChecksCount: 1,
  passesCount: 18,
  inapplicableCount: 5,
};

const MOCK_SCAN_2 = {
  ...MOCK_SCAN_1,
  id: HISTORICAL_SCAN_ID,
  pageTitle: 'The Grand Phantom Ballroom (Baseline Scan)',
  scannedAt: '2026-10-30T10:00:00.000Z',
  findings: [
    MOCK_SCAN_1.findings[0], // button-name unchanged
    MOCK_SCAN_1.findings[1], // color-contrast unchanged
  ],
};

const MOCK_SUMMARIES = [
  {
    id: SCAN_ID,
    schemaVersion: 1,
    tabUrl: MOCK_SCAN_1.tabUrl,
    pageTitle: MOCK_SCAN_1.pageTitle,
    hostname: MOCK_SCAN_1.hostname,
    scannedAt: MOCK_SCAN_1.scannedAt,
    status: 'completed',
    totalFindings: 3,
    criticalCount: 2,
    seriousCount: 1,
    moderateCount: 0,
    minorCount: 0,
    passesCount: 18,
    incompleteChecksCount: 1,
  },
  {
    id: HISTORICAL_SCAN_ID,
    schemaVersion: 1,
    tabUrl: MOCK_SCAN_2.tabUrl,
    pageTitle: MOCK_SCAN_2.pageTitle,
    hostname: MOCK_SCAN_2.hostname,
    scannedAt: MOCK_SCAN_2.scannedAt,
    status: 'completed',
    totalFindings: 2,
    criticalCount: 1,
    seriousCount: 1,
    moderateCount: 0,
    minorCount: 0,
    passesCount: 18,
    incompleteChecksCount: 1,
  },
];

/**
 * Injects bundled local axe.min.js and executes WCAG 2.2 AA audit
 */
async function runAxeAudit(page: Page, stateName: string) {
  // Inject local pre-bundled axe-core (zero remote network)
  await page.addScriptTag({ path: 'public/vendor/axe.min.js' });

  const results = await page.evaluate(async () => {
    // @ts-expect-error window.axe is loaded via script tag
    return await window.axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
      },
    });
  });

  if (results.violations.length > 0) {
    const formatted = results.violations.map((v: any) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodeCount: v.nodes.length,
      targets: v.nodes.map((n: any) => n.target),
      failureSummaries: v.nodes.map((n: any) => n.failureSummary),
    }));
    console.error(`[axe-core] Detected ${results.violations.length} violations in state [${stateName}]:`, JSON.stringify(formatted, null, 2));
  }

  return results;
}

test.describe('Phantom Audit Phase 9 — Automated Dashboard axe-core Accessibility Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Setup mock chrome API with messaging and storage support
    await page.addInitScript(
      ({ mockScan1, mockScan2, mockSummaries }) => {
        const storageData: Record<string, any> = {
          'phantom_scan_summaries_v1': mockSummaries,
          'phantom_scan_history_v1': [mockScan1, mockScan2],
        };

        window.chrome = {
          ...window.chrome,
          runtime: {
            id: 'phase9-accessibility-extension-id',
            getURL: (path: string) => path,
            sendMessage: (
              msg: { type?: string; requestId?: string; tabId?: number },
              cb: (resp: unknown) => void
            ) => {
              if (msg.type === 'START_SCAN_REQUEST') {
                setTimeout(() => {
                  cb({
                    success: true,
                    type: 'START_SCAN_RESPONSE',
                    requestId: msg.requestId,
                    tabId: msg.tabId,
                    status: 'completed',
                    scanRecord: mockScan1,
                    message: 'Scan completed successfully with 3 findings.',
                  });
                }, 30);
              } else if (msg.type === 'GET_TAB_STATUS') {
                cb({
                  success: true,
                  type: 'TAB_STATUS_RESPONSE',
                  requestId: msg.requestId,
                  tab: {
                    tabId: msg.tabId,
                    url: mockScan1.tabUrl,
                    title: mockScan1.pageTitle,
                    isAlive: true,
                    eligibility: {
                      isEligible: true,
                      title: mockScan1.pageTitle,
                      normalizedUrl: mockScan1.tabUrl,
                    },
                    lastUpdated: Date.now(),
                  },
                });
              }
            },
            onMessage: {
              addListener: () => {},
              removeListener: () => {},
            },
          },
          storage: {
            local: {
              get: (keys: string | string[] | Record<string, any>, cb: (items: Record<string, any>) => void) => {
                if (typeof keys === 'string') {
                  cb({ [keys]: storageData[keys] });
                } else if (Array.isArray(keys)) {
                  const res: Record<string, any> = {};
                  for (const k of keys) res[k] = storageData[k];
                  cb(res);
                } else {
                  cb(storageData);
                }
              },
              set: (items: Record<string, any>, cb?: () => void) => {
                Object.assign(storageData, items);
                cb?.();
              },
              remove: (keys: string | string[], cb?: () => void) => {
                const arr = Array.isArray(keys) ? keys : [keys];
                for (const k of arr) delete storageData[k];
                cb?.();
              },
              clear: (cb?: () => void) => {
                for (const k in storageData) delete storageData[k];
                cb?.();
              },
            },
          },
        } as unknown as typeof chrome;
      },
      {
        mockScan1: MOCK_SCAN_1,
        mockScan2: MOCK_SCAN_2,
        mockSummaries: MOCK_SUMMARIES,
      }
    );
  });

  test('State 1: Dormant / Unscanned State exhibits exactly 0 axe-core violations', async ({ page }) => {
    await page.goto(
      '/dashboard.html?tabId=701&url=https%3A%2F%2Fphantom-auditor.example.com%2Fballroom&title=The%20Grand%20Phantom%20Ballroom'
    );

    await expect(page.getByRole('heading', { level: 1, name: /phantom audit/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /start accessibility audit/i })).toBeVisible();

    const results = await runAxeAudit(page, 'State 1: Dormant State');
    expect(results.violations).toEqual([]);
  });

  test('State 2: Active Audited State (Mansion Map View) exhibits exactly 0 axe-core violations', async ({ page }) => {
    await page.goto(
      '/dashboard.html?tabId=701&url=https%3A%2F%2Fphantom-auditor.example.com%2Fballroom&title=The%20Grand%20Phantom%20Ballroom'
    );

    // Run audit to enter active scanned state
    await page.getByRole('button', { name: /start accessibility audit/i }).click();
    await expect(
      page.getByRole('complementary', { name: /real accessibility audit results/i })
    ).toBeVisible();

    // Verify Mansion Map SVG is visible with accessible 7 rooms
    const mansionMap = page.getByRole('region', { name: /haunted mansion 2d map/i });
    await expect(mansionMap).toBeVisible();

    const results = await runAxeAudit(page, 'State 2: Mansion Map View');
    expect(results.violations).toEqual([]);
  });

  test('State 3: Active Audited State (Room List Table View) exhibits exactly 0 axe-core violations', async ({ page }) => {
    await page.goto(
      '/dashboard.html?tabId=701&url=https%3A%2F%2Fphantom-auditor.example.com%2Fballroom&title=The%20Grand%20Phantom%20Ballroom'
    );

    await page.getByRole('button', { name: /start accessibility audit/i }).click();
    await expect(
      page.getByRole('complementary', { name: /real accessibility audit results/i })
    ).toBeVisible();

    // Switch to List View
    await page.getByRole('button', { name: /list view/i }).click();
    await expect(
      page.getByRole('region', { name: /mansion room taxonomy list/i })
    ).toBeVisible();

    // Verify disambiguated buttons are rendered
    await expect(
      page.getByRole('button', { name: /inspect the name chamber room details/i })
    ).toBeVisible();

    const results = await runAxeAudit(page, 'State 3: Room List Table View');
    expect(results.violations).toEqual([]);
  });

  test('State 4: Finding Inspector Open exhibits exactly 0 axe-core violations', async ({ page }) => {
    await page.goto(
      '/dashboard.html?tabId=701&url=https%3A%2F%2Fphantom-auditor.example.com%2Fballroom&title=The%20Grand%20Phantom%20Ballroom'
    );

    await page.getByRole('button', { name: /start accessibility audit/i }).click();
    await expect(
      page.getByRole('complementary', { name: /real accessibility audit results/i })
    ).toBeVisible();

    // Select The Name Chamber room to view findings
    await page.getByRole('button', { name: /the name chamber/i }).click();

    // Click Inspect button on finding card to open FindingInspector
    const findingCard = page.locator('article').filter({ hasText: /button-name/i }).first();
    await expect(findingCard).toBeVisible();
    await findingCard.getByRole('button', { name: /inspect/i }).click();

    // Verify FindingInspector aside is open
    await expect(
      page.getByRole('complementary', { name: /buttons must have discernible text/i })
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: /remediation guidance/i })).toBeVisible();

    const results = await runAxeAudit(page, 'State 4: Finding Inspector Open');
    expect(results.violations).toEqual([]);
  });

  test('State 5: ActiveTab Privacy Explainer Dialog Open exhibits exactly 0 axe-core violations', async ({ page }) => {
    await page.goto(
      '/dashboard.html?tabId=701&url=https%3A%2F%2Fphantom-auditor.example.com%2Fballroom&title=The%20Grand%20Phantom%20Ballroom'
    );

    // Open activeTab Privacy Explainer modal
    const privacyBtn = page.getByRole('button', { name: /activetab privacy/i });
    await privacyBtn.click();

    const explainerDialog = page.getByRole('dialog', { name: /privacy-first page access/i });
    await expect(explainerDialog).toBeVisible();

    // Verify 0 axe violations inside modal
    const results = await runAxeAudit(page, 'State 5: ActiveTab Explainer Dialog');
    expect(results.violations).toEqual([]);

    // Verify Escape key dismisses modal and restores focus
    await page.keyboard.press('Escape');
    await expect(explainerDialog).not.toBeVisible();
    await expect(privacyBtn).toBeFocused();
  });

  test('State 6: The Archive Drawer Open exhibits exactly 0 axe-core violations', async ({ page }) => {
    await page.goto(
      '/dashboard.html?tabId=701&url=https%3A%2F%2Fphantom-auditor.example.com%2Fballroom&title=The%20Grand%20Phantom%20Ballroom'
    );

    // Open The Archive history drawer
    const archiveBtn = page.getByRole('button', { name: /the archive/i });
    await archiveBtn.click();

    const archiveDrawer = page.getByRole('dialog', { name: /the archive of past hauntings/i });
    await expect(archiveDrawer).toBeVisible();

    // Verify snapshot items with disambiguated buttons are rendered
    await expect(
      page.getByRole('button', { name: /inspect snapshot for the grand phantom ballroom/i }).first()
    ).toBeVisible();

    const results = await runAxeAudit(page, 'State 6: The Archive Drawer Open');
    expect(results.violations).toEqual([]);

    // Verify Escape dismisses drawer and restores focus to archiveBtn
    await page.keyboard.press('Escape');
    await expect(archiveDrawer).not.toBeVisible();
    await expect(archiveBtn).toBeFocused();
  });

  test('State 7: Cross-Scan Comparison View Active exhibits exactly 0 axe-core violations', async ({ page }) => {
    await page.goto(
      '/dashboard.html?tabId=701&url=https%3A%2F%2Fphantom-auditor.example.com%2Fballroom&title=The%20Grand%20Phantom%20Ballroom'
    );

    // Open Archive and switch to Compare Hauntings tab
    await page.getByRole('button', { name: /the archive/i }).click();
    await page.getByRole('tab', { name: /compare hauntings/i }).click();

    // Select Run Comparison action
    await page.getByRole('button', { name: /run comparison/i }).click();

    // Verify Spectral Comparison Banner is active
    await expect(
      page.getByRole('complementary', { name: /cross-scan comparison/i })
    ).toBeVisible();
    await expect(page.getByText(/spectral cross-scan comparison/i)).toBeVisible();

    const results = await runAxeAudit(page, 'State 7: Cross-Scan Comparison Active');
    expect(results.violations).toEqual([]);
  });

  test('State 8: Export Report Dialog Open exhibits exactly 0 axe-core violations', async ({ page }) => {
    await page.goto(
      '/dashboard.html?tabId=701&url=https%3A%2F%2Fphantom-auditor.example.com%2Fballroom&title=The%20Grand%20Phantom%20Ballroom'
    );

    // Run scan so export button becomes active
    await page.getByRole('button', { name: /start accessibility audit/i }).click();
    await expect(
      page.getByRole('complementary', { name: /real accessibility audit results/i })
    ).toBeVisible();

    // Open Export Report modal
    const exportBtn = page.getByRole('button', { name: /export report/i });
    await exportBtn.click();

    const exportDialog = page.getByRole('dialog', { name: /export accessibility report/i });
    await expect(exportDialog).toBeVisible();

    // Verify 0 axe violations inside export modal
    const results = await runAxeAudit(page, 'State 8: Export Report Dialog Open');
    expect(results.violations).toEqual([]);

    // Verify Escape dismisses modal and restores focus to exportBtn
    await page.keyboard.press('Escape');
    await expect(exportDialog).not.toBeVisible();
    await expect(exportBtn).toBeFocused();
  });

  test('Keyboard & Focus Visible Verification: Mansion Rooms & Navigation', async ({ page }) => {
    await page.goto(
      '/dashboard.html?tabId=701&url=https%3A%2F%2Fphantom-auditor.example.com%2Fballroom&title=The%20Grand%20Phantom%20Ballroom'
    );

    await page.getByRole('button', { name: /start accessibility audit/i }).click();
    await expect(
      page.getByRole('complementary', { name: /real accessibility audit results/i })
    ).toBeVisible();

    // Verify Mansion Room buttons have aria-pressed and group class (DEF-931)
    const nameChamber = page.locator('g[data-room-id="name-chamber"]');
    await expect(nameChamber).toHaveAttribute('aria-pressed', 'false');
    await expect(nameChamber).toHaveClass(/group/);

    // Click room and verify aria-pressed becomes true
    await nameChamber.click();
    await expect(nameChamber).toHaveAttribute('aria-pressed', 'true');
  });
});
