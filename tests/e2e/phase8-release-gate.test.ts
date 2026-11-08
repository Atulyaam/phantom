import { test, expect } from '@playwright/test';

test.describe('Phantom Audit Phase 8 — Master Release Gate & Full Export Lifecycle E2E Suite', () => {
  const SCAN_ID = '770e8400-e29b-41d4-a716-446655440001';
  const HISTORICAL_SCAN_ID = '770e8400-e29b-41d4-a716-446655440002';

  const MOCK_SCAN = {
    id: SCAN_ID,
    schemaVersion: 1,
    tabUrl:
      'https://phantom-auditor.example.com/ballroom?token=super_secret_auth_token_9999&session=xyz#doorway',
    pageTitle: 'The Grand Phantom Ballroom',
    hostname: 'phantom-auditor.example.com',
    scannedAt: '2026-10-31T22:00:00.000Z',
    axeVersion: '4.10.2',
    extensionVersion: '1.0.0',
    browserName: 'chrome',
    status: 'completed',
    findings: [
      {
        fingerprint: 'fp-button-gate-1',
        ruleId: 'button-name',
        impact: 'critical',
        description: 'Ornate ballroom door button lacks discernible text',
        help: 'Buttons must have discernible text',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/button-name',
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
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast',
        wcagTags: ['wcag2aa', 'wcag143'],
        roomId: 'contrast-crypt',
        affectedNodeCount: 1,
        nodes: [
          {
            target: ['p.inscription-text'],
            htmlExcerpt:
              '<p class="inscription-text">Beware all who enter the ballroom</p>',
            failureSummary: 'Contrast ratio 2.4:1 below minimum required 4.5:1',
          },
        ],
        firstSeenAt: '2026-10-31T22:00:00.000Z',
        reviewed: true,
      },
      {
        fingerprint: 'fp-xss-adversarial-3',
        ruleId: 'image-alt',
        impact: 'critical',
        description: 'Image <script>alert("xss")</script> without alt',
        help: '<svg onload="alert(1)"/> Images must have alt',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/image-alt',
        wcagTags: ['wcag2a', 'wcag111'],
        roomId: 'portrait-gallery',
        affectedNodeCount: 1,
        nodes: [
          {
            target: ['img[src*="evil"]'],
            htmlExcerpt: '<img src="x" onerror="alert(1)">',
            failureSummary: 'Missing alt attribute',
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

  test('Master Journey 1: End-to-End Scan, Privacy Controls, Offline HTML Export & Real Browser DOM Verification', async ({
    page,
    context,
  }) => {
    // Mock runtime messaging for scan execution
    await page.addInitScript(
      ({ mockScan }) => {
        window.chrome = {
          ...window.chrome,
          runtime: {
            id: 'phase8-release-gate-extension-id',
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
                    message: 'Scan completed successfully with 3 findings.',
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
      { mockScan: MOCK_SCAN }
    );

    await page.goto(
      '/dashboard.html?tabId=701&url=https%3A%2F%2Fphantom-auditor.example.com%2Fballroom%3Ftoken%3Dsuper_secret_auth_token_9999%26session%3Dxyz%23doorway&title=The%20Grand%20Phantom%20Ballroom'
    );

    // 1. Verify Export button initially disabled when dormant
    const exportBtn = page.getByRole('button', {
      name: /export report \(no completed scan available\)/i,
    });
    await expect(exportBtn).toBeDisabled();

    // 2. Execute real accessibility audit
    await page.getByRole('button', { name: /start accessibility audit/i }).click();
    await expect(
      page.getByRole('complementary', {
        name: /real accessibility audit results/i,
      })
    ).toBeVisible();

    // 3. Export button is now active
    const activeExportBtn = page.getByRole('button', {
      name: 'Export Accessibility Report',
    });
    await expect(activeExportBtn).toBeEnabled();
    await activeExportBtn.click();

    // 4. Verify Export Dialog opens with full WCAG 2.2 accessibility
    const dialog = page.getByRole('dialog', { name: /export accessibility report/i });
    await expect(dialog).toBeVisible();

    // 5. Configure Privacy Controls
    // Format: HTML Document (default)
    const htmlRadio = dialog.getByRole('radio', { name: /html document/i });
    await expect(htmlRadio).toBeChecked();

    // URL Redaction: select "Path Only" (retains domain and path)
    const pathOnlyRadio = dialog.getByRole('radio', {
      name: /path only/i,
    });
    await pathOnlyRadio.click();
    await expect(pathOnlyRadio).toBeChecked();

    // Verify live preview updates without query parameters or tokens
    await expect(
      dialog.locator('code', {
        hasText: 'https://phantom-auditor.example.com/ballroom',
      })
    ).toBeVisible();

    // Ensure excerpts are unchecked (privacy-safe default)
    const excerptsCheckbox = dialog.getByRole('checkbox', {
      name: /include html dom excerpts/i,
    });
    await expect(excerptsCheckbox).not.toBeChecked();

    // 6. Download standalone offline HTML report
    const downloadBtn = dialog.getByRole('button', { name: /download html/i });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadBtn.click(),
    ]);

    // Verify safe filename without token or credentials (DEF-841)
    const filename = download.suggestedFilename();
    expect(filename).toMatch(
      /^phantom-audit-phantom-auditor-example-com-\d{4}-\d{2}-\d{2}\.html$/
    );
    expect(filename).not.toContain('token');
    expect(filename).not.toContain('secret');

    // 7. Read downloaded HTML content
    const readable = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of readable) {
      chunks.push(Buffer.from(chunk));
    }
    const htmlContent = Buffer.concat(chunks).toString('utf-8');

    // Verify token was redacted in the HTML document
    expect(htmlContent).not.toContain('super_secret_auth_token_9999');
    expect(htmlContent).not.toContain('session=xyz');

    // 8. Render the downloaded HTML in a fresh browser page to verify offline DOM & security
    const reportPage = await context.newPage();
    await reportPage.setContent(htmlContent);

    // Verify document structure and headings
    await expect(reportPage.locator('h1')).toContainText('Phantom Audit Report');
    await expect(
      reportPage.getByText(/phantom-auditor\.example\.com/).first()
    ).toBeVisible();
    await expect(
      reportPage.getByRole('heading', { name: /executive findings summary/i })
    ).toBeVisible();
    await expect(
      reportPage.getByRole('heading', { name: /haunted mansion room breakdown/i })
    ).toBeVisible();
    await expect(
      reportPage.getByRole('heading', {
        name: /detailed accessibility findings \(3\)/i,
      })
    ).toBeVisible();

    // Verify room table has all 7 canonical mansion rooms
    const table = reportPage.locator('table');
    await expect(table).toBeVisible();
    await expect(table.getByText('The Name Chamber')).toBeVisible();
    await expect(table.getByText('The Contrast Crypt')).toBeVisible();
    await expect(table.getByText('The Portrait Gallery')).toBeVisible();

    // Verify automated testing limitations & manual review checklist
    await expect(
      reportPage.getByRole('heading', {
        name: /automated testing scope & legal disclaimers/i,
      })
    ).toBeVisible();
    await expect(
      reportPage.getByText(
        /automated tools can test only a subset of all accessibility requirements/i
      )
    ).toBeVisible();
    await expect(
      reportPage.getByRole('heading', {
        name: /essential manual review checklist/i,
      })
    ).toBeVisible();

    // Verify explicit disclaimer that this is NOT a legal certification
    await expect(
      reportPage.getByText(/does not constitute a legal certification/i)
    ).toBeVisible();

    // Strict Security Audit: Verify parsed DOM tree contains 0 scripts and 0 inline event handlers
    const scriptCount = await reportPage.locator('script').count();
    expect(scriptCount).toBe(0);

    const eventHandlerElements = await reportPage
      .locator('[onclick], [onload], [onerror], [onmouseover], [onfocus]')
      .count();
    expect(eventHandlerElements).toBe(0);

    // Verify CSP meta tag exists and blocks scripts
    const cspMeta = reportPage.locator('meta[http-equiv="Content-Security-Policy"]');
    await expect(cspMeta).toHaveCount(1);
    const cspContent = await cspMeta.getAttribute('content');
    expect(cspContent).toContain("script-src 'none'");
    expect(cspContent).toContain("object-src 'none'");

    // Verify adversarial XSS vectors were properly escaped as text
    await expect(reportPage.getByText('<script>alert("xss")</script>')).toBeVisible();
    await expect(reportPage.getByText('<svg onload="alert(1)"/>')).toBeVisible();

    // Excerpts are omitted because includeHtmlExcerpts was false
    const excerptBlocks = reportPage.locator('.excerpt-box');
    await expect(excerptBlocks).toHaveCount(0);

    await reportPage.close();
  });

  test('Master Journey 2: Machine-Readable Deterministic JSON Export & Source Scan Immutability', async ({
    page,
  }) => {
    await page.addInitScript(
      ({ mockScan }) => {
        window.chrome = {
          ...window.chrome,
          runtime: {
            id: 'phase8-release-gate-extension-id',
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
                    message: 'Scan completed successfully with 3 findings.',
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
      { mockScan: MOCK_SCAN }
    );

    await page.goto(
      '/dashboard.html?tabId=701&url=https%3A%2F%2Fphantom-auditor.example.com%2Fballroom&title=The%20Grand%20Phantom%20Ballroom'
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

    // Select JSON Payload format
    const jsonRadio = dialog.getByRole('radio', { name: /json payload/i });
    await jsonRadio.click();
    await expect(jsonRadio).toBeChecked();

    // Select Hostname only URL redaction
    const hostnameRadio = dialog.getByRole('radio', { name: /hostname only/i });
    await hostnameRadio.click();
    await expect(hostnameRadio).toBeChecked();

    // Trigger JSON download
    const downloadBtn = dialog.getByRole('button', { name: /download json/i });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadBtn.click(),
    ]);

    // Verify JSON filename
    const filename = download.suggestedFilename();
    expect(filename).toMatch(
      /^phantom-audit-phantom-auditor-example-com-\d{4}-\d{2}-\d{2}\.json$/
    );

    // Read and parse JSON content
    const readable = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of readable) {
      chunks.push(Buffer.from(chunk));
    }
    const jsonText = Buffer.concat(chunks).toString('utf-8');
    const parsed = JSON.parse(jsonText);

    // Verify schema conformance
    expect(parsed.reportMetadata.schemaVersion).toBe(1);
    expect(parsed.reportMetadata.tool).toBe('Phantom Audit');
    expect(parsed.reportMetadata.version).toBe('1.0.0');
    expect(parsed.reportMetadata.environment.axeVersion).toBe('4.10.2');

    // Verify target URL was redacted to hostname-only
    expect(parsed.target.url).toBe('https://phantom-auditor.example.com');
    expect(parsed.target.hostname).toBe('phantom-auditor.example.com');

    // Verify findings are present and classified
    expect(parsed.findings).toHaveLength(3);
    expect(parsed.summary.totalFindings).toBe(3);
    expect(parsed.summary.criticalCount).toBe(2);
    expect(parsed.summary.seriousCount).toBe(1);

    // Verify excerpts omitted by default
    expect(parsed.reportMetadata.optionsApplied?.includeHtmlExcerpts).toBe(false);
    expect(parsed.findings[0].nodes[0].htmlExcerpt).toBeUndefined();

    // Verify mandatory limitations and checklist
    expect(parsed.limitations).toContain(
      'Automated accessibility testing tools evaluate programmatic indicators'
    );
    expect(parsed.limitations).toContain('cannot determine complete WCAG conformance');
    expect(parsed.manualReviewChecklist).toHaveLength(8);

    // Verify source scan in DOM was not mutated (findings still visible in UI)
    await expect(
      page.getByText('Ornate ballroom door button lacks discernible text')
    ).toBeVisible();
    await expect(
      page.getByText('Faint ballroom plaque inscription fails minimum contrast ratio')
    ).toBeVisible();
  });

  test('Master Journey 3: Historical Snapshot Export Isolation & Mutation Stress Hardening', async ({
    page,
  }) => {
    const HISTORICAL_SCAN = {
      id: HISTORICAL_SCAN_ID,
      schemaVersion: 1,
      tabUrl: 'https://archives.manor.org/foyer?session=ancient_scroll',
      pageTitle: 'Ancient Foyer Archive',
      hostname: 'archives.manor.org',
      scannedAt: '2026-10-25T14:30:00.000Z',
      axeVersion: '4.10.2',
      extensionVersion: '1.0.0',
      browserName: 'chrome',
      status: 'completed',
      findings: [
        {
          fingerprint: 'fp-ancient-foyer-1',
          ruleId: 'heading-order',
          impact: 'moderate',
          description: 'Heading order in foyer skips h2 to h4',
          help: 'Heading levels should only increase by one',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/heading-order',
          wcagTags: ['wcag2a', 'wcag131'],
          roomId: 'structure-hall',
          affectedNodeCount: 1,
          nodes: [
            {
              target: ['h4.foyer-title'],
              htmlExcerpt: '<h4 class="foyer-title">Foyer Arch</h4>',
              failureSummary: 'Heading order invalid',
            },
          ],
          firstSeenAt: '2026-10-25T14:30:00.000Z',
          reviewed: false,
        },
      ],
      incompleteChecksCount: 0,
      passesCount: 12,
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
      criticalCount: 0,
      seriousCount: 0,
      moderateCount: 1,
      minorCount: 0,
      passesCount: 12,
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

    // Open The Archive
    await page.getByRole('button', { name: /the archive/i }).click();
    const drawer = page.getByRole('dialog', {
      name: /the archive of past hauntings/i,
    });
    await expect(drawer).toBeVisible();

    // Inspect the snapshot
    await drawer.getByRole('button', { name: /^Inspect$/i }).click();
    const banner = page.locator(
      'aside[aria-label="Historical Snapshot Inspection Mode"]'
    );
    await expect(banner).toBeVisible();
    await expect(banner.getByText('Ancient Foyer Archive')).toBeVisible();

    // Open Export Snapshot dialog
    const exportSnapshotBtn = banner.getByRole('button', {
      name: /export snapshot/i,
    });
    await exportSnapshotBtn.click();

    const dialog = page.getByRole('dialog', { name: /export accessibility report/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('archives.manor.org', { exact: true })).toBeVisible();

    // Verify dialog indicates historical snapshot hostname and heading
    await expect(
      dialog.getByRole('heading', { name: 'Export Accessibility Report' })
    ).toBeVisible();
    await expect(dialog.getByText('archives.manor.org', { exact: true })).toBeVisible();

    // Close dialog via Cancel
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
