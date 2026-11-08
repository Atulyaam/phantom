import { describe, it, expect } from 'vitest';
import {
  normalizeScanResults,
  normalizeImpact,
  sanitizeHelpUrl,
  extractHostname,
} from '@/features/normalization/axe-normalizer';
import type { InPageScanOutput } from '@/features/scanner/in-page-runner';
import { ScanRecordSchema } from '@/lib/validation/schemas';

describe('axe-normalizer', () => {
  it('normalizes raw impact values safely', () => {
    expect(normalizeImpact('critical')).toBe('critical');
    expect(normalizeImpact('SERIOUS')).toBe('serious');
    expect(normalizeImpact('moderate ')).toBe('moderate');
    expect(normalizeImpact('minor')).toBe('minor');
    expect(normalizeImpact(undefined)).toBe('unknown');
    expect(normalizeImpact('exaggerated')).toBe('unknown');
  });

  it('sanitizes help URLs and rejects non-http protocols', () => {
    expect(
      sanitizeHelpUrl('https://dequeuniversity.com/rules/axe/4.14/button-name')
    ).toBe('https://dequeuniversity.com/rules/axe/4.14/button-name');
    expect(sanitizeHelpUrl('javascript:alert(1)')).toBeUndefined();
    expect(sanitizeHelpUrl('')).toBeUndefined();
    expect(sanitizeHelpUrl(undefined)).toBeUndefined();
    expect(sanitizeHelpUrl('invalid-url-string')).toBeUndefined();
  });

  it('extracts hostnames accurately from standard URLs', () => {
    expect(extractHostname('https://phantom-mansion.dev/haunted-hall?ghost=1')).toBe(
      'phantom-mansion.dev'
    );
    expect(extractHostname('http://localhost:3000/test')).toBe('localhost');
    expect(extractHostname('invalid')).toBe('unknown-host');
  });

  it('normalizes InPageScanOutput into a strictly validated ScanRecord', () => {
    const mockOutput: InPageScanOutput = {
      violations: [
        {
          id: 'button-name',
          description: 'Buttons must have discernible text',
          help: 'Critical interactive name requirement',
          helpUrl: 'https://dequeuniversity.com/rules/axe/button-name',
          impact: 'critical',
          tags: ['wcag2a', 'wcag412', 'section508'],
          nodes: [
            {
              target: ['#ghost-btn', 'button.icon'],
              html: '<button id="ghost-btn"><span>👻</span></button>',
              failureSummary: 'Fix any of the following: Element has no text',
            },
          ],
        },
        {
          id: 'unknown-future-rule',
          description: 'Future unmapped rule',
          help: 'Unmapped rule description',
          impact: null,
          tags: ['best-practice'],
          nodes: [
            {
              target: ['.somewhere'],
              html: '<div>Unmapped</div>',
              failureSummary: 'Failure',
            },
          ],
        },
      ],
      incomplete: [
        {
          id: 'color-contrast',
          description: 'Color contrast needs manual inspection',
          help: 'Check gradient background manually',
          impact: 'moderate',
          tags: ['wcag2aa'],
          nodes: [],
        },
      ],
      passesCount: 14,
      incompleteCount: 1,
      inapplicableCount: 32,
      pageTitle: 'Test Active Page',
      url: 'https://example.com/test',
      axeVersion: '4.14.0',
    };

    const record = normalizeScanResults(mockOutput, {
      tabUrl: 'https://example.com/test',
      pageTitle: 'Test Active Page',
      browserName: 'chrome',
    });

    // Verify Zod schema validation passes without throwing
    const validated = ScanRecordSchema.parse(record);
    expect(validated.id).toBeDefined();
    expect(validated.schemaVersion).toBe(1);
    expect(validated.hostname).toBe('example.com');
    expect(validated.axeVersion).toBe('4.14.0');
    expect(validated.passesCount).toBe(14);
    expect(validated.incompleteChecksCount).toBe(1);
    expect(validated.inapplicableCount).toBe(32);
    expect(validated.findings).toHaveLength(2);

    // Verify button-name is mapped to name-chamber
    const buttonFinding = validated.findings.find((f) => f.ruleId === 'button-name');
    expect(buttonFinding).toBeDefined();
    expect(buttonFinding?.roomId).toBe('name-chamber');
    expect(buttonFinding?.impact).toBe('critical');
    expect(buttonFinding?.fingerprint).toMatch(/^v1:button-name:/);
    expect(buttonFinding?.affectedNodeCount).toBe(1);

    // Verify unknown-future-rule is mapped to other
    const unmappedFinding = validated.findings.find(
      (f) => f.ruleId === 'unknown-future-rule'
    );
    expect(unmappedFinding).toBeDefined();
    expect(unmappedFinding?.roomId).toBe('other');
    expect(unmappedFinding?.impact).toBe('unknown');
  });

  it('preserves totalNodeCount when node list is truncated to 20', () => {
    const mockTruncated: InPageScanOutput = {
      violations: [
        {
          id: 'image-alt',
          description: 'Images must have alt text',
          help: 'Image alt requirement',
          impact: 'critical',
          tags: ['wcag2a'],
          nodes: Array.from({ length: 20 }, (_, i) => ({
            target: [`img:nth-of-type(${i + 1})`],
            html: '<img src="photo.jpg">',
            failureSummary: 'Missing alt',
          })),
          totalNodeCount: 45, // Total count on page was 45
        },
      ],
      incomplete: [],
      passesCount: 5,
      incompleteCount: 0,
      inapplicableCount: 0,
      pageTitle: 'Photo Gallery',
      url: 'https://gallery.example.com',
      axeVersion: '4.14.0',
    };

    const record = normalizeScanResults(mockTruncated, {
      tabUrl: 'https://gallery.example.com',
    });

    expect(record.findings).toHaveLength(1);
    expect(record.findings[0].nodes).toHaveLength(20);
    expect(record.findings[0].affectedNodeCount).toBe(45);
  });

  it('safely handles empty violations and clean baseline results', () => {
    const cleanOutput: InPageScanOutput = {
      violations: [],
      incomplete: [],
      passesCount: 25,
      incompleteCount: 0,
      inapplicableCount: 40,
      pageTitle: 'Clean Sanctuary',
      url: 'https://sanctuary.example.org',
      axeVersion: '4.14.0',
    };

    const record = normalizeScanResults(cleanOutput, {
      tabUrl: 'https://sanctuary.example.org',
      pageTitle: 'Clean Sanctuary',
    });

    expect(record.findings).toHaveLength(0);
    expect(record.passesCount).toBe(25);
    expect(record.status).toBe('completed');
  });
});
