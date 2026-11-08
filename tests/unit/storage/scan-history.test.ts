import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import {
  storageService,
  sanitizeUrlForStorage,
  computeScanSummary,
  isSensitiveQueryParam,
  MAX_SCAN_SNAPSHOTS,
  SCAN_HISTORY_KEY,
  SCAN_SUMMARIES_KEY,
} from '@/lib/storage';
import type { ScanRecord } from '@/domain/scan';
import type { FindingRecord } from '@/domain/finding';

function createMockFinding(
  ruleId: string,
  impact: 'critical' | 'serious' | 'moderate' | 'minor'
): FindingRecord {
  return {
    fingerprint: `v1:${ruleId}:target-${Math.random().toString(36).substring(7)}`,
    ruleId,
    impact,
    description: `Description for ${ruleId}`,
    help: `Help for ${ruleId}`,
    wcagTags: ['wcag2a'],
    roomId: 'name-chamber',
    affectedNodeCount: 1,
    nodes: [
      {
        target: ['button.btn'],
        htmlExcerpt: '<button>Click</button>',
        failureSummary: 'Fix element',
      },
    ],
    firstSeenAt: new Date().toISOString(),
    reviewed: false,
  };
}

function createMockScan(overrides?: Partial<ScanRecord>): ScanRecord {
  const id = crypto.randomUUID();
  return {
    id,
    schemaVersion: 1,
    tabUrl: 'https://example.com/audit',
    pageTitle: 'Test Page',
    hostname: 'example.com',
    scannedAt: new Date().toISOString(),
    axeVersion: '4.14.0',
    extensionVersion: '0.1.0',
    browserName: 'chrome',
    status: 'completed',
    findings: [
      createMockFinding('button-name', 'critical'),
      createMockFinding('image-alt', 'serious'),
      createMockFinding('color-contrast', 'moderate'),
      createMockFinding('heading-order', 'minor'),
    ],
    incompleteChecksCount: 2,
    passesCount: 15,
    inapplicableCount: 5,
    ...overrides,
  };
}

