import { describe, it, expect } from 'vitest';
import {
  mapRuleToPrinciple,
  groupByRoom,
  groupBySeverity,
  groupByPrinciple,
  groupByReviewStatus,
  computeFindingSummaryStats,
} from '@/features/findings/finding-aggregation';
import type { FindingRecord } from '@/domain/finding';

function makeFinding(
  overrides: Partial<FindingRecord> & { ruleId: string }
): FindingRecord {
  return {
    fingerprint: `fp-${Math.random().toString(36).slice(2)}`,
    ruleId: overrides.ruleId,
    impact: overrides.impact || 'serious',
    description: 'Test finding description',
    help: 'Test finding help',
    wcagTags: overrides.wcagTags || ['wcag2a'],
    roomId: overrides.roomId || 'name-chamber',
    affectedNodeCount: overrides.affectedNodeCount ?? 1,
    nodes: overrides.nodes || [
      {
        target: ['#test'],
        htmlExcerpt: '<div>Test</div>',
        failureSummary: 'Failure reason',
      },
    ],
    firstSeenAt: new Date().toISOString(),
    reviewed: overrides.reviewed ?? false,
    ...overrides,
  };
}

describe('Finding Aggregation Engine', () => {
  describe('mapRuleToPrinciple', () => {
    it('categorizes Perceivable rules correctly', () => {
      expect(mapRuleToPrinciple('color-contrast', ['wcag2aa'])).toBe('perceivable');
      expect(mapRuleToPrinciple('image-alt', ['wcag2a'])).toBe('perceivable');
    });

    it('categorizes Operable rules correctly', () => {
      expect(mapRuleToPrinciple('tabindex', ['wcag2a'])).toBe('operable');
      expect(mapRuleToPrinciple('heading-order', ['best-practice', 'wcag2a'])).toBe(
        'operable'
      );
    });

    it('categorizes Understandable rules correctly', () => {
      expect(mapRuleToPrinciple('button-name', ['wcag2a'])).toBe('understandable');
      expect(mapRuleToPrinciple('label', ['wcag2a'])).toBe('understandable');
    });

    it('categorizes Robust rules correctly', () => {
      expect(mapRuleToPrinciple('aria-roles', ['wcag2a'])).toBe('robust');
      expect(mapRuleToPrinciple('aria-valid-attr', ['wcag2a'])).toBe('robust');
    });

    it('identifies pure Advisory Best Practice rules without WCAG tags', () => {
      expect(mapRuleToPrinciple('custom-rule', ['best-practice'])).toBe('best-practice');
    });
  });

  describe('groupByRoom', () => {
    it('groups findings non-destructively by room', () => {
      const findings = [
        makeFinding({ ruleId: 'button-name', roomId: 'name-chamber' }),
        makeFinding({ ruleId: 'link-name', roomId: 'name-chamber' }),
        makeFinding({ ruleId: 'color-contrast', roomId: 'contrast-crypt' }),
        makeFinding({ ruleId: 'image-alt', roomId: 'portrait-gallery' }),
      ];

      const grouped = groupByRoom(findings);
      expect(grouped['name-chamber']).toHaveLength(2);
      expect(grouped['contrast-crypt']).toHaveLength(1);
      expect(grouped['portrait-gallery']).toHaveLength(1);
      expect(grouped['form-cellar']).toHaveLength(0);
      expect(grouped['structure-hall']).toHaveLength(0);
      expect(grouped['focus-corridor']).toHaveLength(0);
      expect(grouped.other).toHaveLength(0);

      // Verify non-destructive invariant: total grouped items equals original count
      const totalGrouped = Object.values(grouped).reduce(
        (sum, arr) => sum + arr.length,
        0
      );
      expect(totalGrouped).toBe(findings.length);
    });
  });

  describe('groupBySeverity', () => {
    it('groups findings by impact level', () => {
      const findings = [
        makeFinding({ ruleId: 'r1', impact: 'critical' }),
        makeFinding({ ruleId: 'r2', impact: 'serious' }),
        makeFinding({ ruleId: 'r3', impact: 'serious' }),
        makeFinding({ ruleId: 'r4', impact: 'minor' }),
      ];

      const grouped = groupBySeverity(findings);
      expect(grouped.critical).toHaveLength(1);
      expect(grouped.serious).toHaveLength(2);
      expect(grouped.moderate).toHaveLength(0);
      expect(grouped.minor).toHaveLength(1);
      expect(grouped.unknown).toHaveLength(0);
    });
  });

  describe('groupByPrinciple', () => {
    it('groups findings by WCAG principle (POUR)', () => {
      const findings = [
        makeFinding({ ruleId: 'color-contrast', wcagTags: ['wcag2aa'] }),
        makeFinding({ ruleId: 'button-name', wcagTags: ['wcag2a'] }),
        makeFinding({ ruleId: 'custom-tip', wcagTags: ['best-practice'] }),
      ];

      const grouped = groupByPrinciple(findings);
      expect(grouped.perceivable).toHaveLength(1);
      expect(grouped.understandable).toHaveLength(1);
      expect(grouped['best-practice']).toHaveLength(1);
    });
  });

  describe('groupByReviewStatus', () => {
    it('splits findings into reviewed and unreviewed', () => {
      const findings = [
        makeFinding({ ruleId: 'r1', reviewed: true }),
        makeFinding({ ruleId: 'r2', reviewed: false }),
        makeFinding({ ruleId: 'r3', reviewed: true }),
      ];

      const { reviewed, unreviewed } = groupByReviewStatus(findings);
      expect(reviewed).toHaveLength(2);
      expect(unreviewed).toHaveLength(1);
    });
  });

  describe('computeFindingSummaryStats', () => {
    it('computes accurate totals and breakdowns', () => {
      const findings = [
        makeFinding({
          ruleId: 'button-name',
          roomId: 'name-chamber',
          impact: 'critical',
          affectedNodeCount: 3,
          reviewed: true,
          wcagTags: ['wcag2a'],
        }),
        makeFinding({
          ruleId: 'color-contrast',
          roomId: 'contrast-crypt',
          impact: 'serious',
          affectedNodeCount: 2,
          reviewed: false,
          wcagTags: ['wcag2aa'],
        }),
        makeFinding({
          ruleId: 'heading-order',
          roomId: 'structure-hall',
          impact: 'minor',
          affectedNodeCount: 1,
          reviewed: false,
          wcagTags: ['best-practice'],
        }),
      ];

      const stats = computeFindingSummaryStats(findings);

      expect(stats.totalFindings).toBe(3);
      expect(stats.totalAffectedNodes).toBe(6);
      expect(stats.reviewedCount).toBe(1);
      expect(stats.unreviewedCount).toBe(2);
      expect(stats.conformanceCount).toBe(2);
      expect(stats.advisoryCount).toBe(1);

      expect(stats.byImpact.critical).toBe(1);
      expect(stats.byImpact.serious).toBe(1);
      expect(stats.byImpact.minor).toBe(1);

      expect(stats.byRoom['name-chamber']).toBe(1);
      expect(stats.byRoom['contrast-crypt']).toBe(1);
      expect(stats.byRoom['structure-hall']).toBe(1);
    });
  });
});
