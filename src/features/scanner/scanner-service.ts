/**
 * Phantom Audit — Tab Scanner Service
 *
 * Orchestrates the execution of local axe-core accessibility audits on active tabs
 * via chrome.scripting.executeScript. Enforces strict timeouts, concurrency locking,
 * URL validation, and result normalization.
 */

import { browser } from 'wxt/browser';
import { SCANNER_CONFIG } from './scanner-config';
import { runInPageAxeScan, type InPageScanOutput } from './in-page-runner';
import { normalizeScanResults } from '@/features/normalization/axe-normalizer';
import { validateTabEligibility } from '@/features/tab-management/url-validator';
import { tabTracker } from '@/features/tab-management/tab-tracker';
import { sanitizeLogMessage } from '@/lib/logger';
import type { ScanRecord } from '@/domain/scan';

// In Chrome MV3, chrome.tabs and chrome.scripting return native Promises.
// Fallback to WXT browser polyfill when chrome is not available.
const api =
  typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting ? chrome : browser;

export type ScanPhase =
  | 'idle'
  | 'validating'
  | 'injecting'
  | 'scanning'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'timed_out';

export interface ScanProgressCallback {
  (phase: ScanPhase, message: string): void;
}

export class ScannerServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'TAB_NOT_FOUND'
      | 'TAB_INELIGIBLE'
      | 'CONCURRENCY_LOCKED'
      | 'INJECTION_FAILED'
      | 'SCAN_FAILED'
      | 'TIMEOUT'
      | 'TAB_NAVIGATED'
  ) {
    super(message);
    this.name = 'ScannerServiceError';
  }
}

export class ScannerService {
  /**
   * Executes a full accessibility scan on the specified tab.
   */
  async scanTab(tabId: number, onProgress?: ScanProgressCallback): Promise<ScanRecord> {
    onProgress?.('validating', 'Verifying tab eligibility and permission grants...');

    // 1. Check tab existence
    let initialTab: { id?: number; url?: string; title?: string };
    try {
      initialTab = await api.tabs.get(tabId);
    } catch {
      throw new ScannerServiceError(
        `Target tab #${tabId} could not be located in browser.`,
        'TAB_NOT_FOUND'
      );
    }

    const trackedTab = tabTracker.getTargetTab(tabId);
    const effectiveUrl = initialTab.url || trackedTab?.url;

    if (!effectiveUrl) {
      throw new ScannerServiceError(
        `Target tab #${tabId} has no accessible URL.`,
        'TAB_INELIGIBLE'
      );
    }

    // 2. Validate URL eligibility
    const eligibility = validateTabEligibility(effectiveUrl);
    if (!eligibility.isEligible) {
      throw new ScannerServiceError(
        eligibility.title || 'Target page scheme is restricted from scanning.',
        'TAB_INELIGIBLE'
      );
    }

    // 3. Concurrency lock check
    if (tabTracker.isScanLocked(tabId)) {
      throw new ScannerServiceError(
        `An audit is already in progress for tab #${tabId}.`,
        'CONCURRENCY_LOCKED'
      );
    }

    tabTracker.acquireScanLock(tabId);

    try {
      // 4. Inject bundled axe.min.js into isolated world
      onProgress?.('injecting', 'Injecting locally bundled axe-core into page...');
      try {
        await api.scripting.executeScript({
          target: { tabId },
          files: ['vendor/axe.min.js'],
        });
      } catch (injectErr: unknown) {
        const injectMsg =
          injectErr instanceof Error ? injectErr.message : String(injectErr);
        throw new ScannerServiceError(
          `Failed to inject local scanner into tab #${tabId}: ${injectMsg}`,
          'INJECTION_FAILED'
        );
      }

      // 5. Execute in-page scanner with 15s timeout
      onProgress?.('scanning', 'Running WCAG 2.2 accessibility rules against DOM...');
      const scanPromise = (async (): Promise<InPageScanOutput> => {
        const results = await api.scripting.executeScript({
          target: { tabId },
          func: runInPageAxeScan,
          args: [
            {
              tags: [...SCANNER_CONFIG.RULE_TAGS],
              maxNodesPerRule: SCANNER_CONFIG.MAX_NODES_PER_RULE,
              maxHtmlExcerptLength: SCANNER_CONFIG.MAX_HTML_EXCERPT_LENGTH,
            },
          ],
        });

        const output = results?.[0]?.result as InPageScanOutput | undefined;
        if (!output) {
          throw new ScannerServiceError(
            'Scanner execution finished without returning data.',
            'SCAN_FAILED'
          );
        }
        return output;
      })();

      // Timeout race
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new ScannerServiceError(
              `Accessibility scan exceeded ${SCANNER_CONFIG.SCAN_TIMEOUT_MS / 1000}s timeout.`,
              'TIMEOUT'
            )
          );
        }, SCANNER_CONFIG.SCAN_TIMEOUT_MS);
      });

      let rawOutput: InPageScanOutput;
      try {
        rawOutput = await Promise.race([scanPromise, timeoutPromise]);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }

      // 6. Navigation safety check: verify tab didn't navigate mid-scan
      try {
        const postTab = await api.tabs.get(tabId);
        if (postTab.url && postTab.url !== initialTab.url) {
          throw new ScannerServiceError(
            'Target tab navigated to a different page while scan was running.',
            'TAB_NAVIGATED'
          );
        }
      } catch (tabErr) {
        if (tabErr instanceof ScannerServiceError) throw tabErr;
        // If tab was closed during scan:
        throw new ScannerServiceError(
          `Target tab #${tabId} was closed while scan was executing.`,
          'TAB_NOT_FOUND'
        );
      }

      // 7. Normalize raw results into canonical ScanRecord
      onProgress?.('processing', 'Normalizing findings and mapping to mansion rooms...');
      const scanRecord = normalizeScanResults(rawOutput, {
        tabUrl: effectiveUrl,
        pageTitle: initialTab.title || trackedTab?.title || rawOutput.pageTitle,
      });

      onProgress?.('completed', 'Scan completed successfully.');
      return scanRecord;
    } catch (err: unknown) {
      const errorMsg = sanitizeLogMessage(
        err instanceof Error ? err.message : 'Scan execution failed.'
      );
      onProgress?.('failed', errorMsg);
      throw err;
    } finally {
      // Deterministically release lock
      tabTracker.releaseScanLock(tabId);
    }
  }
}

export const scannerService = new ScannerService();
