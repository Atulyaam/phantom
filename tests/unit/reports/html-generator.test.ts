import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { ScanRecord } from '@/domain/scan';
import type { FindingRecord } from '@/domain/finding';
import type { RemediationStoragePayload } from '@/domain/remediation';
import type { ReportExportPayload } from '@/domain/report';
import { buildReportPayload } from '@/features/reports/json-serializer';
import { redactReportPayload } from '@/features/reports/report-redactor';
import {
  generateHtmlReport,
  safeGenerateHtmlReport,
  exportReportToHtml,
  escapeHtml,
  isSafeHttpUrl,
} from '@/features/reports/html-generator';
import {
  AUTOMATED_TESTING_LIMITATIONS,
  MANUAL_REVIEW_CHECKLIST_PROMPTS,
} from '@/features/reports/disclaimers';

// Helper to create mock finding
const createMockFinding = (overrides: Partial<FindingRecord> = {}): FindingRecord => ({
  fingerprint: 'fp-button-spectral-101',
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
      target: ['button.spectral-door'],
      htmlExcerpt: '<button class="spectral-door"></button>',
      failureSummary: 'Fix element name: aria-label missing',
    },
  ],
  firstSeenAt: '2026-10-31T20:00:00.000Z',
  reviewed: false,
  ...overrides,
});

// Helper to create mock scan
const createMockScan = (overrides: Partial<ScanRecord> = {}): ScanRecord => ({
  id: '880e8400-e29b-41d4-a716-446655440000',
  schemaVersion: 1,
  tabUrl: 'https://haunted-manor.example.com/ballroom?page=1',
  pageTitle: 'Haunted Ballroom &mdash; Accessibility Audit',
  hostname: 'haunted-manor.example.com',
  scannedAt: '2026-10-31T20:00:00.000Z',
  completedAt: '2026-10-31T20:00:05.000Z',
  axeVersion: '4.14.0',
  extensionVersion: '0.1.0',
  browserName: 'chrome',
  status: 'completed',
  findings: [
    createMockFinding(),
    createMockFinding({
      fingerprint: 'fp-contrast-crypt-102',
      ruleId: 'color-contrast',
      impact: 'serious',
      roomId: 'contrast-crypt',
      description: 'Faint inscription in crypt foyer',
      help: 'Elements must have sufficient color contrast',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.14/color-contrast',
      wcagTags: ['wcag2aa', 'wcag143'],
      nodes: [
        {
          target: ['p.crypt-text'],
          htmlExcerpt: '<p class="crypt-text">Faint whisper</p>',
          failureSummary: 'Element has insufficient contrast of 2.1:1 (expected 4.5:1)',
        },
      ],
    }),
  ],
  incompleteChecksCount: 2,
  passesCount: 24,
  inapplicableCount: 12,
  ...overrides,
});

// Helper to generate a fully redacted test payload
const createRedactedPayload = (
  scanOverrides: Partial<ScanRecord> = {},
  optionsOverrides = {},
  remediationPayload?: RemediationStoragePayload
): ReportExportPayload => {
  const scan = createMockScan(scanOverrides);
  const options = {
    format: 'html' as const,
    includeHtmlExcerpts: true,
    urlRedactionLevel: 'full' as const,
    includeRemediationGuidance: true,
    reportId: '990e8400-e29b-41d4-a716-446655440000',
    exportedAt: '2026-10-31T20:05:00.000Z',
    ...optionsOverrides,
  };
  const rawPayload = buildReportPayload(scan, options, remediationPayload);
  return redactReportPayload(rawPayload, options);
};

