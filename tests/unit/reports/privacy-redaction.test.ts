import { describe, it, expect } from 'vitest';
import type { ScanRecord } from '@/domain/scan';
import type { FindingRecord } from '@/domain/finding';
import type { RemediationStoragePayload } from '@/domain/remediation';
import type { ExportReportOptions, ReportExportPayload } from '@/domain/report';
import {
  redactUrl,
  sanitizeHtmlExcerpt,
  sanitizeRemediationNotes,
  redactReportPayload,
  safeRedactReportPayload,
  prepareReportExport,
  exportReportToJson,
  RedactionValidationError,
} from '@/features/reports/report-redactor';
import {
  buildReportPayload,
  serializeReportToJson,
} from '@/features/reports/json-serializer';
import { ReportExportPayloadSchema } from '@/lib/validation/schemas';

// Mock test fixture generators
const createFinding = (overrides: Partial<FindingRecord> = {}): FindingRecord => ({
  fingerprint: 'fp-button-101',
  ruleId: 'button-name',
  impact: 'critical',
  description: 'Button in the Grand Ballroom has no discernible accessible name',
  help: 'Buttons must have discernible text',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.14/button-name',
  wcagTags: ['wcag2a', 'wcag412'],
  roomId: 'name-chamber',
  affectedNodeCount: 1,
  nodes: [
    {
      target: ['button.submit-btn'],
      htmlExcerpt:
        '<button class="submit-btn" value="my-super-secret-key" data-token="secret-token-123">Submit</button>',
      failureSummary: 'Fix element name: aria-label missing',
    },
  ],
  firstSeenAt: '2026-10-31T20:00:00.000Z',
  reviewed: false,
  ...overrides,
});

const createScan = (overrides: Partial<ScanRecord> = {}): ScanRecord => ({
  id: '880e8400-e29b-41d4-a716-446655440000',
  schemaVersion: 1,
  tabUrl:
    'https://admin:pass123@haunted.example.com:8443/portal/rooms?room=ballroom&token=sensitive_token_abc&page=2#section?auth=secret_auth',
  pageTitle: 'Haunted Mansion Portal',
  hostname: 'haunted.example.com',
  scannedAt: '2026-10-31T20:00:00.000Z',
  completedAt: '2026-10-31T20:00:05.000Z',
  axeVersion: '4.14.0',
  extensionVersion: '0.1.0',
  browserName: 'chrome',
  status: 'completed',
  findings: [
    createFinding(),
    createFinding({
      fingerprint: 'fp-contrast-202',
      ruleId: 'color-contrast',
      impact: 'serious',
      roomId: 'contrast-crypt',
      description: 'Low contrast text on encrypted tombstone',
      wcagTags: ['wcag2aa'],
      nodes: [
        {
          target: ['span.encrypted-tomb'],
          htmlExcerpt: '<span class="encrypted-tomb">Bearer eyJhbGciOi...</span>',
          failureSummary: 'Element has insufficient color contrast',
        },
      ],
    }),
  ],
  incompleteChecksCount: 0,
  passesCount: 10,
  inapplicableCount: 5,
  ...overrides,
});

