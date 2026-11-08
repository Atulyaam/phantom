import { describe, it, expect } from 'vitest';
import {
  extractPrimaryTag,
  evaluateUncertainMatch,
  compareScans,
} from '@/features/comparison/scan-comparator';
import type { ScanRecord } from '@/domain/scan';
import type { FindingRecord } from '@/domain/finding';

function createMockFinding(
  overrides: Partial<FindingRecord> & { ruleId: string; target: string }
): FindingRecord {
  const { ruleId, target, ...rest } = overrides;
  return {
    fingerprint: `v1:${ruleId}:${target}`,
    ruleId,
    impact: 'serious',
    description: `Description for ${ruleId}`,
    help: `Fix ${ruleId}`,
    wcagTags: ['wcag2a', 'wcag111'],
    roomId: 'name-chamber',
    affectedNodeCount: 1,
    nodes: [
      {
        target: [target],
        htmlExcerpt: `<${target.split(/[\s.#[]/)[0]}>Test</>`,
        failureSummary: `Fix problem on ${target}`,
      },
    ],
    firstSeenAt: new Date().toISOString(),
    reviewed: false,
    ...rest,
  };
}

function createMockScan(findings: FindingRecord[], id = 'scan-1'): ScanRecord {
  return {
    id,
    schemaVersion: 1,
    tabUrl: 'https://example.com/test',
    pageTitle: 'Test Page',
    hostname: 'example.com',
    scannedAt: new Date().toISOString(),
    axeVersion: '4.14.0',
    extensionVersion: '0.1.0',
    browserName: 'chrome',
    status: 'completed',
    findings,
    incompleteChecksCount: 0,
    passesCount: 10,
    inapplicableCount: 5,
  };
}