describe('Phase 8 Workstream 3: Standalone Offline Accessible HTML Report Generator', () => {
  describe('1. Unit Utilities (escapeHtml & isSafeHttpUrl)', () => {
    it('escapes standard HTML entity characters (&, <, >, ", \')', () => {
      expect(escapeHtml('&')).toBe('&amp;');
      expect(escapeHtml('<')).toBe('&lt;');
      expect(escapeHtml('>')).toBe('&gt;');
      expect(escapeHtml('"')).toBe('&quot;');
      expect(escapeHtml("'")).toBe('&#39;');
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
    });

    it('safely handles null, undefined, numbers, and booleans', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
      expect(escapeHtml(42)).toBe('42');
      expect(escapeHtml(true)).toBe('true');
      expect(escapeHtml(false)).toBe('false');
    });

    it('validates safe HTTP and HTTPS URLs', () => {
      expect(isSafeHttpUrl('https://example.com/rule')).toBe(true);
      expect(isSafeHttpUrl('http://localhost:3000/')).toBe(true);
      expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isSafeHttpUrl('vbscript:msgbox(1)')).toBe(false);
      expect(isSafeHttpUrl(undefined)).toBe(false);
      expect(isSafeHttpUrl('')).toBe(false);
      expect(isSafeHttpUrl('not-a-url')).toBe(false);
    });
  });

  describe('2. Document Structure & Offline Completeness', () => {
    it('generates a valid, complete standalone HTML document string', () => {
      const payload = createRedactedPayload();
      const html = generateHtmlReport(payload);

      expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<meta charset="utf-8">');
      expect(html).toContain(
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
      );
      expect(html).toContain('</html>');
    });

    it('embeds a restrictive Content Security Policy header in <meta>', () => {
      const payload = createRedactedPayload();
      const html = generateHtmlReport(payload);

      expect(html).toContain('http-equiv="Content-Security-Policy"');
      expect(html).toContain("default-src 'none'");
      expect(html).toContain("style-src 'unsafe-inline'");
      expect(html).toContain("form-action 'none'");
    });

    it('embeds all CSS in a single inlined <style> block with zero external stylesheet links', () => {
      const payload = createRedactedPayload();
      const html = generateHtmlReport(payload);

      expect(html).toContain('<style>');
      expect(html).toContain('</style>');
      expect(html).not.toContain('<link rel="stylesheet"');
      expect(html).not.toContain('@import url(');
      expect(html).not.toContain('fonts.googleapis.com');
      expect(html).not.toContain('cdn.');
    });

    it('contains zero executable <script> tags or external script references', () => {
      const payload = createRedactedPayload();
      const html = generateHtmlReport(payload);

      // Verify no executable unescaped <script tags
      expect(html).not.toMatch(/<script\b[^>]*>/i);
      expect(html).not.toContain('src="http');
    });

    it('includes a functional accessibility skip link pointing to main content', () => {
      const payload = createRedactedPayload();
      const html = generateHtmlReport(payload);

      expect(html).toContain(
        '<a href="#main-content" class="skip-link">Skip to main findings</a>'
      );
      expect(html).toContain('id="main-content"');
    });

    it('contains all required semantic HTML5 landmarks', () => {
      const payload = createRedactedPayload();
      const html = generateHtmlReport(payload);

      expect(html).toContain('<header class="report-header" role="banner">');
      expect(html).toContain('<main id="main-content" role="main">');
      expect(html).toContain('<footer class="report-footer" role="contentinfo">');
      expect(html).toContain('<section class="section"');
    });
  });

  describe('3. Report Identity & Metadata Rendering', () => {
    it('renders accurate tool identity, versions, and report identifiers', () => {
      const payload = createRedactedPayload();
      const html = generateHtmlReport(payload);

      expect(html).toContain('Phantom Audit Report');
      expect(html).toContain('Kiroween 2026 Hackathon Edition');
      expect(html).toContain('990e8400-e29b-41d4-a716-446655440000'); // reportId
      expect(html).toContain('Phantom v0.1.0'); // toolVersion
      expect(html).toContain('axe 4.14.0'); // axeVersion
      expect(html).toContain('chrome'); // browserName
      expect(html).toContain('Schema Version: 1');
      expect(html).toContain('Specification: v1.0.0');
    });

    it('renders target metadata, URL, and computed scan duration', () => {
      const payload = createRedactedPayload();
      const html = generateHtmlReport(payload);

      expect(html).toContain('Haunted Ballroom');
      expect(html).toContain('https://haunted-manor.example.com/ballroom?page=1');
      expect(html).toContain('5.00 s'); // 5 second duration from 20:00:00 to 20:00:05
    });

    it('renders executive summary severity cards and counts', () => {
      const payload = createRedactedPayload();
      const html = generateHtmlReport(payload);

      expect(html).toContain('Executive Findings Summary');
      expect(html).toContain('<span class="metric-count">1</span>'); // 1 critical
      expect(html).toContain('<span class="metric-label">Critical</span>');
      expect(html).toContain('<span class="metric-label">Serious</span>');
      expect(html).toContain('<span class="metric-label">Moderate</span>');
      expect(html).toContain('<span class="metric-label">Minor</span>');
      expect(html).toContain('<span class="metric-label">Passed Checks</span>');
      expect(html).toContain('<span class="metric-label">Incomplete</span>');
    });
  });

  describe('4. Mansion Room Breakdown Table', () => {
    it('renders an accessible table with all 7 mansion rooms and caption', () => {
      const payload = createRedactedPayload();
      const html = generateHtmlReport(payload);

      expect(html).toContain('<table');
      expect(html).toContain(
        '<caption>Haunted Mansion 7-Room Accessibility Breakdown</caption>'
      );
      expect(html).toContain('<th scope="col">Mansion Room</th>');
      expect(html).toContain('<th scope="col">WCAG Family</th>');
      expect(html).toContain('<th scope="col" class="numeric">Critical</th>');

      // Check all 7 rooms exist
      expect(html).toContain('The Name Chamber');
      expect(html).toContain('The Contrast Crypt');
      expect(html).toContain('The Portrait Gallery');
      expect(html).toContain('The Form Cellar');
      expect(html).toContain('The Structure Hall');
      expect(html).toContain('The Focus Corridor');
      expect(html).toContain('The Unmapped Catacombs');
    });

    it('renders dual-encoded status badges (Haunted vs Quiet) for rooms', () => {
      const payload = createRedactedPayload();
      const html = generateHtmlReport(payload);

      // Name Chamber has 1 finding -> Haunted
      expect(html).toContain('<span class="badge badge-status-haunted">Haunted</span>');
      // Portrait Gallery has 0 findings -> Quiet
      expect(html).toContain('<span class="badge badge-status-quiet">Quiet</span>');
    });
  });

  describe('5. Detailed Findings & Remediation Presentation', () => {
    it('renders finding cards with severity, room name, WCAG tags, and rule ID', () => {
      const payload = createRedactedPayload();
      const html = generateHtmlReport(payload);

      expect(html).toContain('finding-card-critical');
      expect(html).toContain('<span class="badge badge-critical">critical</span>');
      expect(html).toContain('<span class="badge badge-room">The Name Chamber</span>');
      expect(html).toContain('<span class="badge badge-wcag">wcag2a</span>');
      expect(html).toContain('<span class="badge badge-wcag">wcag412</span>');
      expect(html).toContain('button-name');
    });

    it('renders affected DOM elements with selectors and failure summaries', () => {
      const payload = createRedactedPayload();
      const html = generateHtmlReport(payload);

      expect(html).toContain('Affected DOM Elements (1)');
      expect(html).toContain('button.spectral-door');
      expect(html).toContain('Fix element name: aria-label missing');
    });

    it('renders HTML excerpts inside escaped <pre><code> when included', () => {
      const payload = createRedactedPayload({}, { includeHtmlExcerpts: true });
      const html = generateHtmlReport(payload);

      expect(html).toContain(
        '<pre class="code-excerpt"><code>&lt;button class=&quot;spectral-door&quot;&gt;&lt;/button&gt;</code></pre>'
      );
    });

    it('displays privacy omission notice when HTML excerpts are omitted', () => {
      const payload = createRedactedPayload({}, { includeHtmlExcerpts: false });
      const html = generateHtmlReport(payload);

      expect(html).toContain('HTML excerpt omitted per export privacy settings.');
      expect(html).not.toContain('&lt;button class=&quot;spectral-door&quot;&gt;');
    });

    it('renders remediation recommendation guidance when present in payload', () => {
      const remediationPayload: RemediationStoragePayload = {
        'fp-button-spectral-101': {
          fingerprint: 'fp-button-spectral-101',
          ruleId: 'button-name',
          status: 'verified',
          updatedAt: '2026-10-31T20:00:00.000Z',
          notes: 'Added aria-label="Open Chamber Doors" to button element.',
        },
      };

      const payload = createRedactedPayload(
        {},
        { includeRemediationGuidance: true },
        remediationPayload
      );
      const html = generateHtmlReport(payload);

      expect(html).toContain('Remediation Guidance');
      expect(html).toContain('aria-label');
      expect(html).toContain('Suggested Code Fix:');
      expect(html).toContain('pre class="remediation-snippet"');
      expect(html).toContain('Status:</strong> verified');
      expect(html).toContain('Added aria-label=');
    });

    it('omits remediation block entirely when includeRemediationGuidance is false', () => {
      const payload = createRedactedPayload({}, { includeRemediationGuidance: false });
      const html = generateHtmlReport(payload);

      expect(html).not.toContain('class="remediation-box"');
    });
  });

  describe('6. Disclaimers & Manual Review Checklist', () => {
    it('prominently displays AUTOMATED_TESTING_LIMITATIONS text', () => {
      const payload = createRedactedPayload();
      const html = generateHtmlReport(payload);

      expect(html).toContain('Automated Testing Scope &amp; Legal Disclaimers');
      expect(html).toContain(escapeHtml(AUTOMATED_TESTING_LIMITATIONS));
    });

    it('displays all 8 prompts from MANUAL_REVIEW_CHECKLIST_PROMPTS', () => {
      const payload = createRedactedPayload();
      const html = generateHtmlReport(payload);

      expect(html).toContain('Essential Manual Review Checklist');
      for (const prompt of MANUAL_REVIEW_CHECKLIST_PROMPTS) {
        expect(html).toContain(escapeHtml(prompt));
      }
    });

    it('displays non-certification legal disclaimer in footer', () => {
      const payload = createRedactedPayload();
      const html = generateHtmlReport(payload);

      expect(html).toContain('does not constitute a legal certification');
    });
  });

  describe('7. Security & Strict HTML Escaping (XSS Immunity)', () => {
    it('escapes adversarial XSS payloads in page title', () => {
      const payload = createRedactedPayload({
        pageTitle: '<script>alert("xss-title")</script>',
      });
      const html = generateHtmlReport(payload);

      expect(html).not.toContain('<script>alert("xss-title")</script>');
      expect(html).toContain('&lt;script&gt;alert(&quot;xss-title&quot;)&lt;/script&gt;');
    });

    it('neutralizes javascript: protocol in target URL and does not render active link', () => {
      const rawPayload = createRedactedPayload();
      // Directly tamper with target.url in payload to test defense-in-depth
      rawPayload.target.url = 'javascript:alert("evil")';
      const html = generateHtmlReport(rawPayload);

      expect(html).not.toContain('href="javascript:');
      expect(html).toContain('javascript:alert(&quot;evil&quot;)');
    });

    it('escapes adversarial payloads in CSS selectors and failure summaries', () => {
      const payload = createRedactedPayload({
        findings: [
          createMockFinding({
            nodes: [
              {
                target: ['div[data-evil="<img src=x onerror=alert(1)>"]'],
                failureSummary: 'Broken ARIA: <b onmouseover="alert(2)">test</b>',
                htmlExcerpt: '<div>test</div>',
              },
            ],
          }),
        ],
      });
      const html = generateHtmlReport(payload);

      expect(html).not.toContain('<img src=x onerror=alert(1)>');
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(html).not.toContain('<b onmouseover=');
      expect(html).toContain('&lt;b onmouseover=&quot;alert(2)&quot;&gt;');
    });

    it('escapes MathML and SVG injection attempts in excerpts and notes', () => {
      const remediationPayload: RemediationStoragePayload = {
        'fp-button-spectral-101': {
          fingerprint: 'fp-button-spectral-101',
          ruleId: 'button-name',
          status: 'suggested',
          updatedAt: '2026-10-31T20:00:00.000Z',
          notes: '<svg onload="alert(1)"><math><mtext>evil</mtext></math></svg>',
        },
      };

      const payload = createRedactedPayload({}, {}, remediationPayload);
      const html = generateHtmlReport(payload);

      expect(html).not.toContain('<svg onload=');
      expect(html).toContain('&lt;svg onload=&quot;alert(1)&quot;&gt;');
    });

    it('escapes HTML comments so they cannot disrupt document structure', () => {
      const payload = createRedactedPayload({
        pageTitle: '<!-- <script>alert(1)</script> --> Title',
      });
      const html = generateHtmlReport(payload);

      expect(html).not.toContain('<!-- <script>');
      expect(html).toContain('&lt;!-- &lt;script&gt;alert(1)&lt;/script&gt; --&gt;');
    });
  });

  describe('8. Privacy Guarantees', () => {
    it('accepts only valid ReportExportPayload and rejects unredacted raw scan objects', () => {
      const invalidPayload = { invalid: true, notAReport: 123 };
      expect(() =>
        generateHtmlReport(invalidPayload as unknown as ReportExportPayload)
      ).toThrow();

      const result = safeGenerateHtmlReport(invalidPayload);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('reflects URL redaction level hostname-only without path or query strings', () => {
      const payload = createRedactedPayload({}, { urlRedactionLevel: 'hostname-only' });
      const html = generateHtmlReport(payload);

      expect(html).toContain('https://haunted-manor.example.com');
      expect(html).not.toContain('/ballroom?page=1');
      expect(html).toContain('URL: hostname-only');
    });

    it('reflects URL redaction level path-only without query strings', () => {
      const payload = createRedactedPayload({}, { urlRedactionLevel: 'path-only' });
      const html = generateHtmlReport(payload);

      expect(html).toContain('https://haunted-manor.example.com/ballroom');
      expect(html).not.toContain('?page=1');
      expect(html).toContain('URL: path-only');
    });

    it('never leaks user credentials or sensitive query parameters', () => {
      const payload = createRedactedPayload({
        tabUrl: 'https://admin:pass123@haunted.example.com/rooms?token=secret123&page=1',
      });
      const html = generateHtmlReport(payload);

      expect(html).not.toContain('pass123');
      expect(html).not.toContain('secret123');
      expect(html).not.toContain('token=');
    });
  });

  describe('9. Correctness & Edge Cases', () => {
    it('renders serene empty state when findings array is empty', () => {
      const payload = createRedactedPayload({
        findings: [],
      });
      const html = generateHtmlReport(payload);

      expect(html).toContain(
        'All Rooms Are Quiet &mdash; Zero Automated Violations Detected'
      );
      expect(html).toContain('No automated accessibility violations were detected');
      expect(html).not.toContain('<article class="finding-card');
      expect(html).not.toContain('<div class="finding-list">');
    });

    it('handles missing optional fields gracefully (completedAt, helpUrl, etc.)', () => {
      const payload = createRedactedPayload({
        completedAt: undefined,
        findings: [
          createMockFinding({
            helpUrl: undefined,
          }),
        ],
      });
      const html = generateHtmlReport(payload);

      expect(html).toContain('Scan Duration');
      expect(html).toContain('N/A');
      expect(html).not.toContain('axe-core rule documentation');
    });

    it('handles large finding collections cleanly and quickly', () => {
      const largeFindings = Array.from({ length: 60 }, (_, i) =>
        createMockFinding({
          fingerprint: `fp-scale-${i}`,
          ruleId: `rule-${i % 5}`,
          description: `Scalability testing issue #${i}`,
        })
      );
      const payload = createRedactedPayload({ findings: largeFindings });
      const startTime = performance.now();
      const html = generateHtmlReport(payload);
      const durationMs = performance.now() - startTime;

      expect(durationMs).toBeLessThan(1500); // Renders cleanly under 1.5s
      expect(html).toContain('Detailed Accessibility Findings (60)');
      expect(html).toContain('Scalability testing issue #59');
    });

    it('properly renders Unicode characters across titles, descriptions, and selectors', () => {
      const payload = createRedactedPayload({
        pageTitle: '呪われた屋敷 — アクセシビリティ診断 👻 (العربية)',
        findings: [
          createMockFinding({
            description: 'Ghostly text in Japanese: コントラスト不足',
          }),
        ],
      });
      const html = generateHtmlReport(payload);

      expect(html).toContain('呪われた屋敷 — アクセシビリティ診断 👻 (العربية)');
      expect(html).toContain('コントラスト不足');
    });

    it('maintains strict input immutability', () => {
      const payload = createRedactedPayload();
      const payloadClone = JSON.parse(JSON.stringify(payload));

      generateHtmlReport(payload);

      expect(payload).toEqual(payloadClone);
    });

    it('is strictly deterministic: identical payloads produce byte-identical HTML', () => {
      const payload1 = createRedactedPayload();
      const payload2 = createRedactedPayload();

      const html1 = generateHtmlReport(payload1);
      const html2 = generateHtmlReport(payload2);

      expect(html1).toBe(html2);
    });

    it('safeGenerateHtmlReport returns typed error on invalid payload without throwing', () => {
      const res = safeGenerateHtmlReport(null);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeInstanceOf(Error);
      }
    });
  });

  describe('10. Property-Based Adversarial Fuzzing (fast-check)', () => {
    it('property test: arbitrary string inputs in dynamic fields never produce active <script> tags or unescaped event handlers', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (randTitle, randSelector, randDesc) => {
            const payload = createRedactedPayload({
              pageTitle: randTitle,
              findings: [
                createMockFinding({
                  description: randDesc,
                  nodes: [
                    {
                      target: [randSelector],
                      failureSummary: 'fuzzed summary',
                      htmlExcerpt: '<div>fuzzed</div>',
                    },
                  ],
                }),
              ],
            });

            const html = generateHtmlReport(payload);

            // Invariant 1: No active unescaped <script tags
            expect(html).not.toMatch(/<script\b[^>]*>/i);

            // Invariant 2: No active unescaped event handlers
            expect(html).not.toMatch(/\s(onload|onerror|onclick|onmouseover)=/i);

            // Invariant 3: Valid document framing
            expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
            expect(html.endsWith('</html>')).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('11. Security Audit Hardening & Trust Boundary Verifications (DEF-821 through DEF-824)', () => {
    it('DEF-821: enforces defense-in-depth URL redaction even if raw unredacted payload bypasses redactor', () => {
      // Intentionally build a payload without running redactReportPayload
      const scan = createMockScan({
        tabUrl:
          'https://admin:pass123@haunted.example.com/sensitive-path?token=leak-secret',
      });
      const rawPayload = buildReportPayload(scan, {
        format: 'html',
        includeHtmlExcerpts: true,
        urlRedactionLevel: 'hostname-only',
        includeRemediationGuidance: true,
      });

      // Pass directly to generateHtmlReport without redactReportPayload
      const html = generateHtmlReport(rawPayload);

      // Defense-in-depth must prevent credential and token leakage
      expect(html).not.toContain('pass123');
      expect(html).not.toContain('leak-secret');
      expect(html).not.toContain('sensitive-path');
      expect(html).toContain('https://haunted.example.com');
    });

    it('DEF-821: enforces excerpt omission when optionsApplied specifies includeHtmlExcerpts: false even if raw excerpts are present', () => {
      const scan = createMockScan();
      const rawPayload = buildReportPayload(scan, {
        format: 'html',
        includeHtmlExcerpts: false,
        urlRedactionLevel: 'full',
      });

      // Manually tamper with payload to inject an excerpt
      rawPayload.findings[0].nodes[0].htmlExcerpt =
        '<button class="raw-unredacted-secret">Leak</button>';

      const html = generateHtmlReport(rawPayload);

      expect(html).not.toContain('raw-unredacted-secret');
      expect(html).toContain('HTML excerpt omitted per export privacy settings.');
    });

    it('DEF-821: enforces remediation guidance omission when optionsApplied specifies includeRemediationGuidance: false', () => {
      const scan = createMockScan();
      const rawPayload = buildReportPayload(scan, {
        format: 'html',
        includeHtmlExcerpts: true,
        urlRedactionLevel: 'full',
        includeRemediationGuidance: false,
      });

      // Manually tamper with payload to inject remediation guidance
      rawPayload.findings[0].remediationRecommendation = {
        summary: 'Sensitive internal developer guidance',
      };

      const html = generateHtmlReport(rawPayload);

      expect(html).not.toContain('Sensitive internal developer guidance');
      expect(html).not.toContain('class="remediation-box"');
    });

    it('DEF-822: checklist inputs do not have aria-hidden="true" and have accessible label associations', () => {
      const payload = createRedactedPayload();
      const html = generateHtmlReport(payload);

      expect(html).not.toContain(
        'class="checklist-checkbox" disabled aria-hidden="true"'
      );
      expect(html).toContain('class="checklist-checkbox" disabled />');
      expect(html).toContain('<label for="check-1" class="checklist-text">');
    });

    it('DEF-823: CSP contains explicit script-src, object-src, and base-uri directives', () => {
      const payload = createRedactedPayload();
      const html = generateHtmlReport(payload);

      expect(html).toContain("script-src 'none'");
      expect(html).toContain("object-src 'none'");
      expect(html).toContain("base-uri 'none'");
    });

    it('DEF-824: renders remediation guidance with semantic <h4> heading for screen-reader hierarchy', () => {
      const remediationPayload: RemediationStoragePayload = {
        'fp-button-spectral-101': {
          fingerprint: 'fp-button-spectral-101',
          ruleId: 'button-name',
          status: 'verified',
          updatedAt: '2026-10-31T20:00:00.000Z',
          notes: 'Fixed aria-label',
        },
      };
      const payload = createRedactedPayload({}, {}, remediationPayload);
      const html = generateHtmlReport(payload);

      expect(html).toContain('<h4 class="remediation-heading">Remediation Guidance</h4>');
    });

    it('DOMParser AST audit: parsed HTML tree contains zero script tags and zero event handlers across all elements', () => {
      const payload = createRedactedPayload({
        pageTitle: '<script>alert(1)</script>',
        findings: [
          createMockFinding({
            description: '<img src=x onerror=alert(2)>',
            help: '<svg onload="alert(3)">',
            nodes: [
              {
                target: ['button[onclick="alert(4)"]'],
                htmlExcerpt: '<div onmouseover="alert(5)">Test</div>',
                failureSummary: '<b onfocus="alert(6)">Error</b>',
              },
            ],
          }),
        ],
      });

      const html = generateHtmlReport(payload);
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Assert 0 script tags exist in parsed DOM
      expect(doc.querySelectorAll('script').length).toBe(0);

      // Assert 0 event handlers exist on any element in the entire document
      const allElements = doc.querySelectorAll('*');
      for (const el of allElements) {
        for (const attr of el.attributes) {
          expect(attr.name.toLowerCase().startsWith('on')).toBe(false);
          expect(attr.value.toLowerCase()).not.toContain('javascript:');
        }
      }

      // Assert all anchors have safe protocols or hash anchors
      const anchors = doc.querySelectorAll('a');
      for (const a of anchors) {
        const href = a.getAttribute('href');
        if (href) {
          expect(
            href.startsWith('http://') ||
              href.startsWith('https://') ||
              href.startsWith('#')
          ).toBe(true);
        }
      }
    });

    it('exportReportToHtml executes end-to-end report preparation and HTML generation from ScanRecord', () => {
      const scan = createMockScan();
      const html = exportReportToHtml(scan, {
        format: 'html',
        includeHtmlExcerpts: true,
        urlRedactionLevel: 'path-only',
        includeRemediationGuidance: true,
      });

      expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
      expect(html).toContain('Phantom Audit Report');
      expect(html).toContain('URL: path-only');
      expect(html.endsWith('</html>')).toBe(true);
    });
  });
});