describe('Phase 8 Workstream 2: Privacy Redaction Pipeline & Export Safety Engine', () => {
  // ==========================================================================
  // 1. Mandatory URL Protection & Scoping (redactUrl)
  // ==========================================================================
  describe('1. URL Protection & Scoping (redactUrl)', () => {
    it('always purges HTTP userinfo credentials (username:password@)', () => {
      const url = 'https://ghost_admin:spectral_pass@example.com/crypt';
      expect(redactUrl(url, 'full')).toBe('https://example.com/crypt');
      expect(redactUrl(url, 'path-only')).toBe('https://example.com/crypt');
      expect(redactUrl(url, 'hostname-only')).toBe('https://example.com');
    });

    it('always strips standard authentication tokens and sensitive parameters', () => {
      const sensitiveKeys = [
        'token',
        'access_token',
        'id_token',
        'refresh_token',
        'api_key',
        'apikey',
        'secret',
        'password',
        'pwd',
        'session',
        'session_id',
        'sid',
        'code',
        'state',
        'signature',
      ];

      for (const key of sensitiveKeys) {
        const raw = `https://example.com/audit?${key}=top_secret_value_123&page=1`;
        const redacted = redactUrl(raw, 'full');
        expect(redacted).not.toContain('top_secret_value_123');
        expect(redacted).not.toContain(`${key}=`);
        expect(redacted).toContain('page=1');
      }
    });

    it('strips OAuth2/OIDC implicit grant credentials in hash fragments', () => {
      const raw =
        'https://example.com/callback#access_token=ya29.xyz123&token_type=bearer&state=secret_state';
      const redacted = redactUrl(raw, 'full');
      expect(redacted).toBe('https://example.com/callback');
      expect(redacted).not.toContain('access_token');
      expect(redacted).not.toContain('ya29');
    });

    it('handles mixed-case sensitive parameter names and encoded characters', () => {
      const raw =
        'https://example.com/scan?TOKEN=secret1&ApiKey=secret2&%61%63%63%65%73%73%5f%74%6f%6b%65%6e=secret3&safe=keepme';
      const redacted = redactUrl(raw, 'full');
      expect(redacted).not.toContain('secret1');
      expect(redacted).not.toContain('secret2');
      expect(redacted).not.toContain('secret3');
      expect(redacted).toContain('safe=keepme');
    });

    it('handles repeated query parameters, purging sensitive keys and preserving safe keys', () => {
      const raw = 'https://example.com/scan?tag=a11y&token=sec1&tag=wcag&token=sec2';
      const redacted = redactUrl(raw, 'full');
      expect(redacted).not.toContain('sec1');
      expect(redacted).not.toContain('sec2');
      expect(redacted).toContain('tag=a11y');
      expect(redacted).toContain('tag=wcag');
    });

    it('preserves safe functional query parameters and SPA route fragments in "full" mode', () => {
      const raw =
        'https://example.com/portal?search=audit&page=2&lang=en&token=secret#/rooms/contrast-crypt';
      const redacted = redactUrl(raw, 'full');
      expect(redacted).toContain('search=audit');
      expect(redacted).toContain('page=2');
      expect(redacted).toContain('lang=en');
      expect(redacted).toContain('#/rooms/contrast-crypt');
      expect(redacted).not.toContain('token=secret');
    });

    it('strips query parameters and hash fragments entirely in "path-only" mode', () => {
      const raw =
        'https://example.com:8443/portal/rooms?search=audit&page=2#/rooms/contrast-crypt';
      const redacted = redactUrl(raw, 'path-only');
      expect(redacted).toBe('https://example.com:8443/portal/rooms');
      expect(redacted).not.toContain('?');
      expect(redacted).not.toContain('#');
    });

    it('strips pathname, query, and hash in "hostname-only" mode (preserves origin only)', () => {
      const raw =
        'https://example.com:8443/portal/rooms/crypt?search=audit&page=2#/rooms/contrast-crypt';
      const redacted = redactUrl(raw, 'hostname-only');
      expect(redacted).toBe('https://example.com:8443');
      expect(redacted).not.toContain('/portal');
      expect(redacted).not.toContain('?');
      expect(redacted).not.toContain('#');
    });

    it('handles root URLs properly across all redaction levels', () => {
      const raw = 'https://example.com/?token=secret';
      expect(redactUrl(raw, 'full')).toBe('https://example.com/');
      expect(redactUrl(raw, 'path-only')).toBe('https://example.com/');
      expect(redactUrl(raw, 'hostname-only')).toBe('https://example.com');
    });

    it('handles file:// protocol URLs safely', () => {
      const fileUrl = 'file:///C:/Users/Auditor/test.html?token=123#frag';
      expect(redactUrl(fileUrl, 'full')).toBe('file:///C:/Users/Auditor/test.html#frag');
      expect(redactUrl(fileUrl, 'path-only')).toBe('file:///C:/Users/Auditor/test.html');
      expect(redactUrl(fileUrl, 'hostname-only')).toBe('file://localhost');
    });

    it('fails safely without exposing sensitive parameters on malformed unparseable URLs', () => {
      const malformed = 'not a valid url ://?token=supersecret123#myhash';
      const redactedFull = redactUrl(malformed, 'full');
      expect(redactedFull).not.toContain('supersecret123');
      expect(redactedFull).not.toContain('token=');

      const redactedHost = redactUrl(malformed, 'hostname-only');
      expect(redactedHost).toBe('[REDACTED_URL]');

      const redactedPath = redactUrl(malformed, 'path-only');
      expect(redactedPath).not.toContain('?');
      expect(redactedPath).not.toContain('supersecret123');
    });

    it('is strictly idempotent across all redaction levels', () => {
      const levels: ExportReportOptions['urlRedactionLevel'][] = [
        'full',
        'path-only',
        'hostname-only',
      ];
      const testUrls = [
        'https://example.com/rooms?search=a11y&page=1#frag',
        'https://admin:pass@haunted.org:9000/crypt/path',
        'https://spa.manor/#/route?token=secret',
      ];

      for (const level of levels) {
        for (const url of testUrls) {
          const once = redactUrl(url, level);
          const twice = redactUrl(once, level);
          expect(twice).toBe(once);
        }
      }
    });
  });

  // ==========================================================================
  // 2. HTML Excerpt Sanitization (sanitizeHtmlExcerpt)
  // ==========================================================================
  describe('2. HTML Excerpt Sanitization (sanitizeHtmlExcerpt)', () => {
    it('redacts form input value attributes', () => {
      const html = '<input type="text" name="secret_code" value="CLASSIFIED_12345" />';
      const sanitized = sanitizeHtmlExcerpt(html);
      expect(sanitized).not.toContain('CLASSIFIED_12345');
      expect(sanitized).toContain('value="[REDACTED]"');
    });

    it('redacts password inputs specifically with [PASSWORD_REDACTED]', () => {
      const html = '<input type="password" id="user-pass" value="Hunter2!@" />';
      const sanitized = sanitizeHtmlExcerpt(html);
      expect(sanitized).not.toContain('Hunter2!@');
      expect(sanitized).toContain('value="[PASSWORD_REDACTED]"');
    });

    it('redacts sensitive data-* attributes (data-token, data-secret, data-auth)', () => {
      const html =
        '<div data-token="jwt_eyJhbGciOi..." data-secret="42" data-auth="bearer123">Content</div>';
      const sanitized = sanitizeHtmlExcerpt(html);
      expect(sanitized).not.toContain('jwt_eyJhbGciOi...');
      expect(sanitized).not.toContain('42');
      expect(sanitized).not.toContain('bearer123');
      expect(sanitized).toContain('data-token="[REDACTED]"');
    });

    it('redacts inline bearer tokens and API keys in text content', () => {
      const html = '<span>Authorization: Bearer my-secret-jwt-token-99</span>';
      const sanitized = sanitizeHtmlExcerpt(html);
      expect(sanitized).not.toContain('my-secret-jwt-token-99');
      expect(sanitized).toContain('bearer [REDACTED]');

      const htmlApiKey = '<div>api_key="sk-live-1234567890abcdef"</div>';
      const sanitizedApiKey = sanitizeHtmlExcerpt(htmlApiKey);
      expect(sanitizedApiKey).not.toContain('sk-live-1234567890abcdef');
      expect(sanitizedApiKey).toContain('[REDACTED_SECRET]');
    });

    it('neutralizes executable script tags and event handlers', () => {
      const htmlWithScript =
        '<img src="ghost.png" onerror="alert(document.cookie)" /><script>stealTokens()</script>';
      const sanitized = sanitizeHtmlExcerpt(htmlWithScript);
      expect(sanitized).not.toContain('alert(document.cookie)');
      expect(sanitized).not.toContain('stealTokens()');
      expect(sanitized).toContain('on-event="[REDACTED]"');
      expect(sanitized).toContain('[SCRIPT_REDACTED]');
    });

    it('safely bounds oversized excerpts to the configured maximum length', () => {
      const hugeHtml = '<div>' + 'A'.repeat(500) + '</div>';
      const sanitized = sanitizeHtmlExcerpt(hugeHtml, 200);
      expect(sanitized.length).toBeLessThanOrEqual(200);
      expect(sanitized.endsWith('...')).toBe(true);
    });

    it('respects schema upper bound of 1000 even if a larger length is requested', () => {
      const massiveHtml = '<span>' + 'B'.repeat(2000) + '</span>';
      const sanitized = sanitizeHtmlExcerpt(massiveHtml, 1500);
      expect(sanitized.length).toBeLessThanOrEqual(1000);
    });

    it('is strictly idempotent on already sanitized excerpts', () => {
      const sample =
        '<input type="password" value="secret" data-token="abc" /><script>evil()</script>';
      const once = sanitizeHtmlExcerpt(sample);
      const twice = sanitizeHtmlExcerpt(once);
      expect(twice).toBe(once);
    });
  });

  // ==========================================================================
  // 3. User Remediation Notes Sanitization (sanitizeRemediationNotes)
  // ==========================================================================
  describe('3. Remediation Notes Sanitization', () => {
    it('returns undefined for empty, null, or whitespace notes', () => {
      expect(sanitizeRemediationNotes(undefined)).toBeUndefined();
      expect(sanitizeRemediationNotes('')).toBeUndefined();
      expect(sanitizeRemediationNotes('   ')).toBeUndefined();
    });

    it('strips bearer tokens and credentials from user remediation notes', () => {
      const notes =
        'Attempted fix with bearer ya29.secret_token and api_key="sk-12345678". Looks good!';
      const sanitized = sanitizeRemediationNotes(notes);
      expect(sanitized).not.toContain('ya29.secret_token');
      expect(sanitized).not.toContain('sk-12345678');
      expect(sanitized).toContain('bearer [REDACTED]');
      expect(sanitized).toContain('[REDACTED_SECRET]');
    });

    it('bounds notes to maximum schema length of 500 characters', () => {
      const longNotes = 'Fixed button aria-label. ' + 'Details: '.repeat(100);
      const sanitized = sanitizeRemediationNotes(longNotes);
      expect(sanitized).toBeDefined();
      expect(sanitized!.length).toBeLessThanOrEqual(500);
      expect(sanitized!.endsWith('...')).toBe(true);
    });
  });

  // ==========================================================================
  // 4. Privacy Redaction Pipeline (redactReportPayload)
  // ==========================================================================
  describe('4. Privacy Redaction Pipeline (redactReportPayload)', () => {
    it('omits htmlExcerpt completely when includeHtmlExcerpts === false', () => {
      const scan = createScan();
      const rawPayload = buildReportPayload(scan, {
        format: 'json',
        includeHtmlExcerpts: true, // raw payload had excerpts
        urlRedactionLevel: 'full',
      });

      // Verify raw payload indeed has excerpts
      expect(rawPayload.findings[0]?.nodes[0]?.htmlExcerpt).toBeDefined();

      // Execute privacy pipeline with includeHtmlExcerpts: false
      const redacted = redactReportPayload(rawPayload, {
        format: 'json',
        includeHtmlExcerpts: false,
        urlRedactionLevel: 'full',
      });

      // Assert that htmlExcerpt is omitted completely across all findings and nodes
      for (const finding of redacted.findings) {
        for (const node of finding.nodes) {
          expect('htmlExcerpt' in node).toBe(false);
          expect(node.htmlExcerpt).toBeUndefined();
        }
      }

      // Assert validated against schema
      expect(ReportExportPayloadSchema.parse(redacted)).toBeDefined();
    });

    it('retains and sanitizes htmlExcerpt when includeHtmlExcerpts === true', () => {
      const scan = createScan();
      const rawPayload = buildReportPayload(scan, {
        format: 'json',
        includeHtmlExcerpts: true,
        urlRedactionLevel: 'full',
      });

      const redacted = redactReportPayload(rawPayload, {
        format: 'json',
        includeHtmlExcerpts: true,
        urlRedactionLevel: 'full',
      });

      const firstNode = redacted.findings[0]?.nodes[0];
      expect(firstNode?.htmlExcerpt).toBeDefined();
      expect(firstNode?.htmlExcerpt).toContain('value="[REDACTED]"');
      expect(firstNode?.htmlExcerpt).not.toContain('my-super-secret-key');
      expect(firstNode?.htmlExcerpt).not.toContain('secret-token-123');
    });

    it('redacts target URL in accordance with requested urlRedactionLevel', () => {
      const scan = createScan();
      const rawPayload = buildReportPayload(scan);

      // 1. Full
      const fullRedacted = redactReportPayload(rawPayload, {
        format: 'json',
        includeHtmlExcerpts: true,
        urlRedactionLevel: 'full',
      });
      expect(fullRedacted.target.url).toBe(
        'https://haunted.example.com:8443/portal/rooms?room=ballroom&page=2#section'
      );
      expect(fullRedacted.target.url).not.toContain('pass123');
      expect(fullRedacted.target.url).not.toContain('sensitive_token_abc');
      expect(fullRedacted.target.url).not.toContain('secret_auth');

      // 2. Path-only
      const pathRedacted = redactReportPayload(rawPayload, {
        format: 'json',
        includeHtmlExcerpts: true,
        urlRedactionLevel: 'path-only',
      });
      expect(pathRedacted.target.url).toBe(
        'https://haunted.example.com:8443/portal/rooms'
      );
      expect(pathRedacted.target.url).not.toContain('?');
      expect(pathRedacted.target.url).not.toContain('#');

      // 3. Hostname-only
      const hostRedacted = redactReportPayload(rawPayload, {
        format: 'json',
        includeHtmlExcerpts: true,
        urlRedactionLevel: 'hostname-only',
      });
      expect(hostRedacted.target.url).toBe('https://haunted.example.com:8443');
      expect(hostRedacted.target.url).not.toContain('/portal');
    });

    it('omits remediationRecommendation when includeRemediationGuidance === false', () => {
      const scan = createScan();
      const remediationData: RemediationStoragePayload = {
        'fp-button-101': {
          findingFingerprint: 'fp-button-101',
          ruleId: 'button-name',
          status: 'suggested',
          notes: 'Private developer notes with secret_key=xyz',
          updatedAt: '2026-10-31T20:00:00.000Z',
        },
      };

      const rawPayload = buildReportPayload(
        scan,
        {
          format: 'json',
          includeHtmlExcerpts: true,
          urlRedactionLevel: 'full',
        },
        remediationData
      );

      // When includeRemediationGuidance === false, recommendations are completely stripped
      const redacted = redactReportPayload(rawPayload, {
        format: 'json',
        includeHtmlExcerpts: true,
        urlRedactionLevel: 'full',
        includeRemediationGuidance: false,
      });

      for (const finding of redacted.findings) {
        expect(finding.remediationRecommendation).toBeUndefined();
      }
    });

    it('sanitizes notes when includeRemediationGuidance === true', () => {
      const scan = createScan();
      const remediationData: RemediationStoragePayload = {
        'fp-button-101': {
          findingFingerprint: 'fp-button-101',
          ruleId: 'button-name',
          status: 'attempted',
          notes: 'Tried bearer eyJtoken123 and api_key="secret-key"',
          updatedAt: '2026-10-31T20:00:00.000Z',
        },
      };

      const rawPayload = buildReportPayload(
        scan,
        {
          format: 'json',
          includeHtmlExcerpts: true,
          urlRedactionLevel: 'full',
        },
        remediationData
      );

      const redacted = redactReportPayload(rawPayload, {
        format: 'json',
        includeHtmlExcerpts: true,
        urlRedactionLevel: 'full',
        includeRemediationGuidance: true,
      });

      const buttonFinding = redacted.findings.find((f) => f.ruleId === 'button-name');
      expect(buttonFinding?.remediationRecommendation).toBeDefined();
      expect(buttonFinding?.remediationRecommendation?.notes).toContain(
        'bearer [REDACTED]'
      );
      expect(buttonFinding?.remediationRecommendation?.notes).not.toContain(
        'eyJtoken123'
      );
      expect(buttonFinding?.remediationRecommendation?.notes).not.toContain('secret-key');
    });

    it('does NOT mutate the original payload, findings, or node objects', () => {
      const scan = createScan();
      const rawPayload = buildReportPayload(scan, {
        format: 'json',
        includeHtmlExcerpts: true,
        urlRedactionLevel: 'full',
      });

      // Snapshot original excerpt before redaction
      const originalExcerpt = rawPayload.findings[0]?.nodes[0]?.htmlExcerpt;
      const originalUrl = rawPayload.target.url;

      const redacted = redactReportPayload(rawPayload, {
        format: 'json',
        includeHtmlExcerpts: false,
        urlRedactionLevel: 'hostname-only',
      });

      // Verify rawPayload remains unmodified
      expect(rawPayload.findings[0]?.nodes[0]?.htmlExcerpt).toBe(originalExcerpt);
      expect(rawPayload.target.url).toBe(originalUrl);
      expect(redacted).not.toBe(rawPayload);
    });

    it('is strictly idempotent: running redactReportPayload twice produces identical results', () => {
      const scan = createScan();
      const rawPayload = buildReportPayload(scan);

      const options: ExportReportOptions = {
        format: 'json',
        includeHtmlExcerpts: true,
        urlRedactionLevel: 'path-only',
      };

      const redactedOnce = redactReportPayload(rawPayload, options);
      const redactedTwice = redactReportPayload(redactedOnce, options);

      expect(redactedTwice).toEqual(redactedOnce);
    });

    it('purges unknown or injected properties through strict allowlisting', () => {
      const scan = createScan();
      const rawPayload = buildReportPayload(scan);

      // Inject unexpected properties into raw payload (simulating leaked state)
      const tamperedPayload = {
        ...rawPayload,
        leakedInternalSessionToken: 'malicious-leak-999',
        target: {
          ...rawPayload.target,
          leakedTabWorkerId: 442,
        },
      } as unknown as ReportExportPayload;

      const redacted = redactReportPayload(tamperedPayload, {
        format: 'json',
        includeHtmlExcerpts: true,
        urlRedactionLevel: 'full',
      });

      // Strict allowlist must NOT carry over the leaked fields
      expect('leakedInternalSessionToken' in redacted).toBe(false);
      expect('leakedTabWorkerId' in redacted.target).toBe(false);
      expect(ReportExportPayloadSchema.safeParse(redacted).success).toBe(true);
    });
  });

  // ==========================================================================
  // 5. Safe Redaction & Error Handling
  // ==========================================================================
  describe('5. Safe Redaction & Error Handling', () => {
    it('safeRedactReportPayload returns { success: true, payload } on valid inputs', () => {
      const scan = createScan();
      const rawPayload = buildReportPayload(scan);

      const result = safeRedactReportPayload(rawPayload, {
        format: 'json',
        includeHtmlExcerpts: true,
        urlRedactionLevel: 'full',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.payload.target.url).toBeDefined();
      }
    });

    it('safeRedactReportPayload returns typed RedactionValidationError on invalid options', () => {
      const scan = createScan();
      const rawPayload = buildReportPayload(scan);

      // Pass invalid options object
      const invalidOptions = {
        format: 'pdf', // invalid format
        includeHtmlExcerpts: 'not-a-bool',
        urlRedactionLevel: 'super-redact',
      } as unknown as ExportReportOptions;

      const result = safeRedactReportPayload(rawPayload, invalidOptions);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(RedactionValidationError);
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });
  });

  // ==========================================================================
  // 6. Integrated Export API (prepareReportExport & exportReportToJson)
  // ==========================================================================
  describe('6. Integrated Export API (prepareReportExport & exportReportToJson)', () => {
    it('prepareReportExport builds, redacts, and validates from a scan in one step', () => {
      const scan = createScan();
      const options: ExportReportOptions = {
        format: 'json',
        includeHtmlExcerpts: false,
        urlRedactionLevel: 'path-only',
      };

      const safePayload = prepareReportExport(scan, options);

      expect(safePayload.target.url).toBe(
        'https://haunted.example.com:8443/portal/rooms'
      );
      expect(safePayload.findings[0]?.nodes[0]?.htmlExcerpt).toBeUndefined();
      expect(ReportExportPayloadSchema.safeParse(safePayload).success).toBe(true);
    });

    it('exportReportToJson ensures zero credential or raw excerpt leakage in serialized output', () => {
      const scan = createScan();
      const options: ExportReportOptions = {
        format: 'json',
        includeHtmlExcerpts: false,
        urlRedactionLevel: 'hostname-only',
      };

      const jsonString = exportReportToJson(scan, options);

      // Negative assertions: check that sensitive tokens never appear anywhere in the JSON
      expect(jsonString).not.toContain('pass123');
      expect(jsonString).not.toContain('sensitive_token_abc');
      expect(jsonString).not.toContain('secret_auth');
      expect(jsonString).not.toContain('my-super-secret-key');
      expect(jsonString).not.toContain('secret-token-123');
      expect(jsonString).not.toContain('htmlExcerpt');

      // Positive assertions
      expect(jsonString).toContain('"url": "https://haunted.example.com:8443"');
      expect(jsonString).toContain('"tool": "Phantom Audit"');
      expect(jsonString).toContain('"schemaVersion": 1');
    });
  });

  // ==========================================================================
  // 7. Security Hardening & Regression Tests (DEF-811 through DEF-815)
  // ==========================================================================
  describe('7. Security Hardening & Regression Tests (DEF-811 through DEF-815)', () => {
    it('DEF-811: serializeReportToJson closes export API bypass and enforces optionsApplied redaction level', () => {
      const scan = createScan();
      // Simulate caller building report with hostname-only option, but skipping redactReportPayload
      const rawPayload = buildReportPayload(scan, {
        format: 'json',
        includeHtmlExcerpts: true,
        urlRedactionLevel: 'hostname-only',
      });

      // Raw payload still has the full path
      expect(rawPayload.target.url).toContain('/portal/rooms');

      // Passing to serializeReportToJson directly must enforce hostname-only truncation
      const serialized = serializeReportToJson(rawPayload);
      const parsed = JSON.parse(serialized);

      expect(parsed.target.url).toBe('https://haunted.example.com:8443');
      expect(parsed.target.url).not.toContain('/portal/rooms');
    });

    it('DEF-812: sanitizeHtmlExcerpt disarms adversarial XSS payloads (scripts, SVGs, javascript:, unclosed tags)', () => {
      // 1. Unclosed script tag
      const unclosedScript = '<script src="https://evil.org/xss.js"><div>Content</div>';
      const disarmed1 = sanitizeHtmlExcerpt(unclosedScript);
      expect(disarmed1).not.toContain('<script');
      expect(disarmed1).toContain('[SCRIPT_REDACTED]');

      // 2. SVG with event handler
      const svgPayload = '<svg/onload=alert(document.cookie)>';
      const disarmed2 = sanitizeHtmlExcerpt(svgPayload);
      expect(disarmed2).not.toContain('alert');
      expect(disarmed2).toContain('[SVG_REDACTED]');

      // 3. javascript: link
      const jsLink = '<a href="javascript:alert(1)">Click Me</a>';
      const disarmed3 = sanitizeHtmlExcerpt(jsLink);
      expect(disarmed3).not.toContain('javascript:alert(1)');
      expect(disarmed3).toContain('href="[BLOCKED_URI]"');

      // 4. Slash-delimited hidden form input value
      const hiddenInput =
        '<input/type="hidden"/name="csrf"/value="ultra_secret_csrf_token">';
      const disarmed4 = sanitizeHtmlExcerpt(hiddenInput);
      expect(disarmed4).not.toContain('ultra_secret_csrf_token');
      expect(disarmed4).toContain('value="[REDACTED]"');

      // 5. Textarea content
      const textarea = '<textarea name="password">MySecretPassword99!</textarea>';
      const disarmed5 = sanitizeHtmlExcerpt(textarea);
      expect(disarmed5).not.toContain('MySecretPassword99!');
      expect(disarmed5).toContain('<textarea name="password">[REDACTED]</textarea>');

      // 6. Broad data-* attributes (data-user-auth-token, data-api_key, data-csrf)
      const dataDiv =
        '<div data-user-auth-token="token123" data-api_key="key456" data-csrf="csrf789">Safe text</div>';
      const disarmed6 = sanitizeHtmlExcerpt(dataDiv);
      expect(disarmed6).not.toContain('token123');
      expect(disarmed6).not.toContain('key456');
      expect(disarmed6).not.toContain('csrf789');
      expect(disarmed6).toContain('data-token="[REDACTED]"');

      // 7. HTML comments
      const comment = '<!-- <script>evil()</script> -->';
      const disarmed7 = sanitizeHtmlExcerpt(comment);
      expect(disarmed7).toContain('<!-- [COMMENT_REDACTED] -->');
    });

    it('DEF-813: isSensitiveQueryParam purges double-encoded and compound parameter names', () => {
      // Double-encoded 'token': %2574%256f%256b%2565%256e -> %74%6f%6b%65%6e -> token
      const doubleEncodedUrl =
        'https://example.com/api?%2574%256f%256b%2565%256e=secret_double_token&page=1';
      const redacted = redactUrl(doubleEncodedUrl, 'full');
      expect(redacted).not.toContain('secret_double_token');
      expect(redacted).toContain('page=1');

      // Compound keys with hyphen and underscore
      const compoundUrl =
        'https://example.com/api?auth_token=sec1&user-token=sec2&api_key=sec3&safe=val';
      const redactedCompound = redactUrl(compoundUrl, 'full');
      expect(redactedCompound).not.toContain('sec1');
      expect(redactedCompound).not.toContain('sec2');
      expect(redactedCompound).not.toContain('sec3');
      expect(redactedCompound).toContain('safe=val');
    });

    it('DEF-814: sanitizeRemediationNotes scrubs compound token assignments while preserving normal prose', () => {
      // Normal prose without secrets
      const normalProse =
        'Applied fix: Added accessible aria-label="Dismiss modal" to close button. Verified with keyboard tab navigation.';
      expect(sanitizeRemediationNotes(normalProse)).toBe(normalProse);

      // Sensitive notes with access_token and refresh_token
      const sensitiveNotes =
        'Fix deployed. Test credentials: access_token=ya29.xyz_token and refresh_token="secret_refresh_123"';
      const scrubbed = sanitizeRemediationNotes(sensitiveNotes);
      expect(scrubbed).not.toContain('ya29.xyz_token');
      expect(scrubbed).not.toContain('secret_refresh_123');
      expect(scrubbed).toContain('[REDACTED_SECRET]');
    });

    it('DEF-815: handles Internationalized / Unicode URLs and malformed inputs safely', () => {
      // Internationalized domain name (IDN)
      const unicodeUrl = 'https://münchen.de/crypt?page=1&token=secret123';
      const redactedFull = redactUrl(unicodeUrl, 'full');
      expect(redactedFull).not.toContain('secret123');
      expect(redactedFull).toContain('page=1');

      const redactedHost = redactUrl(unicodeUrl, 'hostname-only');
      expect(redactedHost).toBe('https://xn--mnchen-3ya.de');

      // Non-parseable malformed string
      const badString = 'not a valid url ://host?token=secret456#hash';
      const safeFallback = redactUrl(badString, 'hostname-only');
      expect(safeFallback).toBe('[REDACTED_URL]');
    });
  });
});
