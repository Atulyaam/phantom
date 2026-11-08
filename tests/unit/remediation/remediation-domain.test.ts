import { describe, it, expect } from 'vitest';
import {
  RemediationStatusSchema,
  RuleClassificationSchema,
  CodeSnippetSchema,
  HumanImpactSchema,
  VerificationStepSchema,
  RemediationGuidanceSchema,
  StoredRemediationRecordSchema,
  RemediationStoragePayloadSchema,
  ScanVerificationOutcomeTypeSchema,
  ScanVerificationResultSchema,
} from '@/lib/validation/schemas';

describe('Remediation Domain & Validation Schemas', () => {
  describe('RemediationStatusSchema', () => {
    it('accepts all valid remediation status values', () => {
      expect(RemediationStatusSchema.parse('suggested')).toBe('suggested');
      expect(RemediationStatusSchema.parse('attempted')).toBe('attempted');
      expect(RemediationStatusSchema.parse('verified')).toBe('verified');
      expect(RemediationStatusSchema.parse('unresolved')).toBe('unresolved');
    });

    it('rejects invalid or arbitrary statuses', () => {
      expect(() => RemediationStatusSchema.parse('fixed')).toThrow();
      expect(() => RemediationStatusSchema.parse('completed')).toThrow();
      expect(() => RemediationStatusSchema.parse('in-progress')).toThrow();
      expect(() => RemediationStatusSchema.parse('')).toThrow();
    });
  });

  describe('RuleClassificationSchema', () => {
    it('accepts strictly normative-wcag and best-practice', () => {
      expect(RuleClassificationSchema.parse('normative-wcag')).toBe('normative-wcag');
      expect(RuleClassificationSchema.parse('best-practice')).toBe('best-practice');
      expect(() => RuleClassificationSchema.parse('custom')).toThrow();
    });
  });

  describe('CodeSnippetSchema', () => {
    it('validates compliant code snippet objects', () => {
      const validSnippet = {
        language: 'html' as const,
        title: 'Native Button Text',
        code: '<button type="button">Close</button>',
        explanation: 'Provides accessible name via visible text.',
        isPrimary: true,
      };

      expect(CodeSnippetSchema.parse(validSnippet)).toEqual(validSnippet);
    });

    it('rejects unsupported snippet languages and empty code', () => {
      expect(() =>
        CodeSnippetSchema.parse({
          language: 'python',
          title: 'Title',
          code: 'print(1)',
          explanation: 'Desc',
        })
      ).toThrow();

      expect(() =>
        CodeSnippetSchema.parse({
          language: 'html',
          title: '',
          code: '',
          explanation: 'Desc',
        })
      ).toThrow();
    });

    it('rejects oversized snippet code (> 5000 chars)', () => {
      expect(() =>
        CodeSnippetSchema.parse({
          language: 'html',
          title: 'Big',
          code: 'a'.repeat(5001),
          explanation: 'Desc',
        })
      ).toThrow();
    });
  });

  describe('HumanImpactSchema', () => {
    it('validates human impact assessments', () => {
      const impact = {
        userGroup: 'Screen Reader Users',
        consequence: 'Announced as button without purpose.',
        severityNote: 'Critical blocker',
      };
      expect(HumanImpactSchema.parse(impact)).toEqual(impact);
    });

    it('rejects empty userGroup or consequence', () => {
      expect(() =>
        HumanImpactSchema.parse({ userGroup: '', consequence: 'Fail' })
      ).toThrow();
    });
  });

  describe('VerificationStepSchema', () => {
    it('accepts valid verification steps across all 4 supported methods', () => {
      const methods = ['keyboard', 'screen-reader', 'visual', 'rescan'] as const;
      for (const method of methods) {
        const step = {
          method,
          instruction: 'Test step instruction',
          expectedResult: 'Expected outcome',
        };
        expect(VerificationStepSchema.parse(step)).toEqual(step);
      }
    });

    it('rejects invalid verification methods', () => {
      expect(() =>
        VerificationStepSchema.parse({
          method: 'ai-eval',
          instruction: 'Ask AI',
          expectedResult: 'Pass',
        })
      ).toThrow();
    });
  });

  describe('RemediationGuidanceSchema', () => {
    it('validates a complete remediation guidance object', () => {
      const guidance = {
        ruleId: 'button-name',
        title: 'Buttons must have discernible text',
        classification: 'normative-wcag' as const,
        wcagCriterion: '4.1.2 Name, Role, Value',
        wcagLevel: 'A' as const,
        whyItMatters: 'Buttons must convey their purpose to assistive tech.',
        humanImpacts: [
          {
            userGroup: 'Screen Reader Users',
            consequence: 'Cannot determine action of button.',
          },
        ],
        rootCauseAnalysis: 'Button has no accessible name.',
        badExample: {
          snippet: '<button><svg></svg></button>',
          reason: 'No text or aria-label.',
        },
        goodExamples: [
          {
            language: 'html' as const,
            title: 'Native Text',
            code: '<button>Close</button>',
            explanation: 'Uses visible text.',
            isPrimary: true,
          },
        ],
        potentialPitfalls: ['Do not use empty aria-label.'],
        verificationSteps: [
          {
            method: 'keyboard' as const,
            instruction: 'Tab to button.',
            expectedResult: 'Focusable with outline.',
          },
        ],
        officialDocUrl: 'https://dequeuniversity.com/rules/axe/4.14/button-name',
      };

      expect(RemediationGuidanceSchema.parse(guidance)).toEqual(guidance);
    });
  });

  describe('StoredRemediationRecordSchema', () => {
    it('validates a complete persisted remediation record', () => {
      const record = {
        fingerprint: 'v1:button-name:button#submit',
        status: 'attempted' as const,
        updatedAt: '2026-11-06T18:00:00.000Z',
        attemptedAt: '2026-11-06T18:00:00.000Z',
        verifiedAtScanId: '550e8400-e29b-41d4-a716-446655440000',
        notes: 'Added aria-label in HeaderComponent',
      };

      expect(StoredRemediationRecordSchema.parse(record)).toEqual(record);
    });

    it('rejects oversized user notes (> 500 chars)', () => {
      const record = {
        fingerprint: 'v1:button-name:btn',
        status: 'suggested' as const,
        updatedAt: '2026-11-06T18:00:00.000Z',
        notes: 'x'.repeat(501),
      };

      expect(() => StoredRemediationRecordSchema.parse(record)).toThrow();
    });

    it('validates batch storage payload dictionary', () => {
      const payload = {
        'v1:button-name:btn1': {
          fingerprint: 'v1:button-name:btn1',
          status: 'suggested' as const,
          updatedAt: '2026-11-06T18:00:00.000Z',
        },
        'v1:color-contrast:p1': {
          fingerprint: 'v1:color-contrast:p1',
          status: 'verified' as const,
          updatedAt: '2026-11-06T18:00:00.000Z',
        },
      };

      expect(RemediationStoragePayloadSchema.parse(payload)).toEqual(payload);
    });
  });

  describe('ScanVerificationResultSchema', () => {
    it('accepts all 8 scan verification outcome types', () => {
      const outcomes = [
        'confirmed-resolved',
        'still-present',
        'newly-introduced',
        'uncertain-match',
        'failed-scan',
        'cancelled-scan',
        'incomplete-scan',
        'incomparable-scan',
      ] as const;

      for (const outcome of outcomes) {
        expect(ScanVerificationOutcomeTypeSchema.parse(outcome)).toBe(outcome);
      }
    });

    it('validates a complete scan verification result object', () => {
      const valid = {
        fingerprint: 'v1:button-name:button#action',
        outcome: 'confirmed-resolved' as const,
        scanId: '550e8400-e29b-41d4-a716-446655440000',
        reason: 'Issue resolved on rescan',
      };

      expect(ScanVerificationResultSchema.parse(valid)).toEqual(valid);
    });

    it('rejects invalid outcome types', () => {
      expect(() =>
        ScanVerificationResultSchema.parse({
          fingerprint: 'fp',
          outcome: 'unknown-outcome',
        })
      ).toThrow();
    });
  });
});
