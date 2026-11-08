import { describe, it, expect } from 'vitest';
import {
  isAdvisoryFinding,
  matchesSearchQuery,
  filterAndSortFindings,
} from '@/features/findings/finding-filters';
import type { FindingRecord } from '@/domain/finding';

function createTestFinding(
  overrides: Partial<FindingRecord> & { ruleId: string }
): FindingRecord {
  return {
    fingerprint: `v1:${overrides.ruleId}:${overrides.roomId || 'room'}-${Math.random()}`,
    ruleId: overrides.ruleId,
    impact: overrides.impact || 'serious',
    description: overrides.description || 'Test description',
    help: overrides.help || 'Test help',
    wcagTags: overrides.wcagTags || ['wcag2a'],
    roomId: overrides.roomId || 'name-chamber',
    affectedNodeCount: overrides.affectedNodeCount ?? 1,
    nodes: overrides.nodes || [
      {
        target: ['#test-element'],
        htmlExcerpt: '<button>Click</button>',
        failureSummary: 'Missing label',
      },
    ],
    firstSeenAt: new Date().toISOString(),
    reviewed: overrides.reviewed ?? false,
    ...overrides,
  };
}

describe('Finding Filters & Multi-Dimensional Sorter', () => {
  describe('isAdvisoryFinding', () => {
    it('returns true when rule has best-practice and no wcag tag', () => {
      const f = createTestFinding({
        ruleId: 'heading-order',
        wcagTags: ['best-practice'],
      });
      expect(isAdvisoryFinding(f)).toBe(true);
    });

    it('returns false when rule includes wcag tag even if best-practice is also present', () => {
      const f = createTestFinding({
        ruleId: 'color-contrast',
        wcagTags: ['wcag2aa', 'best-practice'],
      });
      expect(isAdvisoryFinding(f)).toBe(false);
    });
  });

  describe('matchesSearchQuery', () => {
    const finding = createTestFinding({
      ruleId: 'button-name',
      help: 'Buttons must have discernible text',
      description: 'Ensures buttons have accessible names',
      nodes: [
        {
          target: ['header > button.icon-close'],
          htmlExcerpt: '<button class="icon-close"></button>',
          failureSummary: 'Fix any of the following: Element does not have inner text',
        },
      ],
    });

    it('matches ruleId case-insensitively', () => {
      expect(matchesSearchQuery(finding, 'BUTTON')).toBe(true);
      expect(matchesSearchQuery(finding, 'button-name')).toBe(true);
    });

    it('matches help or description text', () => {
      expect(matchesSearchQuery(finding, 'discernible')).toBe(true);
      expect(matchesSearchQuery(finding, 'accessible names')).toBe(true);
    });

    it('matches target selector strings', () => {
      expect(matchesSearchQuery(finding, 'icon-close')).toBe(true);
      expect(matchesSearchQuery(finding, 'header > button')).toBe(true);
    });

    it('matches failure summary details', () => {
      expect(matchesSearchQuery(finding, 'inner text')).toBe(true);
    });

    it('returns false when no fields match', () => {
      expect(matchesSearchQuery(finding, 'contrast ratio 4.5:1')).toBe(false);
    });

    it('returns true for empty or whitespace query', () => {
      expect(matchesSearchQuery(finding, '')).toBe(true);
      expect(matchesSearchQuery(finding, '   ')).toBe(true);
    });
  });

  describe('filterAndSortFindings', () => {
    const list: FindingRecord[] = [
      createTestFinding({
        ruleId: 'color-contrast',
        impact: 'serious',
        roomId: 'contrast-crypt',
        affectedNodeCount: 5,
        reviewed: false,
        wcagTags: ['wcag2aa'],
      }),
      createTestFinding({
        ruleId: 'button-name',
        impact: 'critical',
        roomId: 'name-chamber',
        affectedNodeCount: 1,
        reviewed: true,
        wcagTags: ['wcag2a'],
      }),
      createTestFinding({
        ruleId: 'heading-order',
        impact: 'minor',
        roomId: 'structure-hall',
        affectedNodeCount: 2,
        reviewed: false,
        wcagTags: ['best-practice'],
      }),
      createTestFinding({
        ruleId: 'link-name',
        impact: 'serious',
        roomId: 'name-chamber',
        affectedNodeCount: 3,
        reviewed: true,
        wcagTags: ['wcag2a'],
      }),
    ];

    it('filters by room correctly', () => {
      const res = filterAndSortFindings(list, { room: 'name-chamber' });
      expect(res).toHaveLength(2);
      expect(res.every((f) => f.roomId === 'name-chamber')).toBe(true);
    });

    it('filters by impacts correctly', () => {
      const res = filterAndSortFindings(list, { impacts: ['critical', 'minor'] });
      expect(res).toHaveLength(2);
      expect(res.map((f) => f.ruleId).sort()).toEqual(['button-name', 'heading-order']);
    });

    it('filters by conformance (wcag vs advisory)', () => {
      const wcagOnly = filterAndSortFindings(list, { conformance: 'wcag' });
      expect(wcagOnly).toHaveLength(3);
      expect(wcagOnly.some((f) => f.ruleId === 'heading-order')).toBe(false);

      const advisoryOnly = filterAndSortFindings(list, { conformance: 'advisory' });
      expect(advisoryOnly).toHaveLength(1);
      expect(advisoryOnly[0].ruleId).toBe('heading-order');
    });

    it('filters by review status', () => {
      const reviewedOnly = filterAndSortFindings(list, { reviewStatus: 'reviewed' });
      expect(reviewedOnly).toHaveLength(2);
      expect(reviewedOnly.every((f) => f.reviewed)).toBe(true);

      const unreviewedOnly = filterAndSortFindings(list, {
        reviewStatus: 'unreviewed',
      });
      expect(unreviewedOnly).toHaveLength(2);
      expect(unreviewedOnly.every((f) => !f.reviewed)).toBe(true);
    });

    it('sorts by severity descending (default)', () => {
      const res = filterAndSortFindings(list, { sortBy: 'severity-desc' });
      expect(res[0].impact).toBe('critical');
      expect(res[res.length - 1].impact).toBe('minor');
    });

    it('sorts by severity ascending', () => {
      const res = filterAndSortFindings(list, { sortBy: 'severity-asc' });
      expect(res[0].impact).toBe('minor');
      expect(res[res.length - 1].impact).toBe('critical');
    });

    it('sorts by ruleId alphabetically', () => {
      const res = filterAndSortFindings(list, { sortBy: 'rule-asc' });
      expect(res.map((f) => f.ruleId)).toEqual([
        'button-name',
        'color-contrast',
        'heading-order',
        'link-name',
      ]);
    });

    it('sorts by affected node count descending', () => {
      const res = filterAndSortFindings(list, { sortBy: 'nodes-desc' });
      expect(res[0].affectedNodeCount).toBe(5); // color-contrast
      expect(res[1].affectedNodeCount).toBe(3); // link-name
      expect(res[2].affectedNodeCount).toBe(2); // heading-order
      expect(res[3].affectedNodeCount).toBe(1); // button-name
    });

    it('does not mutate the source array (immutability check)', () => {
      const originalCopy = [...list];
      filterAndSortFindings(list, { sortBy: 'nodes-desc' });
      expect(list).toEqual(originalCopy);
    });
  });
});
