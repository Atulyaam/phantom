import { test, expect } from '@playwright/test';

test.describe('Phantom Audit Phase 4 — Scanner Engine & Real Findings Suite', () => {
  test('executes real accessibility audit and renders real scan results banner', async ({
    page,
  }) => {
    // Inject mock extension messaging for the preview environment
    await page.addInitScript(() => {
      window.chrome = {
        ...window.chrome,
        runtime: {
          id: 'test-extension-id',
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
                  scanRecord: {
                    id: '44444444-4444-4444-4444-444444444444',
                    schemaVersion: 1,
                    tabUrl: 'https://example.com/audit-test',
                    pageTitle: 'Active Audit Target',
                    hostname: 'example.com',
                    scannedAt: new Date().toISOString(),
                    completedAt: new Date().toISOString(),
                    axeVersion: '4.14.0',
                    extensionVersion: '0.1.0',
                    browserName: 'chrome',
                    status: 'completed',
                    findings: [
                      {
                        fingerprint: 'v1:button-name:#ghost-action-btn',
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
                            target: ['#ghost-action-btn'],
                            htmlExcerpt:
                              '<button id="ghost-action-btn"><svg></svg></button>',
                            failureSummary: 'Fix element text content or add aria-label',
                          },
                        ],
                        firstSeenAt: new Date().toISOString(),
                        reviewed: false,
                      },
                    ],
                    incompleteChecksCount: 2,
                    passesCount: 18,
                    inapplicableCount: 35,
                  },
                  message: 'Scan completed successfully with 1 finding.',
                });
              }, 50);
            } else if (msg.type === 'GET_TAB_STATUS') {
              cb({
                success: true,
                type: 'TAB_STATUS_RESPONSE',
                requestId: msg.requestId,
                tab: {
                  tabId: msg.tabId,
                  url: 'https://example.com/audit-test',
                  title: 'Active Audit Target',
                  isAlive: true,
                  eligibility: {
                    isEligible: true,
                    title: 'Eligible Target',
                    normalizedUrl: 'https://example.com/audit-test',
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
    });

    await page.goto(
      '/dashboard.html?tabId=101&url=https%3A%2F%2Fexample.com%2Faudit-test&title=Active%20Audit%20Target'
    );

    // Initial state: Dormant (Unscanned)
    await expect(page.getByText('Dormant (Unscanned)')).toBeVisible();

    // Trigger scan
    const startScanBtn = page.getByRole('button', {
      name: /start accessibility audit/i,
    });
    await expect(startScanBtn).toBeVisible();
    await startScanBtn.click();

    // Verify Real Scan Banner appears
    const realScanBanner = page.getByRole('complementary', {
      name: /real accessibility audit results/i,
    });
    await expect(realScanBanner).toBeVisible();

    // Verify axe-core version and title
    await expect(page.getByText(/real audit: axe-core 4\.14\.0/i)).toBeVisible();
    await expect(realScanBanner.getByText('Active Audit Target')).toBeVisible();

    // Verify Metrics Counters
    await expect(page.getByText('Confirmed issues')).toBeVisible();
    await expect(page.getByText('Incomplete checks')).toBeVisible();
    await expect(page.getByText('Rules satisfied')).toBeVisible();
    await expect(page.getByText('Not present on page')).toBeVisible();

    // Verify Non-misleading methodology notice
    await expect(
      page.getByText(
        /zero automated violations does not certify complete wcag conformance/i
      )
    ).toBeVisible();

    // Verify Simulation Status reflects Real Scan
    await expect(page.getByText(/real scan \(1 findings\)/i)).toBeVisible();

    // Verify Name Chamber is Haunted
    const nameChamberBtn = page.getByRole('button', {
      name: /the name chamber/i,
    });
    await expect(nameChamberBtn).toBeVisible();
    await nameChamberBtn.click();

    // Verify real finding card renders
    await expect(
      page.getByRole('article').getByText('button-name', { exact: true })
    ).toBeVisible();
    await expect(page.getByText('Elements must have accessible names')).toBeVisible();

    // Reset to unscanned state
    const resetBtn = page.getByRole('button', { name: /clear real scan/i });
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();

    await expect(page.getByText('Dormant (Unscanned)')).toBeVisible();
  });

  test('handles clean baseline scan with 0 violations without misleading claims', async ({
    page,
  }) => {
    // Inject clean scan result
    await page.addInitScript(() => {
      window.chrome = {
        ...window.chrome,
        runtime: {
          id: 'test-extension-id',
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
                  scanRecord: {
                    id: '55555555-5555-5555-5555-555555555555',
                    schemaVersion: 1,
                    tabUrl: 'https://clean-example.org',
                    pageTitle: 'Clean Accessible Baseline',
                    hostname: 'clean-example.org',
                    scannedAt: new Date().toISOString(),
                    completedAt: new Date().toISOString(),
                    axeVersion: '4.14.0',
                    extensionVersion: '0.1.0',
                    browserName: 'chrome',
                    status: 'completed',
                    findings: [],
                    incompleteChecksCount: 0,
                    passesCount: 25,
                    inapplicableCount: 40,
                  },
                  message: 'Scan completed successfully with 0 findings.',
                });
              }, 50);
            } else if (msg.type === 'GET_TAB_STATUS') {
              cb({
                success: true,
                type: 'TAB_STATUS_RESPONSE',
                requestId: msg.requestId,
                tab: {
                  tabId: msg.tabId,
                  url: 'https://clean-example.org',
                  title: 'Clean Accessible Baseline',
                  isAlive: true,
                  eligibility: {
                    isEligible: true,
                    title: 'Eligible Target',
                    normalizedUrl: 'https://clean-example.org',
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
    });

    await page.goto('/dashboard.html?tabId=202&url=https%3A%2F%2Fclean-example.org');

    const startScanBtn = page.getByRole('button', {
      name: /start accessibility audit/i,
    });
    await startScanBtn.click();

    // Verify 0 violations indicated
    await expect(page.getByText('Real Scan (0 findings)')).toBeVisible();

    // Verify clean empty state is rendered
    await expect(page.getByText(/the mansion is peaceful/i)).toBeVisible();
    await expect(
      page.getByText(
        /no automated accessibility findings were detected across all rooms/i
      )
    ).toBeVisible();
    await expect(
      page.getByText(/manual testing is still required for full wcag conformance/i)
    ).toBeVisible();
  });
});
