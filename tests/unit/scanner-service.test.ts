import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scannerService, type ScanPhase } from '@/features/scanner/scanner-service';
import { tabTracker } from '@/features/tab-management/tab-tracker';
import type { InPageScanOutput } from '@/features/scanner/in-page-runner';

describe('ScannerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tabTracker.releaseScanLock(100);
    tabTracker.releaseScanLock(200);
  });

  it('rejects with TAB_NOT_FOUND if the tab does not exist', async () => {
    vi.mocked(chrome.tabs.get).mockRejectedValueOnce(new Error('Tab not found'));

    await expect(scannerService.scanTab(999)).rejects.toThrowError(
      expect.objectContaining({
        code: 'TAB_NOT_FOUND',
      })
    );
  });

  it('rejects with TAB_INELIGIBLE if the tab URL is restricted', async () => {
    vi.mocked(chrome.tabs.get).mockResolvedValueOnce({
      id: 100,
      url: 'chrome://settings',
      title: 'Settings',
      active: true,
    } as unknown as chrome.tabs.Tab);

    await expect(scannerService.scanTab(100)).rejects.toThrowError(
      expect.objectContaining({
        code: 'TAB_INELIGIBLE',
      })
    );
    expect(tabTracker.isScanLocked(100)).toBe(false);
  });

  it('rejects with CONCURRENCY_LOCKED if another scan is already in progress', async () => {
    tabTracker.acquireScanLock(100);

    vi.mocked(chrome.tabs.get).mockResolvedValueOnce({
      id: 100,
      url: 'https://example.com',
      title: 'Example',
      active: true,
    } as unknown as chrome.tabs.Tab);

    await expect(scannerService.scanTab(100)).rejects.toThrowError(
      expect.objectContaining({
        code: 'CONCURRENCY_LOCKED',
      })
    );

    tabTracker.releaseScanLock(100);
  });

  it('handles injection failure and releases the scan lock', async () => {
    vi.mocked(chrome.tabs.get).mockResolvedValueOnce({
      id: 100,
      url: 'https://example.com',
      title: 'Example',
      active: true,
    } as unknown as chrome.tabs.Tab);

    vi.mocked(chrome.scripting.executeScript).mockRejectedValueOnce(
      new Error('Cannot access contents of url')
    );

    await expect(scannerService.scanTab(100)).rejects.toThrowError(
      expect.objectContaining({
        code: 'INJECTION_FAILED',
      })
    );
    // Lock must be released even on failure
    expect(tabTracker.isScanLocked(100)).toBe(false);
  });

  it('orchestrates successful scan and reports progress phases', async () => {
    const mockOutput: InPageScanOutput = {
      violations: [
        {
          id: 'button-name',
          description: 'Buttons must have discernible text',
          help: 'Critical name check',
          helpUrl: 'https://dequeuniversity.com/rules/axe/button-name',
          impact: 'critical',
          tags: ['wcag2a'],
          nodes: [
            { target: ['#btn'], html: '<button></button>', failureSummary: 'Fail' },
          ],
        },
      ],
      incomplete: [],
      passesCount: 12,
      incompleteCount: 0,
      inapplicableCount: 20,
      pageTitle: 'Audit Page',
      url: 'https://example.com/audit',
      axeVersion: '4.14.0',
    };

    // First tabs.get (initial) and second tabs.get (navigation safety check)
    vi.mocked(chrome.tabs.get).mockResolvedValue({
      id: 100,
      url: 'https://example.com/audit',
      title: 'Audit Page',
      active: true,
    } as unknown as chrome.tabs.Tab);

    // Mock script injections: 1. vendor/axe.min.js, 2. in-page runner
    vi.mocked(chrome.scripting.executeScript)
      .mockResolvedValueOnce([
        { result: null },
      ] as unknown as chrome.scripting.InjectionResult<unknown>[]) // axe bundle injection
      .mockResolvedValueOnce([
        { result: mockOutput },
      ] as unknown as chrome.scripting.InjectionResult<InPageScanOutput>[]); // runner execution

    const progressPhases: ScanPhase[] = [];
    const record = await scannerService.scanTab(100, (phase) => {
      progressPhases.push(phase);
    });

    expect(record.status).toBe('completed');
    expect(record.findings).toHaveLength(1);
    expect(record.findings[0].ruleId).toBe('button-name');
    expect(record.findings[0].roomId).toBe('name-chamber');

    // Lock must be released upon completion
    expect(tabTracker.isScanLocked(100)).toBe(false);

    // Verify progress transitions
    expect(progressPhases).toEqual([
      'validating',
      'injecting',
      'scanning',
      'processing',
      'completed',
    ]);
  });

  it('detects tab navigation during scan execution and rejects with TAB_NAVIGATED', async () => {
    const mockOutput: InPageScanOutput = {
      violations: [],
      incomplete: [],
      passesCount: 1,
      incompleteCount: 0,
      inapplicableCount: 0,
      pageTitle: 'Old Page',
      url: 'https://example.com/old',
      axeVersion: '4.14.0',
    };

    // Initial tab.get
    vi.mocked(chrome.tabs.get).mockResolvedValueOnce({
      id: 100,
      url: 'https://example.com/old',
      title: 'Old Page',
      active: true,
    } as unknown as chrome.tabs.Tab);

    // Mock script injections
    vi.mocked(chrome.scripting.executeScript)
      .mockResolvedValueOnce([
        { result: null },
      ] as unknown as chrome.scripting.InjectionResult<unknown>[])
      .mockResolvedValueOnce([
        { result: mockOutput },
      ] as unknown as chrome.scripting.InjectionResult<InPageScanOutput>[]);

    // Post-scan tab.get returning navigated URL
    vi.mocked(chrome.tabs.get).mockResolvedValueOnce({
      id: 100,
      url: 'https://example.com/new-page',
      title: 'New Page',
      active: true,
    } as unknown as chrome.tabs.Tab);

    await expect(scannerService.scanTab(100)).rejects.toThrowError(
      expect.objectContaining({
        code: 'TAB_NAVIGATED',
      })
    );
    expect(tabTracker.isScanLocked(100)).toBe(false);
  });
});
