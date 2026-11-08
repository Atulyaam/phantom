import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ScanRecord } from '@/domain/scan';
import {
  sanitizeFilenamePart,
  generateReportFilename,
  REPORT_MIME_TYPES,
  downloadReportBlob,
} from '@/features/reports/download-report';

const createMockScan = (overrides: Partial<ScanRecord> = {}): ScanRecord => ({
  id: '880e8400-e29b-41d4-a716-446655440000',
  schemaVersion: 1,
  tabUrl: 'https://haunted-manor.example.com:8443/ballroom?page=1',
  pageTitle: 'Haunted Ballroom',
  hostname: 'haunted-manor.example.com',
  scannedAt: '2026-10-31T20:00:00.000Z',
  completedAt: '2026-10-31T20:00:05.000Z',
  axeVersion: '4.14.0',
  extensionVersion: '0.1.0',
  browserName: 'chrome',
  status: 'completed',
  findings: [],
  incompleteChecksCount: 0,
  passesCount: 10,
  inapplicableCount: 5,
  ...overrides,
});

describe('Phase 8 Workstream 4: Zero-Permission Report Download Engine', () => {
  describe('1. sanitizeFilenamePart', () => {
    it('cleans standard hostnames into hyphen-delimited lowercase strings', () => {
      expect(sanitizeFilenamePart('example.com')).toBe('example-com');
      expect(sanitizeFilenamePart('haunted-manor.internal.net')).toBe(
        'haunted-manor-internal-net'
      );
    });

    it('strips protocols, paths, query strings, and ports', () => {
      expect(sanitizeFilenamePart('https://sub.domain.com:8080/path?token=123')).toBe(
        'sub-domain-com'
      );
    });

    it('strips user credentials and authentication tokens from URLs (DEF-841)', () => {
      expect(
        sanitizeFilenamePart('https://admin:supersecret@haunted-manor.com/ballroom')
      ).toBe('haunted-manor-com');
      expect(sanitizeFilenamePart('https://secrettoken@specter.internal:8000/api')).toBe(
        'specter-internal'
      );
    });

    it('strips query strings and fragments from relative or standalone strings (DEF-841)', () => {
      expect(sanitizeFilenamePart('?token=supersecret123')).toBe('unknown');
      expect(sanitizeFilenamePart('#access_token=xyz')).toBe('unknown');
      expect(sanitizeFilenamePart('page.html?query=test#section')).toBe('page-html');
    });

    it('prevents path traversal and eliminates directory separators', () => {
      expect(sanitizeFilenamePart('../../etc/passwd')).toBe('etc-passwd');
      expect(sanitizeFilenamePart('..\\..\\windows\\system32')).toBe('windows-system32');
    });

    it('truncates excessively long hostnames to 40 characters', () => {
      const veryLong = 'a'.repeat(60) + '.example.com';
      const sanitized = sanitizeFilenamePart(veryLong);
      expect(sanitized.length).toBeLessThanOrEqual(40);
    });

    it('falls back to "unknown" for empty or non-string inputs', () => {
      expect(sanitizeFilenamePart('')).toBe('unknown');
      expect(sanitizeFilenamePart('   ')).toBe('unknown');
    });
  });

  describe('2. generateReportFilename', () => {
    it('generates predictable, formatted filenames for HTML and JSON', () => {
      const scan = createMockScan();
      const htmlName = generateReportFilename(scan, 'html', '2026-11-07T12:00:00.000Z');
      const jsonName = generateReportFilename(scan, 'json', '2026-11-07T12:00:00.000Z');

      expect(htmlName).toBe('phantom-audit-haunted-manor-example-com-2026-11-07.html');
      expect(jsonName).toBe('phantom-audit-haunted-manor-example-com-2026-11-07.json');
    });

    it('extracts date from scan.scannedAt if exportedAt is not provided', () => {
      const scan = createMockScan({ scannedAt: '2026-10-31T20:00:00.000Z' });
      const name = generateReportFilename(scan, 'html');

      expect(name).toBe('phantom-audit-haunted-manor-example-com-2026-10-31.html');
    });

    it('falls back to "export" for malformed dates', () => {
      const scan = createMockScan({ scannedAt: 'invalid-date' });
      const name = generateReportFilename(scan, 'json');

      expect(name).toBe('phantom-audit-haunted-manor-example-com-export.json');
    });
  });

  describe('3. REPORT_MIME_TYPES', () => {
    it('maps html and json to standard UTF-8 MIME types', () => {
      expect(REPORT_MIME_TYPES.html).toBe('text/html;charset=utf-8');
      expect(REPORT_MIME_TYPES.json).toBe('application/json;charset=utf-8');
    });
  });

  describe('4. downloadReportBlob (DOM & Object URL Lifecycle)', () => {
    let originalCreateObjectURL: typeof URL.createObjectURL;
    let originalRevokeObjectURL: typeof URL.revokeObjectURL;
    let createdUrls: string[] = [];
    let revokedUrls: string[] = [];

    beforeEach(() => {
      vi.useFakeTimers();
      createdUrls = [];
      revokedUrls = [];

      originalCreateObjectURL = URL.createObjectURL;
      originalRevokeObjectURL = URL.revokeObjectURL;

      URL.createObjectURL = vi.fn((_blob: Blob) => {
        const fakeUrl = `blob:phantom-audit/${Math.random().toString(36).slice(2)}`;
        createdUrls.push(fakeUrl);
        return fakeUrl;
      });

      URL.revokeObjectURL = vi.fn((url: string) => {
        revokedUrls.push(url);
      });
    });

    afterEach(() => {
      vi.useRealTimers();
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });

    it('creates Blob, dispatches anchor click, and revokes Object URL', () => {
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => {});

      downloadReportBlob('<!DOCTYPE html><html></html>', 'test-report.html', 'html');

      // Verify Object URL created
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(createdUrls.length).toBe(1);
      const generatedUrl = createdUrls[0];

      // Verify anchor click dispatched
      expect(clickSpy).toHaveBeenCalledTimes(1);

      // Verify anchor is not left lingering in DOM
      expect(document.querySelector('a[download="test-report.html"]')).toBeNull();

      // Advance timers to trigger deferred revocation
      vi.advanceTimersByTime(1100);

      // Verify Object URL revoked
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(generatedUrl);

      clickSpy.mockRestore();
    });

    it('cleans up object URL and throws typed error if dispatch fails', () => {
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => {
          throw new Error('Browser blocked programmatic click');
        });

      expect(() => {
        downloadReportBlob('{"test": true}', 'test-report.json', 'json');
      }).toThrow(
        'Failed to initiate report download: Browser blocked programmatic click'
      );

      // Immediate revocation should be attempted (DEF-842)
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);

      // Advance timers to verify delayed revocation is NOT redundantly scheduled
      vi.advanceTimersByTime(2000);
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);

      clickSpy.mockRestore();
    });

    it('handles rapid sequential downloads cleanly without object URL leaks', () => {
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => {});

      // Dispatch 3 sequential downloads
      downloadReportBlob('content-1', 'report-1.html', 'html');
      downloadReportBlob('content-2', 'report-2.html', 'html');
      downloadReportBlob('content-3', 'report-3.json', 'json');

      expect(createdUrls.length).toBe(3);
      expect(clickSpy).toHaveBeenCalledTimes(3);

      // Advance timers
      vi.advanceTimersByTime(1100);

      // All 3 should be cleanly revoked
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3);
      expect(revokedUrls).toEqual(createdUrls);

      clickSpy.mockRestore();
    });
  });
});
