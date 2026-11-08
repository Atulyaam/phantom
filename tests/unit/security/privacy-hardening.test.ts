import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  sanitizeLogMessage,
  logSafeWarn,
  logSafeWarning,
  logSafeError,
  logSafeInfo,
  logSafeDebug,
  isSensitiveKey,
  MAX_LOG_LENGTH,
} from '@/lib/logger';
import {
  storageService,
  SCAN_HISTORY_KEY,
  SCAN_SUMMARIES_KEY,
  PREFERENCES_KEY,
  REMEDIATION_KEY,
  MAX_SCAN_SNAPSHOTS,
  RemediationQuotaExceededError,
} from '@/lib/storage';
import { ScannerServiceError } from '@/features/scanner/scanner-service';
import type { ScanRecord } from '@/domain/scan';
import type { FindingRecord } from '@/domain/finding';
import type { StoredRemediationRecord } from '@/domain/remediation';

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
        htmlExcerpt: '<button>Submit</button>',
        failureSummary: 'Fix button element',
      },
    ],
    firstSeenAt: new Date().toISOString(),
    reviewed: false,
  };
}

function createMockScan(index: number, overrides?: Partial<ScanRecord>): ScanRecord {
  const id = crypto.randomUUID();
  return {
    id,
    schemaVersion: 1,
    tabUrl: `https://example.com/page-${index}`,
    pageTitle: `Page ${index}`,
    hostname: 'example.com',
    scannedAt: new Date(Date.now() + index * 1000).toISOString(),
    axeVersion: '4.14.0',
    extensionVersion: '0.1.0',
    browserName: 'chrome',
    status: 'completed',
    findings: [
      createMockFinding('button-name', 'critical'),
      createMockFinding('image-alt', 'serious'),
    ],
    incompleteChecksCount: 1,
    passesCount: 10,
    inapplicableCount: 3,
    ...overrides,
  };
}