describe('Cross-Scan Comparison Engine', () => {
  describe('extractPrimaryTag', () => {
    it('extracts HTML tag names from various selector formats', () => {
      expect(extractPrimaryTag('button.btn-primary')).toBe('button');
      expect(extractPrimaryTag('nav > ul > li a')).toBe('a');
      expect(extractPrimaryTag('input#user-name')).toBe('input');
      expect(extractPrimaryTag('header div.container section p:first-of-type')).toBe('p');
      expect(extractPrimaryTag('#main-content')).toBe('');
      expect(extractPrimaryTag('.custom-card')).toBe('');
      expect(extractPrimaryTag('')).toBe('');
    });
  });

  describe('evaluateUncertainMatch', () => {
    it('matches elements of same tag when selector shifts under same rule and room', () => {
      const base = createMockFinding({
        ruleId: 'button-name',
        target: 'button#btn-old',
        roomId: 'name-chamber',
      });
      const candidate = createMockFinding({
        ruleId: 'button-name',
        target: 'div.wrapper > button.btn-new',
        roomId: 'name-chamber',
      });

      const match = evaluateUncertainMatch(base, candidate);
      expect(match.isMatch).toBe(true);
      expect(match.confidence).toBe('high');
      expect(match.reason).toContain('matching <button> element');
    });

    it('rejects candidates with differing ruleId or roomId', () => {
      const base = createMockFinding({
        ruleId: 'button-name',
        target: 'button#submit',
        roomId: 'name-chamber',
      });
      const diffRule = createMockFinding({
        ruleId: 'color-contrast',
        target: 'button#submit',
        roomId: 'contrast-crypt',
      });
      const diffRoom = createMockFinding({
        ruleId: 'button-name',
        target: 'button#submit',
        roomId: 'focus-corridor',
      });

      expect(evaluateUncertainMatch(base, diffRule).isMatch).toBe(false);
      expect(evaluateUncertainMatch(base, diffRoom).isMatch).toBe(false);
    });

    it('matches medium confidence when failure summary is identical even if tag is non-standard', () => {
      const base = createMockFinding({
        ruleId: 'aria-valid-attr',
        target: '#widget-1',
        roomId: 'structure-hall',
        nodes: [
          {
            target: ['#widget-1'],
            htmlExcerpt: '<div>Widget</div>',
            failureSummary: 'Attribute aria-xyz is not valid',
          },
        ],
      });
      const candidate = createMockFinding({
        ruleId: 'aria-valid-attr',
        target: '#widget-2',
        roomId: 'structure-hall',
        nodes: [
          {
            target: ['#widget-2'],
            htmlExcerpt: '<div>Widget</div>',
            failureSummary: 'Attribute aria-xyz is not valid',
          },
        ],
      });

      const match = evaluateUncertainMatch(base, candidate);
      expect(match.isMatch).toBe(true);
      expect(match.confidence).toBe('medium');
      expect(match.reason).toContain('identical failure summary');
    });
  });

  describe('compareScans', () => {
    it('handles 100% resolved state correctly', () => {
      const f1 = createMockFinding({
        ruleId: 'image-alt',
        target: 'img#hero',
        roomId: 'portrait-gallery',
      });
      const f2 = createMockFinding({
        ruleId: 'color-contrast',
        target: 'p.body',
        roomId: 'contrast-crypt',
      });
      const baseScan = createMockScan([f1, f2], 'scan-base');
      const rescan = createMockScan([], 'scan-rescan');

      const result = compareScans(baseScan, rescan);

      expect(result.resolved).toHaveLength(2);
      expect(result.unchanged).toHaveLength(0);
      expect(result.newFindings).toHaveLength(0);
      expect(result.uncertainMatches).toHaveLength(0);
      expect(result.metrics?.improvementScore).toBe(100);
      expect(result.metrics?.netProgress).toBe(2);
    });

    it('handles 100% unchanged state correctly', () => {
      const f1 = createMockFinding({
        ruleId: 'image-alt',
        target: 'img#hero',
        roomId: 'portrait-gallery',
      });
      const baseScan = createMockScan([f1], 'scan-base');
      const rescan = createMockScan([f1], 'scan-rescan');

      const result = compareScans(baseScan, rescan);

      expect(result.resolved).toHaveLength(0);
      expect(result.unchanged).toHaveLength(1);
      expect(result.newFindings).toHaveLength(0);
      expect(result.metrics?.improvementScore).toBe(0);
      expect(result.metrics?.netProgress).toBe(0);
    });

    it('detects new regressions and handles negative net progress', () => {
      const f1 = createMockFinding({
        ruleId: 'image-alt',
        target: 'img#hero',
        roomId: 'portrait-gallery',
      });
      const f2 = createMockFinding({
        ruleId: 'button-name',
        target: 'button#btn-new',
        roomId: 'name-chamber',
      });
      const f3 = createMockFinding({
        ruleId: 'color-contrast',
        target: 'span.warn',
        roomId: 'contrast-crypt',
      });

      const baseScan = createMockScan([f1], 'scan-base');
      const rescan = createMockScan([f1, f2, f3], 'scan-rescan');

      const result = compareScans(baseScan, rescan);

      expect(result.unchanged).toHaveLength(1);
      expect(result.resolved).toHaveLength(0);
      expect(result.newFindings).toHaveLength(2);
      expect(result.metrics?.newCount).toBe(2);
      expect(result.metrics?.netProgress).toBe(-2);
      expect(result.metrics?.improvementScore).toBe(0);
    });

    it('CRITICAL: Never marks finding resolved when element selector shifted (identifies uncertain match)', () => {
      const baseFinding = createMockFinding({
        ruleId: 'button-name',
        target: 'button.old-class',
        roomId: 'name-chamber',
      });
      const rescanFinding = createMockFinding({
        ruleId: 'button-name',
        target: 'button.new-class',
        roomId: 'name-chamber',
      });

      const baseScan = createMockScan([baseFinding], 'scan-base');
      const rescan = createMockScan([rescanFinding], 'scan-rescan');

      const result = compareScans(baseScan, rescan);

      // Must NOT be classified as resolved!
      expect(result.resolved).toHaveLength(0);
      expect(result.newFindings).toHaveLength(0);
      expect(result.uncertainMatches).toHaveLength(1);
      expect(result.uncertainMatches?.[0].baselineFinding.fingerprint).toBe(
        baseFinding.fingerprint
      );
      expect(result.metrics?.uncertainCount).toBe(1);
      expect(result.metrics?.resolvedCount).toBe(0);
      expect(result.metrics?.improvementScore).toBe(0);
    });

    it('maintains strict set partition invariant across all findings', () => {
      const fUnchanged = createMockFinding({
        ruleId: 'image-alt',
        target: 'img.logo',
        roomId: 'portrait-gallery',
      });
      const fResolved = createMockFinding({
        ruleId: 'color-contrast',
        target: 'p.sub',
        roomId: 'contrast-crypt',
      });
      const fUncertainBase = createMockFinding({
        ruleId: 'button-name',
        target: 'button#btn1',
        roomId: 'name-chamber',
      });
      const fUncertainRescan = createMockFinding({
        ruleId: 'button-name',
        target: 'form > button#btn1',
        roomId: 'name-chamber',
      });
      const fNew = createMockFinding({
        ruleId: 'link-name',
        target: 'a.readmore',
        roomId: 'name-chamber',
      });

      const baseScan = createMockScan([fUnchanged, fResolved, fUncertainBase], 'scan-1');
      const rescan = createMockScan([fUnchanged, fUncertainRescan, fNew], 'scan-2');

      const result = compareScans(baseScan, rescan);
      const metrics = result.metrics!;

      // Partition invariant:
      // resolved + unchanged + uncertain === baselineTotal
      expect(
        metrics.resolvedCount + metrics.unchangedCount + metrics.uncertainCount
      ).toBe(metrics.baselineTotal);
      // unchanged + new + uncertain === rescanTotal
      expect(metrics.unchangedCount + metrics.newCount + metrics.uncertainCount).toBe(
        metrics.rescanTotal
      );
    });
  });
});
