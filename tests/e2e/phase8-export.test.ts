import { test, expect } from '@playwright/test';

test.describe('Phantom Audit Phase 8 — Report Export & Privacy UI E2E Suite', () => {
  const MOCK_SCAN_RECORD = {
    id: '88888888-8888-4888-8888-888888888888',
    schemaVersion: 1,
    tabUrl: 'https://specter.example.com/library/catalog?query=ghosts#section-1',
    pageTitle: 'Haunted Specter Library Catalog',
    hostname: 'specter.example.com',
    scannedAt: '2026-10-31T21:00:00.000Z',
    completedAt: '2026-10-31T21:00:05.000Z',
    axeVersion: '4.14.0',
    extensionVersion: '0.1.0',
    browserName: 'chrome',
    status: 'completed',
    findings: [
      {
        fingerprint: 'v1:button-name:#search-spectral-btn',
        ruleId: 'button-name',
        impact: 'critical',
        description: 'Buttons must have discernible text',
        help: 'Elements must have accessible names',
        helpUrl: 'https://dequeuniversity.com/rules/axe/button-name',
        wcagTags: ['wcag2a', 'wcag412'],
        roomId: 'name-chamber',
        affectedNodeCount: 1,
        nodes: [
          {
            target: ['#search-spectral-btn'],
            htmlExcerpt: '<button id="search-spectral-btn"><svg></svg></button>',
            failureSummary: 'Fix element text content or add aria-label',
          },
        ],
        firstSeenAt: '2026-10-31T21:00:00.000Z',
        reviewed: false,
      },
      {
        fingerprint: 'v1:color-contrast:.faint-catalog-item',
        ruleId: 'color-contrast',
        impact: 'serious',
        description: 'Elements must meet minimum color contrast ratio',
        help: 'Ensure text contrast ratio meets WCAG 2 AA minimum of 4.5:1',
        helpUrl: 'https://dequeuniversity.com/rules/axe/color-contrast',
        wcagTags: ['wcag2aa', 'wcag143'],
        roomId: 'contrast-crypt',
        affectedNodeCount: 1,
        nodes: [
          {
            target: ['.faint-catalog-item'],
            htmlExcerpt: '<p class="faint-catalog-item">Spooky ancient book title</p>',
            failureSummary: 'Contrast ratio 2.3:1 below required 4.5:1',
          },
        ],
        firstSeenAt: '2026-10-31T21:00:00.000Z',
        reviewed: false,
      },
    ],
    incompleteChecksCount: 1,
    passesCount: 22,
    inapplicableCount: 12,
  };

  test('Export Report button is disabled when dormant and becomes active upon completed scan', async ({
    page,
  }) => {
    await page.addInitScript(
      ({ mockScan }) => {
        window.chrome = {
          ...window.chrome,
          runtime: {
            id: 'test-export-extension-id',
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
                    scanRecord: mockScan,
                    message: 'Scan completed successfully with 2 findings.',
                  });
                }, 50);
              } else if (msg.type === 'GET_TAB_STATUS') {
                cb({
                  success: true,
                  type: 'TAB_STATUS_RESPONSE',
                  requestId: msg.requestId,
                  tab: {
                    tabId: msg.tabId,
                    url: mockScan.tabUrl,
                    title: mockScan.pageTitle,
                    isAlive: true,
                    eligibility: {
                      isEligible: true,
                      title: mockScan.pageTitle,
                      normalizedUrl: mockScan.tabUrl,
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
        } as unknown as typeof chrome;
      },
      { mockScan: MOCK_SCAN_RECORD }
    );

    await page.goto(
      '/dashboard.html?tabId=101&url=https%3A%2F%2Fspecter.example.com%2Flibrary%2Fcatalog&title=Haunted%20Specter%20Library%20Catalog'
    );

    // Initial state: Export Report button exists in header and is disabled
    const dormantExportBtn = page.getByRole('button', {
      name: 'Export Report (No completed scan available)',
    });
    await expect(dormantExportBtn).toBeVisible();
    await expect(dormantExportBtn).toBeDisabled();

    // Trigger scan
    const startScanBtn = page.getByRole('button', {
      name: /start accessibility audit/i,
    });
    await startScanBtn.click();

    // Verify scan completes
    await expect(
      page.getByRole('complementary', {
        name: /real accessibility audit results/i,
      })
    ).toBeVisible();

    // Export button in header should now be active and enabled
    const activeExportBtn = page.getByRole('button', {
      name: 'Export Accessibility Report',
    });
    await expect(activeExportBtn).toBeVisible();
    await expect(activeExportBtn).toBeEnabled();
  });

  test('opens Export modal with full WCAG 2.2 accessibility, updates live URL preview, and supports Escape dismiss', async ({
    page,
  }) => {
    await page.addInitScript(
      ({ mockScan }) => {
        window.chrome = {
          ...window.chrome,
          runtime: {
            id: 'test-export-extension-id',
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
                    scanRecord: mockScan,
                    message: 'Scan completed successfully with 2 findings.',
                  });
                }, 50);
              } else if (msg.type === 'GET_TAB_STATUS') {
                cb({
                  success: true,
                  type: 'TAB_STATUS_RESPONSE',
                  requestId: msg.requestId,
                  tab: {
                    tabId: msg.tabId,
                    url: mockScan.tabUrl,
                    title: mockScan.pageTitle,
                    isAlive: true,
                    eligibility: {
                      isEligible: true,
                      title: mockScan.pageTitle,
                      normalizedUrl: mockScan.tabUrl,
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
        } as unknown as typeof chrome;
      },
      { mockScan: MOCK_SCAN_RECORD }
    );

    await page.goto(
      '/dashboard.html?tabId=101&url=https%3A%2F%2Fspecter.example.com%2Flibrary%2Fcatalog&title=Haunted%20Specter%20Library%20Catalog'
    );

    // Complete scan
    await page.getByRole('button', { name: /start accessibility audit/i }).click();
    await expect(
      page.getByRole('complementary', {
        name: /real accessibility audit results/i,
      })
    ).toBeVisible();

    // Click Export Report
    const exportBtn = page.getByRole('button', { name: 'Export Accessibility Report' });
    await exportBtn.click();

    // Verify modal dialog accessibility
    const dialog = page.getByRole('dialog', { name: /export accessibility report/i });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');

    // Verify target hostname and disclaimers
    await expect(dialog.getByText('specter.example.com', { exact: true })).toBeVisible();
    await expect(dialog.getByText(/automated redaction guarantee/i)).toBeVisible();
    await expect(
      dialog.getByText(/do not constitute legal accessibility certification/i)
    ).toBeVisible();

    // Verify default URL preview via code tag inside URL in Report
    const urlPreview = dialog.locator('code');
    await expect(urlPreview).toBeVisible();
    await expect(urlPreview).toHaveText(
      'https://specter.example.com/library/catalog?query=ghosts#section-1'
    );

    // Change redaction scope to "Hostname Only"
    const hostnameRadio = dialog.getByRole('radio', { name: /hostname only/i });
    await hostnameRadio.check();
    await expect(urlPreview).toHaveText('https://specter.example.com');

    // Change redaction scope to "Path Only"
    const pathRadio = dialog.getByRole('radio', { name: /path only/i });
    await pathRadio.check();
    await expect(urlPreview).toHaveText('https://specter.example.com/library/catalog');

    // Test Escape key dismiss & focus restoration
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(exportBtn).toBeFocused();
  });

  test('downloads standalone offline HTML report via zero-permission Blob dispatch', async ({
    page,
  }) => {
    await page.addInitScript(
      ({ mockScan }) => {
        window.chrome = {
          ...window.chrome,
          runtime: {
            id: 'test-export-extension-id',
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
                    scanRecord: mockScan,
                    message: 'Scan completed successfully with 2 findings.',
                  });
                }, 50);
              } else if (msg.type === 'GET_TAB_STATUS') {
                cb({
                  success: true,
                  type: 'TAB_STATUS_RESPONSE',
                  requestId: msg.requestId,
                  tab: {
                    tabId: msg.tabId,
                    url: mockScan.tabUrl,
                    title: mockScan.pageTitle,
                    isAlive: true,
                    eligibility: {
                      isEligible: true,
                      title: mockScan.pageTitle,
                      normalizedUrl: mockScan.tabUrl,
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
        } as unknown as typeof chrome;
      },
      { mockScan: MOCK_SCAN_RECORD }
    );

    await page.goto(
      '/dashboard.html?tabId=101&url=https%3A%2F%2Fspecter.example.com%2Flibrary%2Fcatalog&title=Haunted%20Specter%20Library%20Catalog'
    );

    // Complete scan
    await page.getByRole('button', { name: /start accessibility audit/i }).click();
    await expect(
      page.getByRole('complementary', {
        name: /real accessibility audit results/i,
      })
    ).toBeVisible();

    // Open Export dialog
    await page.getByRole('button', { name: 'Export Accessibility Report' }).click();
    const dialog = page.getByRole('dialog', { name: /export accessibility report/i });
    await expect(dialog).toBeVisible();

    // Verify HTML format is selected by default
    const htmlRadio = dialog.getByRole('radio', { name: /html document/i });
    await expect(htmlRadio).toBeChecked();

    const downloadBtn = dialog.getByRole('button', { name: /download html/i });
    await expect(downloadBtn).toBeVisible();

    // Trigger download and intercept event
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadBtn.click(),
    ]);

    // Verify filename format
    const filename = download.suggestedFilename();
    expect(filename).toMatch(
      /^phantom-audit-specter-example-com-\d{4}-\d{2}-\d{2}\.html$/
    );

    // Read download stream and verify contents
    const readable = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of readable) {
      chunks.push(Buffer.from(chunk));
    }
    const htmlContent = Buffer.concat(chunks).toString('utf-8');

    // Structural HTML assertions
    expect(htmlContent).toContain('<!DOCTYPE html>');
    expect(htmlContent).toContain('<title>Phantom Audit Report &mdash;');
    expect(htmlContent).toContain('specter.example.com');
    expect(htmlContent).toContain('Buttons must have discernible text');
    expect(htmlContent).toContain('Elements must meet minimum color contrast ratio');
    expect(htmlContent).toContain('Kiroween 2026 Hackathon Edition');
    expect(htmlContent).toContain('Automated Testing Scope &amp; Legal Disclaimers');
    expect(htmlContent).toContain('does not constitute a legal certification');
  });

  test('downloads machine-readable deterministic JSON report', async ({ page }) => {
    await page.addInitScript(
      ({ mockScan }) => {
        window.chrome = {
          ...window.chrome,
          runtime: {
            id: 'test-export-extension-id',
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
                    scanRecord: mockScan,
                    message: 'Scan completed successfully with 2 findings.',
                  });
                }, 50);
              } else if (msg.type === 'GET_TAB_STATUS') {
                cb({
                  success: true,
                  type: 'TAB_STATUS_RESPONSE',
                  requestId: msg.requestId,
                  tab: {
                    tabId: msg.tabId,
                    url: mockScan.tabUrl,
                    title: mockScan.pageTitle,
                    isAlive: true,
                    eligibility: {
                      isEligible: true,
                      title: mockScan.pageTitle,
                      normalizedUrl: mockScan.tabUrl,
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
        } as unknown as typeof chrome;
      },
      { mockScan: MOCK_SCAN_RECORD }
    );

    await page.goto(
      '/dashboard.html?tabId=101&url=https%3A%2F%2Fspecter.example.com%2Flibrary%2Fcatalog&title=Haunted%20Specter%20Library%20Catalog'
    );

    // Complete scan
    await page.getByRole('button', { name: /start accessibility audit/i }).click();
    await expect(
      page.getByRole('complementary', {
        name: /real accessibility audit results/i,
      })
    ).toBeVisible();

    // Open Export dialog
    await page.getByRole('button', { name: 'Export Accessibility Report' }).click();
    const dialog = page.getByRole('dialog', { name: /export accessibility report/i });
    await expect(dialog).toBeVisible();

    // Select JSON format
    const jsonRadio = dialog.getByRole('radio', { name: /json payload/i });
    await jsonRadio.check();
    await expect(jsonRadio).toBeChecked();

    const downloadBtn = dialog.getByRole('button', { name: /download json/i });
    await expect(downloadBtn).toBeVisible();

    // Trigger download
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadBtn.click(),
    ]);

    // Verify filename format
    const filename = download.suggestedFilename();
    expect(filename).toMatch(
      /^phantom-audit-specter-example-com-\d{4}-\d{2}-\d{2}\.json$/
    );

    // Read download stream and verify JSON schema
    const readable = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of readable) {
      chunks.push(Buffer.from(chunk));
    }
    const jsonContent = Buffer.concat(chunks).toString('utf-8');
    const parsed = JSON.parse(jsonContent);

    expect(parsed.reportMetadata.schemaVersion).toBe(1);
    expect(parsed.reportMetadata.tool).toBe('Phantom Audit');
    expect(parsed.reportMetadata.toolVersion).toBe('0.1.0');
    expect(parsed.reportMetadata.environment.axeVersion).toBe('4.14.0');
    expect(parsed.target.hostname).toBe('specter.example.com');
    expect(parsed.findings).toHaveLength(2);
    expect(parsed.limitations).toContain(
      'Zero reported automated violations does not establish'
    );
    expect(parsed.manualReviewChecklist).toHaveLength(8);
  });

  test('supports exporting historical snapshots from The Archive with state isolation', async ({
    page,
  }) => {
    const HISTORICAL_SCAN_ID = '77777777-7777-4777-7777-777777777777';
    const HISTORICAL_SCAN = {
      id: HISTORICAL_SCAN_ID,
      schemaVersion: 1,
      tabUrl: 'https://vault.haunted-archives.org/tomb?id=vault-9',
      pageTitle: 'Haunted Archives Ancient Tomb',
      hostname: 'vault.haunted-archives.org',
      scannedAt: '2026-10-15T12:00:00.000Z',
      completedAt: '2026-10-15T12:00:04.000Z',
      axeVersion: '4.10.2',
      extensionVersion: '0.1.0',
      browserName: 'chrome',
      status: 'completed',
      findings: [
        {
          fingerprint: 'v1:image-alt:#crypt-statue',
          ruleId: 'image-alt',
          impact: 'critical',
          description: 'Images must have alternate text',
          help: 'Provide alt attribute for ancient statue image',
          helpUrl: 'https://dequeuniversity.com/rules/axe/image-alt',
          wcagTags: ['wcag2a', 'wcag111'],
          roomId: 'portrait-gallery',
          affectedNodeCount: 1,
          nodes: [
            {
              target: ['#crypt-statue'],
              htmlExcerpt: '<img id="crypt-statue" src="statue.png">',
              failureSummary: 'Missing alt attribute',
            },
          ],
          firstSeenAt: '2026-10-15T12:00:00.000Z',
          reviewed: false,
        },
      ],
      incompleteChecksCount: 0,
      passesCount: 10,
      inapplicableCount: 4,
    };

    const HISTORICAL_SUMMARY = {
      id: HISTORICAL_SCAN_ID,
      schemaVersion: 1,
      tabUrl: HISTORICAL_SCAN.tabUrl,
      pageTitle: HISTORICAL_SCAN.pageTitle,
      hostname: HISTORICAL_SCAN.hostname,
      scannedAt: HISTORICAL_SCAN.scannedAt,
      status: HISTORICAL_SCAN.status,
      totalFindings: 1,
      criticalCount: 1,
      seriousCount: 0,
      moderateCount: 0,
      minorCount: 0,
      passesCount: 10,
      incompleteChecksCount: 0,
    };

    await page.goto('/dashboard.html?demo=1');

    // Seed storage with historical snapshot
    await page.evaluate(
      async ({ scan, summary }) => {
        localStorage.setItem('phantom_scan_history_v1', JSON.stringify([scan]));
        localStorage.setItem('phantom_scan_summaries_v1', JSON.stringify([summary]));
        if (window.chrome?.storage?.local) {
          await window.chrome.storage.local.set({
            phantom_scan_history_v1: [scan],
            phantom_scan_summaries_v1: [summary],
          });
        }
      },
      { scan: HISTORICAL_SCAN, summary: HISTORICAL_SUMMARY }
    );

    // Open The Archive drawer
    const archiveBtn = page.getByRole('button', { name: /the archive/i });
    await archiveBtn.click();

    const drawer = page.getByRole('dialog', { name: /the archive of past hauntings/i });
    await expect(drawer).toBeVisible();

    // Click "Inspect" button for the tomb scan
    const inspectBtn = drawer.getByRole('button', { name: /^Inspect$/i });
    await inspectBtn.click();

    // Verify Historical Snapshot banner is displayed
    const banner = page.locator(
      'aside[aria-label="Historical Snapshot Inspection Mode"]'
    );
    await expect(banner).toBeVisible();
    await expect(banner.getByText('Haunted Archives Ancient Tomb')).toBeVisible();

    // Verify "Export Snapshot" button is present on the banner
    const exportSnapshotBtn = banner.getByRole('button', { name: /export snapshot/i });
    await expect(exportSnapshotBtn).toBeVisible();

    // Click "Export Snapshot"
    await exportSnapshotBtn.click();

    // Modal should open bound to the historical scan
    const dialog = page.getByRole('dialog', { name: /export accessibility report/i });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText('vault.haunted-archives.org', { exact: true })
    ).toBeVisible();

    // Select JSON and download
    await dialog.getByRole('radio', { name: /json payload/i }).check();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dialog.getByRole('button', { name: /download json/i }).click(),
    ]);

    // Check filename references the historical hostname
    const filename = download.suggestedFilename();
    expect(filename).toMatch(
      /^phantom-audit-vault-haunted-archives-org-\d{4}-\d{2}-\d{2}\.json$/
    );

    // Verify historical data in the downloaded file
    const readable = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of readable) {
      chunks.push(Buffer.from(chunk));
    }
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
    expect(parsed.target.hostname).toBe('vault.haunted-archives.org');
    expect(parsed.target.pageTitle).toBe('Haunted Archives Ancient Tomb');
    expect(parsed.findings[0].ruleId).toBe('image-alt');

    // Return to live scan
    await banner.getByRole('button', { name: /return to live scan/i }).click();
    await expect(banner).not.toBeVisible();
  });

  test('closing export dialog and returning to live mode enforces strict active/historical isolation', async ({
    page,
  }) => {
    const HISTORICAL_SCAN_ID = '550e8400-e29b-41d4-a716-446655440006';
    const HISTORICAL_SCAN = {
      id: HISTORICAL_SCAN_ID,
      schemaVersion: 1,
      tabUrl: 'https://archives.crypt.org/chamber-1',
      pageTitle: 'Crypt Archives Chamber',
      hostname: 'archives.crypt.org',
      scannedAt: '2026-10-20T10:00:00.000Z',
      axeVersion: '4.10.2',
      extensionVersion: '1.0.0',
      browserName: 'chrome',
      status: 'completed',
      findings: [],
      incompleteChecksCount: 0,
      passesCount: 8,
      inapplicableCount: 2,
    };

    const HISTORICAL_SUMMARY = {
      id: HISTORICAL_SCAN_ID,
      schemaVersion: 1,
      tabUrl: HISTORICAL_SCAN.tabUrl,
      pageTitle: HISTORICAL_SCAN.pageTitle,
      hostname: HISTORICAL_SCAN.hostname,
      scannedAt: HISTORICAL_SCAN.scannedAt,
      status: HISTORICAL_SCAN.status,
      totalFindings: 0,
      criticalCount: 0,
      seriousCount: 0,
      moderateCount: 0,
      minorCount: 0,
      passesCount: 8,
      incompleteChecksCount: 0,
    };

    await page.goto('/dashboard.html?demo=1');

    await page.evaluate(
      async ({ scan, summary }) => {
        localStorage.setItem('phantom_scan_history_v1', JSON.stringify([scan]));
        localStorage.setItem('phantom_scan_summaries_v1', JSON.stringify([summary]));
        if (window.chrome?.storage?.local) {
          await window.chrome.storage.local.set({
            phantom_scan_history_v1: [scan],
            phantom_scan_summaries_v1: [summary],
          });
        }
      },
      { scan: HISTORICAL_SCAN, summary: HISTORICAL_SUMMARY }
    );

    // Open archive and inspect
    await page.getByRole('button', { name: /the archive/i }).click();
    const drawer = page.getByRole('dialog', { name: /the archive of past hauntings/i });
    await expect(drawer).toBeVisible();

    await drawer.getByRole('button', { name: /^Inspect$/i }).click();
    await expect(drawer).not.toBeVisible();

    const banner = page.locator(
      'aside[aria-label="Historical Snapshot Inspection Mode"]'
    );
    await expect(banner).toBeVisible();

    // Open export modal from snapshot banner
    await banner.getByRole('button', { name: /export snapshot/i }).click();
    const dialog = page.getByRole('dialog', { name: /export accessibility report/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('archives.crypt.org', { exact: true })).toBeVisible();

    // Dismiss modal via Cancel button
    await dialog.getByRole('button', { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();

    // Return to live scan
    await banner.getByRole('button', { name: /return to live scan/i }).click();
    await expect(banner).not.toBeVisible();

    // In demo mode, live scan export should be disabled (no real active scan)
    const exportBtn = page.getByRole('button', {
      name: 'Export Report (No completed scan available)',
    });
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toBeDisabled();
  });
});
