import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { FindingRecord } from '@/domain/finding';
import type { ScanRecord } from '@/domain/scan';
import type { ExportReportOptions, UrlRedactionLevel } from '@/domain/report';
import {
  redactUrl,
  sanitizeHtmlExcerpt,
  redactReportPayload,
  exportReportToJson,
} from '@/features/reports/report-redactor';
import { buildReportPayload } from '@/features/reports/json-serializer';
import { ReportExportPayloadSchema } from '@/lib/validation/schemas';

const SENSITIVE_PARAM_NAMES = [
  'token',
  'access_token',
  'id_token',
  'refresh_token',
  'auth',
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
];

const SAFE_PARAM_NAMES = ['search', 'filter', 'page', 'lang', 'view', 'sort', 'mode'];

describe('Phase 8 Workstream 2: Property-Based Privacy Fuzz Testing (fast-check)', () => {
  // ==========================================================================
  // Property 1: Arbitrary URLs with Injected Credentials & Tokens
  // ==========================================================================
  it('property test: arbitrary URLs with injected credentials never leak tokens under any redaction level', () => {
    const sensitiveParamArb = fc.constantFrom(...SENSITIVE_PARAM_NAMES);
    const safeParamArb = fc.constantFrom(...SAFE_PARAM_NAMES);
    const secretValueArb = fc.stringMatching(/^[a-zA-Z0-9_-]{10,30}$/);
    const safeValueArb = fc.stringMatching(/^[a-zA-Z0-9_-]{1,15}$/);
    const redactionLevelArb = fc.constantFrom<UrlRedactionLevel>(
      'full',
      'path-only',
      'hostname-only'
    );

    fc.assert(
      fc.property(
        sensitiveParamArb,
        secretValueArb,
        safeParamArb,
        safeValueArb,
        redactionLevelArb,
        (sensitiveKey, secretVal, safeKey, safeVal, level) => {
          const rawUrl = `https://user:secretpass@example.com/portal/audit?${safeKey}=${safeVal}&${sensitiveKey}=${secretVal}#route?${sensitiveKey}=hash_secret`;

          const redacted = redactUrl(rawUrl, level);

          // Zero leakage guarantees
          expect(redacted).not.toContain(secretVal);
          expect(redacted).not.toContain('secretpass');
          expect(redacted).not.toContain('user:');

          if (level === 'hostname-only') {
            expect(redacted).toBe('https://example.com');
          } else if (level === 'path-only') {
            expect(redacted).toBe('https://example.com/portal/audit');
          } else if (level === 'full') {
            expect(redacted).toContain(`${safeKey}=${safeVal}`);
            expect(redacted).not.toContain(`${sensitiveKey}=`);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // ==========================================================================
  // Property 2: Arbitrary HTML Excerpts
  // ==========================================================================
  it('property test: arbitrary HTML excerpts are always bounded <= 1000 and sensitive values redacted', () => {
    const arbitraryHtmlTagArb = fc.constantFrom(
      'input',
      'button',
      'div',
      'span',
      'textarea'
    );
    const secretValueArb = fc.stringMatching(/^[a-zA-Z0-9_!@#$%^&*()-]{5,40}$/);
    const maxLengthArb = fc.integer({ min: 20, max: 800 });

    fc.assert(
      fc.property(
        arbitraryHtmlTagArb,
        secretValueArb,
        maxLengthArb,
        (tag, secret, maxLen) => {
          const rawHtml = `<${tag} value="${secret}" data-token="${secret}" class="test">Bearer ${secret}</${tag}>`;

          const sanitized = sanitizeHtmlExcerpt(rawHtml, maxLen);

          // Bound guarantee
          expect(sanitized.length).toBeLessThanOrEqual(Math.min(maxLen, 1000));

          // Sensitive value elimination guarantee
          expect(sanitized).not.toContain(`value="${secret}"`);
          expect(sanitized).not.toContain(`data-token="${secret}"`);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ==========================================================================
  // Property 3: Idempotency Across Arbitrary Valid Options
  // ==========================================================================
  it('property test: redactReportPayload is strictly idempotent for arbitrary export options', () => {
    const optionsArb = fc.record<ExportReportOptions>({
      format: fc.constantFrom('json', 'html'),
      includeHtmlExcerpts: fc.boolean(),
      urlRedactionLevel: fc.constantFrom('full', 'path-only', 'hostname-only'),
      includeRemediationGuidance: fc.boolean(),
    });

    const mockScan: ScanRecord = {
      id: 'fuzz-scan-uuid-1',
      schemaVersion: 1,
      tabUrl: 'https://admin:pass@haunted-fuzz.org/crypt?page=1&token=secret_123#frag',
      pageTitle: 'Fuzz Audit',
      hostname: 'haunted-fuzz.org',
      scannedAt: '2026-10-31T20:00:00.000Z',
      axeVersion: '4.14.0',
      extensionVersion: '0.1.0',
      browserName: 'chrome',
      status: 'completed',
      findings: [
        {
          fingerprint: 'fp-fuzz-1',
          ruleId: 'button-name',
          impact: 'critical',
          description: 'Button has no discernible name',
          help: 'Buttons must have discernible text',
          wcagTags: ['wcag2a'],
          roomId: 'name-chamber',
          affectedNodeCount: 1,
          nodes: [
            {
              target: ['button.fuzz'],
              htmlExcerpt: '<button value="super_secret">Click</button>',
              failureSummary: 'Missing name',
            },
          ],
          firstSeenAt: '2026-10-31T20:00:00.000Z',
          reviewed: false,
        },
      ],
      incompleteChecksCount: 0,
      passesCount: 5,
      inapplicableCount: 2,
    };

    fc.assert(
      fc.property(optionsArb, (opts) => {
        const rawPayload = buildReportPayload(mockScan, opts);

        const redactedOnce = redactReportPayload(rawPayload, opts);
        const redactedTwice = redactReportPayload(redactedOnce, opts);

        // Strict deep equality between 1st and 2nd pass
        expect(redactedTwice).toEqual(redactedOnce);

        // Validates against schema on both passes
        expect(ReportExportPayloadSchema.safeParse(redactedOnce).success).toBe(true);
        expect(ReportExportPayloadSchema.safeParse(redactedTwice).success).toBe(true);
      }),
      { numRuns: 50 }
    );
  });

  // ==========================================================================
  // Property 4: Strict Excerpt Omission Invariant
  // ==========================================================================
  it('property test: when includeHtmlExcerpts is false, no node in any finding contains htmlExcerpt', () => {
    const findingCountArb = fc.integer({ min: 1, max: 10 });
    const levelArb = fc.constantFrom<UrlRedactionLevel>(
      'full',
      'path-only',
      'hostname-only'
    );

    fc.assert(
      fc.property(findingCountArb, levelArb, (count, level) => {
        const findings: FindingRecord[] = Array.from({ length: count }, (_, i) => ({
          fingerprint: `fp-prop-${i}`,
          ruleId: `rule-${i % 3}`,
          impact: 'serious' as const,
          description: `Finding ${i}`,
          help: `Help ${i}`,
          wcagTags: ['wcag2aa'],
          roomId: 'structure-hall' as const,
          affectedNodeCount: 2,
          nodes: [
            {
              target: [`div.elem-${i}-0`],
              htmlExcerpt: `<div value="secret-${i}">Raw HTML Excerpt</div>`,
              failureSummary: `Summary ${i}-0`,
            },
            {
              target: [`div.elem-${i}-1`],
              htmlExcerpt: `<div data-token="token-${i}">Second Raw HTML Excerpt</div>`,
              failureSummary: `Summary ${i}-1`,
            },
          ],
          firstSeenAt: '2026-10-31T20:00:00.000Z',
          reviewed: false,
        }));

        const scan: ScanRecord = {
          id: 'prop-scan-id',
          schemaVersion: 1,
          tabUrl: 'https://test.local/page',
          pageTitle: 'Test Page',
          hostname: 'test.local',
          scannedAt: '2026-10-31T20:00:00.000Z',
          axeVersion: '4.14.0',
          extensionVersion: '0.1.0',
          browserName: 'chrome',
          status: 'completed',
          findings,
          incompleteChecksCount: 0,
          passesCount: 1,
          inapplicableCount: 0,
        };

        const raw = buildReportPayload(scan, {
          format: 'json',
          includeHtmlExcerpts: true,
          urlRedactionLevel: level,
        });

        const redacted = redactReportPayload(raw, {
          format: 'json',
          includeHtmlExcerpts: false,
          urlRedactionLevel: level,
        });

        for (const finding of redacted.findings) {
          for (const node of finding.nodes) {
            expect('htmlExcerpt' in node).toBe(false);
            expect(node.htmlExcerpt).toBeUndefined();
          }
        }
      }),
      { numRuns: 30 }
    );
  });

  // ==========================================================================
  // Property 5: End-to-End JSON Export Leak Prevention
  // ==========================================================================
  it('property test: exportReportToJson output string never contains secret credentials or unredacted form values', () => {
    const secretTokenArb = fc.stringMatching(/^[a-zA-Z0-9_-]{12,24}$/);
    const formValueArb = fc.stringMatching(/^[a-zA-Z0-9_!@#]{8,16}$/);

    fc.assert(
      fc.property(secretTokenArb, formValueArb, (secretToken, formValue) => {
        const scan: ScanRecord = {
          id: 'e2e-scan-uuid',
          schemaVersion: 1,
          tabUrl: `https://user:password_secret@mansion.org/login?token=${secretToken}&page=1`,
          pageTitle: 'Mansion Login',
          hostname: 'mansion.org',
          scannedAt: '2026-10-31T20:00:00.000Z',
          axeVersion: '4.14.0',
          extensionVersion: '0.1.0',
          browserName: 'chrome',
          status: 'completed',
          findings: [
            {
              fingerprint: 'fp-login-input',
              ruleId: 'form-field-multiple-labels',
              impact: 'moderate',
              description: 'Form field has multiple labels',
              help: 'Form fields should have a single label',
              wcagTags: ['wcag2a'],
              roomId: 'form-cellar',
              affectedNodeCount: 1,
              nodes: [
                {
                  target: ['input#user-auth'],
                  htmlExcerpt: `<input type="text" id="user-auth" value="${formValue}" data-token="${secretToken}" />`,
                  failureSummary: 'Multiple labels detected',
                },
              ],
              firstSeenAt: '2026-10-31T20:00:00.000Z',
              reviewed: false,
            },
          ],
          incompleteChecksCount: 0,
          passesCount: 10,
          inapplicableCount: 2,
        };

        const jsonOut = exportReportToJson(scan, {
          format: 'json',
          includeHtmlExcerpts: true,
          urlRedactionLevel: 'hostname-only',
        });

        // Negative assertions
        expect(jsonOut).not.toContain(secretToken);
        expect(jsonOut).not.toContain(formValue);
        expect(jsonOut).not.toContain('password_secret');
        expect(jsonOut).not.toContain('?token=');
        expect(jsonOut).not.toContain('&token=');

        // Positive assertions
        expect(jsonOut).toContain('"url": "https://mansion.org"');
        const parsed = JSON.parse(jsonOut);
        expect(parsed.findings[0]?.nodes[0]?.htmlExcerpt).toContain('value="[REDACTED]"');
        expect(parsed.findings[0]?.nodes[0]?.htmlExcerpt).toContain(
          'data-token="[REDACTED]"'
        );
      }),
      { numRuns: 30 }
    );
  });
});