describe('Phase 7 Workstream 1: Local History Domain, Snapshot Schema & Storage', () => {
  beforeEach(async () => {
    await storageService.clearAllData();
  });

  describe('URL Credential & Token Sanitization (sanitizeUrlForStorage)', () => {
    it('removes userinfo credentials (username:password@...)', () => {
      const sensitive = 'https://admin:superSecret123@example.com/dashboard';
      const sanitized = sanitizeUrlForStorage(sensitive);
      expect(sanitized).toBe('https://example.com/dashboard');
      expect(sanitized).not.toContain('superSecret123');
      expect(sanitized).not.toContain('admin:');
    });

    it('strips known credential and token query parameters while preserving non-sensitive parameters', () => {
      const url =
        'https://example.com/search?q=accessibility&token=secret_token_123&page=2&auth=bearer_abc&filter=active';
      const sanitized = sanitizeUrlForStorage(url);

      expect(sanitized).toContain('q=accessibility');
      expect(sanitized).toContain('page=2');
      expect(sanitized).toContain('filter=active');
      expect(sanitized).not.toContain('secret_token_123');
      expect(sanitized).not.toContain('bearer_abc');
      expect(sanitized).not.toContain('token=');
      expect(sanitized).not.toContain('auth=');
    });

    it('identifies compound sensitive keys like access_token, api_key, and session_id', () => {
      expect(isSensitiveQueryParam('access_token')).toBe(true);
      expect(isSensitiveQueryParam('api_key')).toBe(true);
      expect(isSensitiveQueryParam('client_secret')).toBe(true);
      expect(isSensitiveQueryParam('session_id')).toBe(true);
      expect(isSensitiveQueryParam('user_token')).toBe(true);
      expect(isSensitiveQueryParam('auth_token')).toBe(true);
    });

    it('does not falsely strip non-sensitive words containing token/key substrings', () => {
      expect(isSensitiveQueryParam('author')).toBe(false);
      expect(isSensitiveQueryParam('authority')).toBe(false);
      expect(isSensitiveQueryParam('keyboard')).toBe(false);
      expect(isSensitiveQueryParam('monkey')).toBe(false);
      expect(isSensitiveQueryParam('page')).toBe(false);
      expect(isSensitiveQueryParam('search')).toBe(false);
    });

    it('sanitizes query parameters embedded within SPA hash routes', () => {
      const spaUrl =
        'https://example.com/#/callback?access_token=jwt_xyz_123&view=profile&session=sid456';
      const sanitized = sanitizeUrlForStorage(spaUrl);

      expect(sanitized).toContain('#/callback?view=profile');
      expect(sanitized).not.toContain('jwt_xyz_123');
      expect(sanitized).not.toContain('access_token=');
      expect(sanitized).not.toContain('session=');
    });

    it('sanitizes OAuth2 implicit grant / OIDC hash tokens formatted without question marks', () => {
      const oAuthUrl =
        'https://example.com/#access_token=eyJhbGciOiJIUzI1NiJ9.test&token_type=bearer&state=xyzSecret123';
      const sanitized = sanitizeUrlForStorage(oAuthUrl);

      expect(sanitized).toBe('https://example.com/');
      expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiJ9');
      expect(sanitized).not.toContain('access_token');
      expect(sanitized).not.toContain('state');
    });

    it('strips percent-encoded sensitive query parameter names', () => {
      // %61%63%63%65%73%73%5f%74%6f%6b%65%6e === "access_token"
      const encodedUrl =
        'https://example.com/?%61%63%63%65%73%73%5f%74%6f%6b%65%6e=my_secret&view=home';
      const sanitized = sanitizeUrlForStorage(encodedUrl);

      expect(sanitized).toBe('https://example.com/?view=home');
      expect(sanitized).not.toContain('my_secret');
    });

    it('strips repeated sensitive query parameters and case variations', () => {
      const url =
        'https://example.com/search?TOKEN=first&token=second&ApiKey=third&valid=true';
      const sanitized = sanitizeUrlForStorage(url);

      expect(sanitized).toBe('https://example.com/search?valid=true');
      expect(sanitized).not.toContain('first');
      expect(sanitized).not.toContain('second');
      expect(sanitized).not.toContain('third');
    });

    it('property test: idempotency of URL sanitization', () => {
      fc.assert(
        fc.property(
          fc.webUrl({ withQueryParameters: true, withFragments: true }),
          (rawUrl) => {
            const firstPass = sanitizeUrlForStorage(rawUrl);
            const secondPass = sanitizeUrlForStorage(firstPass);
            expect(secondPass).toBe(firstPass);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('ScanSummary Computation (computeScanSummary)', () => {
    it('accurately computes violation severity counts and metadata', () => {
      const scan = createMockScan();
      const summary = computeScanSummary(scan);

      expect(summary.id).toBe(scan.id);
      expect(summary.totalFindings).toBe(4);
      expect(summary.criticalCount).toBe(1);
      expect(summary.seriousCount).toBe(1);
      expect(summary.moderateCount).toBe(1);
      expect(summary.minorCount).toBe(1);
      expect(summary.passesCount).toBe(15);
      expect(summary.incompleteChecksCount).toBe(2);
      expect(summary.status).toBe('completed');
    });

    it('sanitizes URL when creating summary', () => {
      const scan = createMockScan({
        tabUrl: 'https://example.com/app?token=secret123&view=home',
      });
      const summary = computeScanSummary(scan);
      expect(summary.tabUrl).toBe('https://example.com/app?view=home');
      expect(summary.tabUrl).not.toContain('token=secret123');
    });
  });

  describe('StorageService Snapshot & History Management', () => {
    it('persists a scan snapshot and updates summaries index', async () => {
      const scan = createMockScan({
        tabUrl: 'https://example.com/audit?auth=mytoken&page=1',
      });

      await storageService.saveScan(scan);

      const history = await storageService.getScanHistory();
      expect(history.length).toBe(1);
      expect(history[0]?.id).toBe(scan.id);
      // Verify URL was sanitized prior to persistence
      expect(history[0]?.tabUrl).toBe('https://example.com/audit?page=1');
      expect(history[0]?.tabUrl).not.toContain('auth=mytoken');

      const summaries = await storageService.getScanSummaries();
      expect(summaries.length).toBe(1);
      expect(summaries[0]?.id).toBe(scan.id);
      expect(summaries[0]?.totalFindings).toBe(4);
      expect(summaries[0]?.criticalCount).toBe(1);
      expect(summaries[0]?.tabUrl).toBe('https://example.com/audit?page=1');
    });

    it('retrieves full ScanRecord snapshot by UUID using getScanById', async () => {
      const scan1 = createMockScan({ pageTitle: 'Page 1' });
      const scan2 = createMockScan({ pageTitle: 'Page 2' });

      await storageService.saveScan(scan1);
      await storageService.saveScan(scan2);

      const retrieved1 = await storageService.getScanById(scan1.id);
      expect(retrieved1).not.toBeNull();
      expect(retrieved1?.pageTitle).toBe('Page 1');
      expect(retrieved1?.findings.length).toBe(4);

      const retrieved2 = await storageService.getScanById(scan2.id);
      expect(retrieved2).not.toBeNull();
      expect(retrieved2?.pageTitle).toBe('Page 2');

      const nonExistent = await storageService.getScanById(crypto.randomUUID());
      expect(nonExistent).toBeNull();
    });

    it('returns null when getScanById is passed invalid or empty arguments', async () => {
      expect(await storageService.getScanById('')).toBeNull();
      // @ts-expect-error testing invalid parameter
      expect(await storageService.getScanById(null)).toBeNull();
      // @ts-expect-error testing invalid parameter
      expect(await storageService.getScanById(undefined)).toBeNull();
    });

    it('dynamically backfills summaries index if summary cache is missing or cleared', async () => {
      const scan = createMockScan();
      await storageService.saveScan(scan);

      // Artificially clear only the summary cache
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.remove(SCAN_SUMMARIES_KEY);
        const check = await chrome.storage.local.get(SCAN_SUMMARIES_KEY);
        expect(check[SCAN_SUMMARIES_KEY]).toBeUndefined();
      } else {
        localStorage.removeItem(SCAN_SUMMARIES_KEY);
      }

      // getScanSummaries should detect missing summaries and backfill from scan history
      const summaries = await storageService.getScanSummaries();
      expect(summaries.length).toBe(1);
      expect(summaries[0]?.id).toBe(scan.id);
      expect(summaries[0]?.totalFindings).toBe(4);

      // Verify it was persisted back to storage
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const check = await chrome.storage.local.get(SCAN_SUMMARIES_KEY);
        expect(check[SCAN_SUMMARIES_KEY]).toBeDefined();
      } else {
        expect(localStorage.getItem(SCAN_SUMMARIES_KEY)).not.toBeNull();
      }
    });

    it('deletes an individual scan without affecting other scans or summaries', async () => {
      const scanA = createMockScan({ pageTitle: 'Scan A' });
      const scanB = createMockScan({ pageTitle: 'Scan B' });
      const scanC = createMockScan({ pageTitle: 'Scan C' });

      await storageService.saveScan(scanA);
      await storageService.saveScan(scanB);
      await storageService.saveScan(scanC);

      expect((await storageService.getScanSummaries()).length).toBe(3);

      await storageService.deleteScan(scanB.id);

      const history = await storageService.getScanHistory();
      const summaries = await storageService.getScanSummaries();

      expect(history.length).toBe(2);
      expect(summaries.length).toBe(2);
      expect(history.find((s) => s.id === scanB.id)).toBeUndefined();
      expect(summaries.find((s) => s.id === scanB.id)).toBeUndefined();
      expect(history.find((s) => s.id === scanA.id)).toBeDefined();
      expect(history.find((s) => s.id === scanC.id)).toBeDefined();
    });

    it('enforces a strict FIFO retention ceiling of 50 snapshots', async () => {
      // Save 55 scans
      const scans: ScanRecord[] = [];
      for (let i = 0; i < 55; i++) {
        scans.push(
          createMockScan({
            pageTitle: `Scan ${i}`,
            scannedAt: new Date(Date.now() + i * 1000).toISOString(),
          })
        );
      }

      for (const scan of scans) {
        await storageService.saveScan(scan);
      }

      const history = await storageService.getScanHistory();
      const summaries = await storageService.getScanSummaries();

      expect(history.length).toBe(MAX_SCAN_SNAPSHOTS);
      expect(summaries.length).toBe(MAX_SCAN_SNAPSHOTS);

      // Newest scans should be preserved at the beginning
      expect(history[0]?.id).toBe(scans[54]?.id);
      expect(summaries[0]?.id).toBe(scans[54]?.id);

      // Oldest 5 scans (0 to 4) should have been evicted
      for (let i = 0; i < 5; i++) {
        const evictedId = scans[i]?.id;
        expect(history.find((s) => s.id === evictedId)).toBeUndefined();
        expect(summaries.find((s) => s.id === evictedId)).toBeUndefined();
      }

      // Scan 5 should be the oldest retained (at index 49)
      expect(history[49]?.id).toBe(scans[5]?.id);
      expect(summaries[49]?.id).toBe(scans[5]?.id);
    });

    it('clears scan history and summaries without clearing remediation data or preferences', async () => {
      const scan = createMockScan();
      await storageService.saveScan(scan);
      await storageService.savePreferences({
        reducedMotion: true,
        theme: 'high-contrast',
        redactExcerptsInExport: true,
      });
      await storageService.updateRemediationStatus('v1:test-rule:target', 'verified', {
        verifiedAtScanId: scan.id,
      });

      // Clear scan history only
      await storageService.clearScanHistory();

      // Scans and summaries are gone
      expect(await storageService.getScanHistory()).toEqual([]);
      expect(await storageService.getScanSummaries()).toEqual([]);
      expect(await storageService.getScanById(scan.id)).toBeNull();

      // Preferences and remediation records remain intact!
      const prefs = await storageService.getPreferences();
      expect(prefs.reducedMotion).toBe(true);
      expect(prefs.theme).toBe('high-contrast');

      const remediation = await storageService.getRemediationRecords();
      expect(remediation['v1:test-rule:target']?.status).toBe('verified');
    });

    it('handles malformed JSON and corrupted records safely without crashing', async () => {
      localStorage.setItem(SCAN_HISTORY_KEY, 'invalid-json-structure{{{');
      localStorage.setItem(SCAN_SUMMARIES_KEY, 'corrupted-summary-data');

      expect(await storageService.getScanHistory()).toEqual([]);
      expect(await storageService.getScanSummaries()).toEqual([]);

      // Non-array JSON
      localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify({ notAnArray: true }));
      expect(await storageService.getScanHistory()).toEqual([]);

      // Array with invalid items
      localStorage.setItem(
        SCAN_HISTORY_KEY,
        JSON.stringify([{ missingFields: true }, { id: 'not-a-uuid', schemaVersion: 99 }])
      );
      expect(await storageService.getScanHistory()).toEqual([]);
    });

    it('serializes concurrent save operations preventing lost updates', async () => {
      const scan1 = createMockScan({ pageTitle: 'Concurrent 1' });
      const scan2 = createMockScan({ pageTitle: 'Concurrent 2' });
      const scan3 = createMockScan({ pageTitle: 'Concurrent 3' });

      // Run 3 saves simultaneously without awaiting each sequentially
      await Promise.all([
        storageService.saveScan(scan1),
        storageService.saveScan(scan2),
        storageService.saveScan(scan3),
      ]);

      const history = await storageService.getScanHistory();
      const summaries = await storageService.getScanSummaries();

      expect(history.length).toBe(3);
      expect(summaries.length).toBe(3);
      expect(history.map((s) => s.id).sort()).toEqual(
        [scan1.id, scan2.id, scan3.id].sort()
      );
      expect(summaries.map((s) => s.id).sort()).toEqual(
        [scan1.id, scan2.id, scan3.id].sort()
      );
    });

    it('propagates storage write errors when storage backend throws', async () => {
      let spy: ReturnType<typeof vi.spyOn>;
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        spy = vi
          .spyOn(chrome.storage.local, 'set')
          .mockRejectedValue(new Error('QuotaExceededError: storage full'));
      } else {
        spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
          throw new Error('QuotaExceededError: storage full');
        });
      }

      const scan = createMockScan();
      await expect(storageService.saveScan(scan)).rejects.toThrow('QuotaExceededError');

      spy.mockRestore();
    });
  });
});
