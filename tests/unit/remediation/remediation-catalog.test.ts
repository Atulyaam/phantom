import { describe, it, expect } from 'vitest';
import {
  REMEDIATION_CATALOG,
  getCatalogGuidance,
  hasCatalogGuidance,
} from '@/features/remediation/remediation-catalog';
import { RemediationGuidanceSchema } from '@/lib/validation/schemas';

describe('Remediation Rule Catalog', () => {
  const EXPECTED_NORMATIVE_RULES = [
    'button-name',
    'link-name',
    'color-contrast',
    'image-alt',
    'svg-img-alt',
    'label',
    'select-name',
  ];

  const EXPECTED_BEST_PRACTICE_RULES = ['heading-order', 'landmark-one-main', 'tabindex'];

  const ALL_RULES = [...EXPECTED_NORMATIVE_RULES, ...EXPECTED_BEST_PRACTICE_RULES];

  it('contains exactly the 10 curated rules approved for Phase 6', () => {
    const catalogKeys = Object.keys(REMEDIATION_CATALOG).sort();
    expect(catalogKeys).toEqual(ALL_RULES.sort());
    expect(catalogKeys.length).toBe(10);
  });

  it('validates every catalog entry against RemediationGuidanceSchema', () => {
    for (const [ruleId, entry] of Object.entries(REMEDIATION_CATALOG)) {
      expect(entry.ruleId).toBe(ruleId);
      const parsed = RemediationGuidanceSchema.safeParse(entry);
      if (!parsed.success) {
        throw new Error(
          `Catalog rule "${ruleId}" failed schema validation: ${JSON.stringify(
            parsed.error.format()
          )}`
        );
      }
      expect(parsed.success).toBe(true);
    }
  });

  describe('Normative WCAG Rules Classification', () => {
    for (const ruleId of EXPECTED_NORMATIVE_RULES) {
      it(`accurately classifies "${ruleId}" as normative-wcag with Level A or AA`, () => {
        const entry = REMEDIATION_CATALOG[ruleId];
        expect(entry).toBeDefined();
        expect(entry.classification).toBe('normative-wcag');
        expect(['A', 'AA']).toContain(entry.wcagLevel);
        expect(entry.wcagCriterion).toBeDefined();
        expect(entry.wcagCriterion?.length).toBeGreaterThan(0);
      });
    }
  });

  describe('Best Practice Rules Classification (Axe Heuristics)', () => {
    for (const ruleId of EXPECTED_BEST_PRACTICE_RULES) {
      it(`accurately classifies "${ruleId}" as best-practice with Advisory level`, () => {
        const entry = REMEDIATION_CATALOG[ruleId];
        expect(entry).toBeDefined();
        expect(entry.classification).toBe('best-practice');
        expect(entry.wcagLevel).toBe('Advisory');
        expect(entry.wcagCriterion).toMatch(/^Advisory/);
      });
    }
  });

  describe('Content Completeness & Pedagogical Quality', () => {
    for (const [ruleId, entry] of Object.entries(REMEDIATION_CATALOG)) {
      describe(`Rule: ${ruleId}`, () => {
        it('has substantial and clear explanations', () => {
          expect(entry.title.length).toBeGreaterThan(10);
          expect(entry.whyItMatters.length).toBeGreaterThan(30);
          expect(entry.rootCauseAnalysis.length).toBeGreaterThan(20);
        });

        it('has at least one human impact describing user consequences', () => {
          expect(entry.humanImpacts.length).toBeGreaterThanOrEqual(1);
          for (const impact of entry.humanImpacts) {
            expect(impact.userGroup.length).toBeGreaterThan(2);
            expect(impact.consequence.length).toBeGreaterThan(10);
          }
        });

        it('provides a bad example with snippet and reason', () => {
          expect(entry.badExample.snippet.trim().length).toBeGreaterThan(0);
          expect(entry.badExample.reason.trim().length).toBeGreaterThan(10);
        });

        it('provides good examples with at least one marked primary', () => {
          expect(entry.goodExamples.length).toBeGreaterThanOrEqual(2);
          const primarySnippets = entry.goodExamples.filter((g) => g.isPrimary);
          expect(primarySnippets.length).toBe(1);
          for (const snippet of entry.goodExamples) {
            expect(snippet.code.trim().length).toBeGreaterThan(0);
            expect(snippet.title.trim().length).toBeGreaterThan(0);
            expect(snippet.explanation.trim().length).toBeGreaterThan(0);
            expect(['html', 'react', 'css']).toContain(snippet.language);
          }
        });

        it('provides common pitfalls and actionable verification steps', () => {
          expect(entry.potentialPitfalls.length).toBeGreaterThanOrEqual(1);
          expect(entry.verificationSteps.length).toBeGreaterThanOrEqual(1);
          for (const step of entry.verificationSteps) {
            expect(step.instruction.length).toBeGreaterThan(5);
            expect(step.expectedResult.length).toBeGreaterThan(5);
            expect([
              'visual',
              'screen-reader',
              'keyboard',
              'devtools',
              'rescan',
            ]).toContain(step.method);
          }
        });

        it('has a valid Deque University reference URL for axe 4.14', () => {
          expect(entry.officialDocUrl).toMatch(
            /^https:\/\/dequeuniversity\.com\/rules\/axe\/4\.14\//
          );
        });
      });
    }
  });

  describe('Lookup Utilities (getCatalogGuidance & hasCatalogGuidance)', () => {
    it('retrieves entries with exact matching', () => {
      const guidance = getCatalogGuidance('button-name');
      expect(guidance).toBeDefined();
      expect(guidance?.ruleId).toBe('button-name');
      expect(hasCatalogGuidance('button-name')).toBe(true);
    });

    it('retrieves entries case-insensitively and trims whitespace', () => {
      const guidance = getCatalogGuidance('  BUTTON-NAME  ');
      expect(guidance).toBeDefined();
      expect(guidance?.ruleId).toBe('button-name');
      expect(hasCatalogGuidance('  BUTTON-NAME  ')).toBe(true);
    });

    it('returns undefined and false for unmapped rules', () => {
      expect(getCatalogGuidance('custom-unknown-rule')).toBeUndefined();
      expect(hasCatalogGuidance('custom-unknown-rule')).toBe(false);
    });

    it('handles falsy or empty inputs gracefully', () => {
      // @ts-expect-error Testing runtime edge cases
      expect(getCatalogGuidance(null)).toBeUndefined();
      // @ts-expect-error Testing runtime edge cases
      expect(getCatalogGuidance(undefined)).toBeUndefined();
      expect(getCatalogGuidance('')).toBeUndefined();
      expect(getCatalogGuidance('   ')).toBeUndefined();
      expect(hasCatalogGuidance('')).toBe(false);
    });
  });
});