describe('Phase 9 Workstream 2: Privacy Hardening, Logger Safety & Storage Integrity', () => {
  describe('PRIV-001 — Privacy-Safe Logger & Error Sanitization', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;
    let infoSpy: ReturnType<typeof vi.spyOn>;
    let debugSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('redacts credentials in URLs (user:pass@host)', () => {
      const input =
        'Connection failure at https://admin:superSecret123@haunted.internal/dashboard';
      const sanitized = sanitizeLogMessage(input);

      expect(sanitized).toContain('https://[REDACTED]@haunted.internal/dashboard');
      expect(sanitized).not.toContain('admin');
      expect(sanitized).not.toContain('superSecret123');
    });

    it('redacts token-bearing query parameters in URLs and query strings', () => {
      const input =
        'API error fetching https://api.haunted.com/v1/scan?token=secret123&apiKey=abcKey999&filter=active';
      const sanitized = sanitizeLogMessage(input);

      expect(sanitized).toContain('token=[REDACTED]');
      expect(sanitized).toContain('apiKey=[REDACTED]');
      expect(sanitized).toContain('filter=active');
      expect(sanitized).not.toContain('secret123');
      expect(sanitized).not.toContain('abcKey999');
    });

    it('redacts standalone query strings (?token=secret123&apiKey=abc)', () => {
      const input = 'Navigation params detected: ?token=secret123&apiKey=abc';
      const sanitized = sanitizeLogMessage(input);

      expect(sanitized).toContain('?token=[REDACTED]');
      expect(sanitized).toContain('&apiKey=[REDACTED]');
      expect(sanitized).not.toContain('secret123');
      expect(sanitized).not.toContain('abc');
    });

    it('sanitizes sensitive hash fragments and OAuth tokens (#access_token=xyz)', () => {
      const input =
        'OAuth redirect: https://haunted.com/callback#access_token=xyzSecretToken&state=oauth123';
      const sanitized = sanitizeLogMessage(input);

      expect(sanitized).toContain('#access_token=[REDACTED]');
      expect(sanitized).not.toContain('xyzSecretToken');
    });

    it('sanitizes Error objects containing credentials and tokens, outputting [REDACTED]', () => {
      const err = new Error('Failed to load https://user:pass@secret.com?token=1234');
      const sanitized = sanitizeLogMessage(err);

      expect(sanitized).toContain('[REDACTED]');
      expect(sanitized).not.toContain('user:pass');
      expect(sanitized).not.toContain('1234');
      expect(sanitized).toContain('secret.com');
    });

    it('scrubs credentials and token query params from multi-line error stack traces', () => {
      const rawStack = [
        'Error: Injection failed on https://admin:pass456@target.com/page?token=tokenABC',
        '    at executeScript (chrome-extension://phantom-audit/background.js:120:15)',
        '    at async scanTab (https://target.com/scripts/bundle.js?apiKey=secretKey789:45:10)',
      ].join('\n');

      const sanitized = sanitizeLogMessage(rawStack);

      expect(sanitized).not.toContain('admin:pass456');
      expect(sanitized).not.toContain('tokenABC');
      expect(sanitized).not.toContain('secretKey789');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('never logs raw Error objects or stack traces to console.warn', () => {
      const sensitiveErr = new Error(
        'Database locked on https://user:pass@haunted.com?token=secret123'
      );
      logSafeWarn('Storage', sensitiveErr);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const callArg = warnSpy.mock.calls[0][0];
      // Arg must be a single string, NOT an Error instance
      expect(typeof callArg).toBe('string');
      expect(callArg).toContain('[PhantomAudit:Storage]');
      expect(callArg).toContain('[REDACTED]');
      expect(callArg).not.toContain('user:pass');
      expect(callArg).not.toContain('secret123');
      expect(warnSpy.mock.calls[0].length).toBe(1);
    });

    it('supports logSafeWarning alias identically to logSafeWarn', () => {
      logSafeWarning('AliasTest', 'Warning notice');
      expect(warnSpy).toHaveBeenCalledWith('[PhantomAudit:AliasTest] Warning notice');
    });

    it('never logs raw Error objects or stack traces to console.error', () => {
      const sensitiveErr = new Error('Export serialization failure: token=abcSecretKey');
      logSafeError('Export', sensitiveErr);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const callArg = errorSpy.mock.calls[0][0];
      expect(typeof callArg).toBe('string');
      expect(callArg).toContain('[PhantomAudit:Export]');
      expect(callArg).toContain('token=[REDACTED]');
      expect(callArg).not.toContain('abcSecretKey');
      expect(errorSpy.mock.calls[0].length).toBe(1);
    });

    it('sanitizes objects with nested sensitive properties without logging raw structures', () => {
      const sensitiveObj = {
        message: 'Request failed',
        password: 'myPlainTextPassword',
        nested: {
          token: 'nestedSecretToken',
          auth: 'bearerSecret',
        },
      };

      const sanitized = sanitizeLogMessage(sensitiveObj);

      expect(sanitized).not.toContain('myPlainTextPassword');
      expect(sanitized).not.toContain('nestedSecretToken');
      expect(sanitized).not.toContain('bearerSecret');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('preserves diagnosable safe error codes (TAB_NOT_FOUND, QUOTA_EXCEEDED)', () => {
      const scannerErr = new ScannerServiceError('Tab #42 not found', 'TAB_NOT_FOUND');
      const sanitizedScanner = sanitizeLogMessage(scannerErr);

      expect(sanitizedScanner).toContain('[TAB_NOT_FOUND]');
      expect(sanitizedScanner).toContain('Tab #42 not found');

      const quotaErr = new RemediationQuotaExceededError('Capacity exceeded');
      const sanitizedQuota = sanitizeLogMessage(quotaErr);

      expect(sanitizedQuota).toContain('[RemediationQuotaExceededError]');
      expect(sanitizedQuota).toContain('Capacity exceeded');
    });

    it('redacts Bearer and Basic authorization header values', () => {
      const bearerInput = 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.secretPayload.sig';
      const basicInput = 'Authorization: Basic dXNlcjpwYXNzd29yZDEyMw==';

      expect(sanitizeLogMessage(bearerInput)).toBe('Authorization: Bearer [REDACTED]');
      expect(sanitizeLogMessage(basicInput)).toBe('Authorization: Basic [REDACTED]');
    });

    it('redacts DOM excerpts containing password values and sensitive data attributes', () => {
      const domInput =
        '<input type="password" value="secretPassword123" data-token="tok_abc">';
      const sanitized = sanitizeLogMessage(domInput);

      expect(sanitized).toContain('value="[PASSWORD_REDACTED]"');
      expect(sanitized).toContain('data-token="[REDACTED]"');
      expect(sanitized).not.toContain('secretPassword123');
      expect(sanitized).not.toContain('tok_abc');
    });

    it('suppresses debug-level logs completely in production mode', () => {
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        logSafeDebug('Diagnostics', 'Verbose trace details');
        logSafeInfo('Diagnostics', 'Informational message');

        expect(debugSpy).not.toHaveBeenCalled();
        expect(infoSpy).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });

    it('accurately identifies sensitive property keys using isSensitiveKey', () => {
      expect(isSensitiveKey('token')).toBe(true);
      expect(isSensitiveKey('access_token')).toBe(true);
      expect(isSensitiveKey('api_key')).toBe(true);
      expect(isSensitiveKey('password')).toBe(true);
      expect(isSensitiveKey('secret')).toBe(true);
      expect(isSensitiveKey('pwd')).toBe(true);
      expect(isSensitiveKey('credential')).toBe(true);
      expect(isSensitiveKey('cookie')).toBe(true);
      expect(isSensitiveKey('session')).toBe(true);
      expect(isSensitiveKey('page')).toBe(false);
      expect(isSensitiveKey('view')).toBe(false);
      expect(isSensitiveKey('title')).toBe(false);
      expect(isSensitiveKey('status')).toBe(false);
    });

    describe('Adversarial Logger Inputs (Independent Audit Verification)', () => {
      it('redacts single and double percent-encoded sensitive query tokens (%74%6f%6b%65%6e)', () => {
        const singleEncoded =
          'API error at https://api.haunted.com/v1/scan?%74%6f%6b%65%6e=secret123&page=1';
        const doubleEncoded =
          'API error at https://api.haunted.com/v1/scan?%2574%256f%256b%2565%256e=secretDouble&page=1';

        const sanitizedSingle = sanitizeLogMessage(singleEncoded);
        const sanitizedDouble = sanitizeLogMessage(doubleEncoded);

        expect(sanitizedSingle).toContain('%74%6f%6b%65%6e=[REDACTED]');
        expect(sanitizedSingle).toContain('page=1');
        expect(sanitizedSingle).not.toContain('secret123');

        expect(sanitizedDouble).toContain('%2574%256f%256b%2565%256e=[REDACTED]');
        expect(sanitizedDouble).toContain('page=1');
        expect(sanitizedDouble).not.toContain('secretDouble');
      });

      it('redacts mixed-case and uppercase sensitive parameter names (ToKeN, API_KEY, PassWord)', () => {
        const mixed =
          'https://example.com/callback?ToKeN=secretTok&API_KEY=keyABC&PassWord=passXYZ&safeField=keepMe';
        const sanitized = sanitizeLogMessage(mixed);

        expect(sanitized).toContain('ToKeN=[REDACTED]');
        expect(sanitized).toContain('API_KEY=[REDACTED]');
        expect(sanitized).toContain('PassWord=[REDACTED]');
        expect(sanitized).toContain('safeField=keepMe');
        expect(sanitized).not.toContain('secretTok');
        expect(sanitized).not.toContain('keyABC');
        expect(sanitized).not.toContain('passXYZ');
      });

      it('redacts credentials and tokens across multiple URLs in a single log message', () => {
        const multi = [
          'Failed primary: https://admin:pass1@primary.internal/scan?token=tok1',
          'and fallback: wss://user2:pass2@stream.internal/events?api_key=tok2',
          'and blob: blob:https://user3:pass3@blob.internal/uuid?secret=tok3',
        ].join(' ');

        const sanitized = sanitizeLogMessage(multi);

        expect(sanitized).toContain(
          'https://[REDACTED]@primary.internal/scan?token=[REDACTED]'
        );
        expect(sanitized).toContain(
          'wss://[REDACTED]@stream.internal/events?api_key=[REDACTED]'
        );
        expect(sanitized).toContain(
          'blob:https://[REDACTED]@blob.internal/uuid?secret=[REDACTED]'
        );
        expect(sanitized).not.toContain('pass1');
        expect(sanitized).not.toContain('pass2');
        expect(sanitized).not.toContain('pass3');
        expect(sanitized).not.toContain('tok1');
        expect(sanitized).not.toContain('tok2');
        expect(sanitized).not.toContain('tok3');
      });

      it('handles malformed and edge-case URLs safely without leaking credentials', () => {
        const malformed = [
          'https://admin:superSecret@/',
          'https://user:pass@:8080/path',
          'http://admin:pwd@',
          'https://::1',
        ];

        for (const url of malformed) {
          const sanitized = sanitizeLogMessage(`Failed connection to ${url}`);
          expect(sanitized).not.toContain('superSecret');
          expect(sanitized).not.toContain('user:pass');
          expect(sanitized).not.toContain('admin:pwd');
        }
      });

      it('bounds excessively long log strings to MAX_LOG_LENGTH and appends truncation indicator', () => {
        const huge = 'A'.repeat(5000);
        const sanitized = sanitizeLogMessage(`Huge payload: ${huge}`);

        expect(sanitized.length).toBeLessThanOrEqual(MAX_LOG_LENGTH + 100);
        expect(sanitized).toContain('[TRUNCATED]');
      });

      it('safely handles circular object references without throwing or hanging', () => {
        interface CircularObj {
          name: string;
          token: string;
          self?: CircularObj;
          nested?: { parent?: CircularObj };
        }

        const circular: CircularObj = {
          name: 'Haunted Mansion Node',
          token: 'superSecretCircularToken',
        };
        circular.self = circular;
        circular.nested = { parent: circular };

        const sanitized = sanitizeLogMessage(circular);

        expect(sanitized).not.toContain('superSecretCircularToken');
        expect(sanitized).toContain('[REDACTED]');
        expect(sanitized).toContain('[CIRCULAR_REFERENCE]');
      });

      it('neutralizes newline / CRLF injection and Unicode line separators to prevent log forging (CWE-117)', () => {
        const attackPayload =
          'Error loading data\r\n[PhantomAudit:Security] ALL CLEAR: CONFORMANCE CERTIFIED\n[PhantomAudit:Admin] GRANT_ALL';
        const sanitized = sanitizeLogMessage(attackPayload);

        // Must not contain unescaped CRLF or newlines
        expect(sanitized).not.toContain('\r');
        expect(sanitized).not.toContain('\n');
        expect(sanitized).not.toContain('\u2028');
        expect(sanitized).not.toContain('\u2029');

        // Verify actual console argument is a single physical line
        logSafeWarn('TestInjection', attackPayload);
        const loggedArg = warnSpy.mock.calls[warnSpy.mock.calls.length - 1][0] as string;
        expect(loggedArg).not.toMatch(/[\r\n]/);
        expect(loggedArg.startsWith('[PhantomAudit:TestInjection]')).toBe(true);
      });

      it('strips zero-width characters in parameter names before sensitivity checks', () => {
        // Zero-width space (\u200B) inserted inside "token"
        const evasionKey = 't\u200Boken';
        expect(isSensitiveKey(evasionKey)).toBe(true);

        const url = `https://example.com/api?t\u200Boken=evasionValue&status=ok`;
        const sanitized = sanitizeLogMessage(url);
        expect(sanitized).toContain('=[REDACTED]');
        expect(sanitized).not.toContain('evasionValue');
      });
    });
  });

  describe('Storage Integrity, Deletion Verification & Erasure Guarantee', () => {
    beforeEach(async () => {
      await storageService.clearAllData();
    });

    it('enforces a strict FIFO ceiling of 50 snapshots on both history and summaries when saving 55 items', async () => {
      const scans: ScanRecord[] = [];
      for (let i = 1; i <= 55; i++) {
        scans.push(createMockScan(i));
      }

      // Save 55 scans sequentially
      for (const scan of scans) {
        await storageService.saveScan(scan);
      }

      const storedHistory = await storageService.getScanHistory();
      const storedSummaries = await storageService.getScanSummaries();

      // Strict FIFO ceiling check
      expect(storedHistory.length).toBe(MAX_SCAN_SNAPSHOTS);
      expect(storedSummaries.length).toBe(MAX_SCAN_SNAPSHOTS);

      // Verify the 5 oldest scans (1..5) were evicted
      for (let i = 1; i <= 5; i++) {
        expect(storedHistory.some((s) => s.id === scans[i - 1].id)).toBe(false);
        expect(storedSummaries.some((s) => s.id === scans[i - 1].id)).toBe(false);
      }

      // Verify the 50 newest scans (6..55) remain
      for (let i = 6; i <= 55; i++) {
        expect(storedHistory.some((s) => s.id === scans[i - 1].id)).toBe(true);
        expect(storedSummaries.some((s) => s.id === scans[i - 1].id)).toBe(true);
      }

      // Verify secondary key consistency (history IDs exactly match summary IDs in order)
      const historyIds = storedHistory.map((s) => s.id);
      const summaryIds = storedSummaries.map((s) => s.id);
      expect(summaryIds).toEqual(historyIds);
    });

    it('deleting a single snapshot permanently purges it from both history and summaries', async () => {
      const scan1 = createMockScan(1);
      const scan2 = createMockScan(2);
      const scan3 = createMockScan(3);

      await storageService.saveScan(scan1);
      await storageService.saveScan(scan2);
      await storageService.saveScan(scan3);

      expect(await storageService.hasScan(scan2.id)).toBe(true);

      // Delete snapshot 2
      await storageService.deleteScan(scan2.id);

      // Verify deletion from primary snapshot store
      const retrieved = await storageService.getScanById(scan2.id);
      expect(retrieved).toBeNull();
      expect(await storageService.hasScan(scan2.id)).toBe(false);

      // Verify deletion from history array
      const history = await storageService.getScanHistory();
      expect(history.length).toBe(2);
      expect(history.some((s) => s.id === scan2.id)).toBe(false);

      // Verify deletion from summary index
      const summaries = await storageService.getScanSummaries();
      expect(summaries.length).toBe(2);
      expect(summaries.some((s) => s.id === scan2.id)).toBe(false);
    });

    it('clearScanHistory (and clearAllScans alias) purges snapshots and summaries while preserving preferences and remediation data', async () => {
      // 1. Setup preferences
      await storageService.savePreferences({
        reducedMotion: true,
        theme: 'high-contrast',
        redactExcerptsInExport: true,
      });

      // 2. Setup remediation record
      const remediationRecord: StoredRemediationRecord = {
        fingerprint: 'v1:button-name:btn-test',
        status: 'verified',
        updatedAt: new Date().toISOString(),
        notes: 'Fixed accessible name',
      };
      await storageService.saveRemediationRecord(remediationRecord);

      // 3. Setup scan history
      await storageService.saveScan(createMockScan(1));
      await storageService.saveScan(createMockScan(2));

      // 4. Purge scan history via clearAllScans alias
      await storageService.clearAllScans();

      // Scan history and summaries must be completely empty
      const history = await storageService.getScanHistory();
      const summaries = await storageService.getScanSummaries();
      expect(history).toEqual([]);
      expect(summaries).toEqual([]);

      // Preferences and remediation must remain untouched
      const prefs = await storageService.getPreferences();
      expect(prefs.reducedMotion).toBe(true);
      expect(prefs.theme).toBe('high-contrast');
      expect(prefs.redactExcerptsInExport).toBe(true);

      const remediation = await storageService.getRemediationRecord(
        'v1:button-name:btn-test'
      );
      expect(remediation).not.toBeNull();
      expect(remediation?.status).toBe('verified');
      expect(remediation?.notes).toBe('Fixed accessible name');
    });

    it('clearAllData completely purges all 4 isolated storage keys', async () => {
      await storageService.savePreferences({
        reducedMotion: true,
        theme: 'high-contrast',
        redactExcerptsInExport: true,
      });

      await storageService.saveRemediationRecord({
        fingerprint: 'v1:image-alt:img-1',
        status: 'attempted',
        updatedAt: new Date().toISOString(),
      });

      await storageService.saveScan(createMockScan(1));

      // Execute master purge
      await storageService.clearAllData();

      expect(localStorage.getItem(SCAN_HISTORY_KEY)).toBeNull();
      expect(localStorage.getItem(SCAN_SUMMARIES_KEY)).toBeNull();
      expect(localStorage.getItem(PREFERENCES_KEY)).toBeNull();
      expect(localStorage.getItem(REMEDIATION_KEY)).toBeNull();

      expect(await storageService.getScanHistory()).toEqual([]);
      expect(await storageService.getScanSummaries()).toEqual([]);
      expect(await storageService.getRemediationRecords()).toEqual({});
    });

    it('rolls back cleanly on storage write failure without leaving half-saved corrupted state', async () => {
      const scan1 = createMockScan(1);
      await storageService.saveScan(scan1);

      const scan2 = createMockScan(2);

      // 1. Verify extension environment failure handling
      const chromeSetSpy = vi
        .spyOn(chrome.storage.local, 'set')
        .mockRejectedValueOnce(
          new Error('QuotaExceededError: chrome storage capacity reached')
        );

      await expect(storageService.saveScan(scan2)).rejects.toThrow('QuotaExceededError');

      // Verify prior state remains intact
      let history = await storageService.getScanHistory();
      let summaries = await storageService.getScanSummaries();
      expect(history.length).toBe(1);
      expect(history[0].id).toBe(scan1.id);
      expect(summaries.length).toBe(1);
      expect(summaries[0].id).toBe(scan1.id);

      chromeSetSpy.mockRestore();

      // 2. Verify fallback non-extension environment rollback handling
      const envSpy = vi
        .spyOn(
          storageService as unknown as { isExtensionEnv: () => boolean },
          'isExtensionEnv'
        )
        .mockReturnValue(false);
      localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify([scan1]));
      localStorage.setItem(SCAN_SUMMARIES_KEY, JSON.stringify([scan1]));

      const originalSetItem = localStorage.setItem.bind(localStorage);
      const setItemSpy = vi
        .spyOn(Storage.prototype, 'setItem')
        .mockImplementation((key, val) => {
          if (key === SCAN_SUMMARIES_KEY) {
            throw new Error('QuotaExceededError: localStorage capacity reached');
          }
          return originalSetItem(key, val);
        });

      try {
        await expect(storageService.saveScan(scan2)).rejects.toThrow(
          'QuotaExceededError'
        );

        // Rollback check: localStorage must still contain only scan1
        history = await storageService.getScanHistory();
        summaries = await storageService.getScanSummaries();

        expect(history.length).toBe(1);
        expect(history[0].id).toBe(scan1.id);
        expect(summaries.length).toBe(1);
        expect(summaries[0].id).toBe(scan1.id);
      } finally {
        setItemSpy.mockRestore();
        envSpy.mockRestore();
      }
    });

    it('serializes concurrent write operations under writeLock maintaining integrity', async () => {
      const scans = [
        createMockScan(1),
        createMockScan(2),
        createMockScan(3),
        createMockScan(4),
        createMockScan(5),
      ];

      // Fire 5 concurrent writes simultaneously
      await Promise.all(scans.map((scan) => storageService.saveScan(scan)));

      const history = await storageService.getScanHistory();
      const summaries = await storageService.getScanSummaries();

      expect(history.length).toBe(5);
      expect(summaries.length).toBe(5);

      // Verify all 5 scan IDs exist in both history and summaries
      for (const scan of scans) {
        expect(history.some((s) => s.id === scan.id)).toBe(true);
        expect(summaries.some((s) => s.id === scan.id)).toBe(true);
      }
    });

    it('stale in-memory reload simulation confirms deleted snapshot does not reappear', async () => {
      const targetScan = createMockScan(100);
      await storageService.saveScan(targetScan);

      // In-memory application state holds reference to the scan
      let inMemoryActiveRecord: ScanRecord | null = targetScan;

      // User triggers deletion in storage
      await storageService.deleteScan(targetScan.id);

      // Application UI state receives deletion notification and resets in-memory reference
      if (inMemoryActiveRecord?.id === targetScan.id) {
        inMemoryActiveRecord = null;
      }

      // Subsequent reload from storage confirms snapshot is gone
      const reloadedRecord = await storageService.getScanById(targetScan.id);
      const reloadedSummaries = await storageService.getScanSummaries();

      expect(inMemoryActiveRecord).toBeNull();
      expect(reloadedRecord).toBeNull();
      expect(reloadedSummaries.some((s) => s.id === targetScan.id)).toBe(false);
    });

    describe('Stale Application State & Storage Edge-Case Resilience', () => {
      it('purging history resets active scan and prevents review toggles from resurrecting purged records', async () => {
        const liveScan = createMockScan(1);
        await storageService.saveScan(liveScan);

        // Simulated React dashboard state holding liveScan
        let activeScanRecord: ScanRecord | null = liveScan;
        const onHistoryCleared = () => {
          activeScanRecord = null;
        };

        // User clears history
        await storageService.clearScanHistory();
        onHistoryCleared();

        // Attempting to toggle reviewed status when activeScanRecord is null must be a no-op
        const toggleReviewed = async () => {
          if (!activeScanRecord) return;
          // If activeScanRecord were not reset, this would persist the resurrected record
          await storageService.saveScan(activeScanRecord);
        };

        await toggleReviewed();

        // Verify storage remains completely empty
        expect(await storageService.getScanHistory()).toEqual([]);
        expect(await storageService.getScanSummaries()).toEqual([]);
        expect(await storageService.hasScan(liveScan.id)).toBe(false);
      });

      it('safely handles storage read failures and corrupted storage payloads without crashing', async () => {
        // Corrupt storage keys with invalid JSON
        localStorage.setItem(SCAN_HISTORY_KEY, 'INVALID_JSON_CORRUPT_{{{');
        localStorage.setItem(SCAN_SUMMARIES_KEY, 'CORRUPTED_SUMMARIES_[');
        localStorage.setItem(REMEDIATION_KEY, 'BAD_REMEDIATION_JSON');

        // Storage service must recover gracefully with safe fallback defaults
        const history = await storageService.getScanHistory();
        const summaries = await storageService.getScanSummaries();
        const remediation = await storageService.getRemediationRecords();

        expect(history).toEqual([]);
        expect(summaries).toEqual([]);
        expect(remediation).toEqual({});
      });

      it('concurrent save and delete operations maintain deterministic index consistency without deadlocking', async () => {
        const scanA = createMockScan(1);
        const scanB = createMockScan(2);
        await storageService.saveScan(scanA);

        // Fire concurrent delete for scanA and save for scanB
        await Promise.all([
          storageService.deleteScan(scanA.id),
          storageService.saveScan(scanB),
        ]);

        const history = await storageService.getScanHistory();
        const summaries = await storageService.getScanSummaries();

        // scanA must be gone; scanB must be present
        expect(history.some((s) => s.id === scanA.id)).toBe(false);
        expect(summaries.some((s) => s.id === scanA.id)).toBe(false);
        expect(history.some((s) => s.id === scanB.id)).toBe(true);
        expect(summaries.some((s) => s.id === scanB.id)).toBe(true);
        expect(history.length).toBe(1);
        expect(summaries.length).toBe(1);
      });

      it('concurrent purge and save operations resolve deterministically with synchronized primary and secondary indexes', async () => {
        const scan = createMockScan(99);

        // Fire concurrent purge and save
        await Promise.all([
          storageService.clearScanHistory(),
          storageService.saveScan(scan),
        ]);

        const history = await storageService.getScanHistory();
        const summaries = await storageService.getScanSummaries();

        // Both stores must have the exact same length (either both 0 or both 1)
        expect(history.length).toBe(summaries.length);
        if (history.length === 1) {
          expect(history[0].id).toBe(scan.id);
          expect(summaries[0].id).toBe(scan.id);
        } else {
          expect(history).toEqual([]);
          expect(summaries).toEqual([]);
        }
      });
    });
  });
});
