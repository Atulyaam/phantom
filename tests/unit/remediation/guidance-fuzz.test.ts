import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  extractAllowlistedContext,
  generateRemediationGuidance,
} from '@/features/remediation/guidance-engine';
import { RemediationGuidanceSchema } from '@/lib/validation/schemas';
import type { FindingRecord } from '@/domain/finding';
import type { Severity } from '@/domain/scan';
import type { RoomId } from '@/domain/mansion';

describe('Remediation Guidance Engine — Property-Based Fuzz Testing', () => {
  describe('extractAllowlistedContext resilience', () => {
    it('never throws on arbitrary string inputs (unicode, control chars, random bytes)', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 5000 }), (input) => {
          expect(() => {
            const context = extractAllowlistedContext(input);
            if (context) {
              expect(typeof context.tagName).toBe('string');
              if (context.id) expect(context.id.length).toBeLessThanOrEqual(50);
              if (context.className)
                expect(context.className.length).toBeLessThanOrEqual(100);
              if (context.textContent)
                expect(context.textContent.length).toBeLessThanOrEqual(100);
              if (context.placeholder)
                expect(context.placeholder.length).toBeLessThanOrEqual(100);
              if (context.ariaLabel)
                expect(context.ariaLabel.length).toBeLessThanOrEqual(100);
            }
          }).not.toThrow();
          return true;
        }),
        { numRuns: 150 }
      );
    });

    it('never permits script tags or event handlers to leak into extracted context', () => {
      const maliciousPatterns = fc.oneof(
        fc.constant('<script>alert("xss")</script>'),
        fc.constant('<img src="x" onerror="alert(1)" />'),
        fc.constant('<button onfocus="steal()" onmouseover="track()">Click</button>'),
        fc.constant('<a href="javascript:alert(1)" onclick="void(0)">Link</a>'),
        fc.constant('<svg onload="fetch(\'https://evil.com\')"><circle /></svg>'),
        fc.constant('<iframe src="data:text/html,<script>alert(1)</script>"></iframe>')
      );

      fc.assert(
        fc.property(maliciousPatterns, (payload) => {
          const context = extractAllowlistedContext(payload);
          if (context) {
            const keys = Object.keys(context);
            // Must only contain allowlisted keys
            for (const key of keys) {
              expect([
                'tagName',
                'id',
                'className',
                'type',
                'placeholder',
                'ariaLabel',
                'textContent',
                'src',
                'href',
              ]).toContain(key);
            }
            // Event handlers must never be keys
            expect((context as Record<string, unknown>)['onerror']).toBeUndefined();
            expect((context as Record<string, unknown>)['onclick']).toBeUndefined();
            expect((context as Record<string, unknown>)['onload']).toBeUndefined();
            expect((context as Record<string, unknown>)['onfocus']).toBeUndefined();
          }
          return true;
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('generateRemediationGuidance resilience and schema conformance', () => {
    const severities: Severity[] = ['critical', 'serious', 'moderate', 'minor'];
    const rooms: RoomId[] = [
      'foyer',
      'grand-ballroom',
      'portrait-gallery',
      'library',
      'conservatory',
      'clock-tower',
      'attic',
    ];

    const ruleIdArbitrary = fc.oneof(
      // Curated catalog rules
      fc.constant('button-name'),
      fc.constant('link-name'),
      fc.constant('color-contrast'),
      fc.constant('image-alt'),
      fc.constant('svg-img-alt'),
      fc.constant('label'),
      fc.constant('select-name'),
      fc.constant('heading-order'),
      fc.constant('landmark-one-main'),
      fc.constant('tabindex'),
      // Arbitrary / custom rules
      fc.stringMatching(/^[a-z]{3,10}(-[a-z]{3,10}){0,3}$/)
    );

    const findingArbitrary = fc.record({
      id: fc.uuid(),
      scanId: fc.uuid(),
      ruleId: ruleIdArbitrary,
      description: fc.string({ minLength: 1, maxLength: 200 }),
      help: fc.string({ minLength: 1, maxLength: 100 }),
      helpUrl: fc.webUrl(),
      severity: fc.constantFrom(...severities),
      room: fc.constantFrom(...rooms),
      fingerprint: fc.string({ minLength: 16, maxLength: 64 }),
      selector: fc.string({ minLength: 1, maxLength: 50 }),
      wcagTags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
        minLength: 0,
        maxLength: 5,
      }),
      nodes: fc.array(
        fc.record({
          target: fc.array(fc.string({ minLength: 1, maxLength: 30 }), {
            minLength: 1,
            maxLength: 3,
          }),
          htmlExcerpt: fc.string({ minLength: 0, maxLength: 2500 }),
          failureSummary: fc.string({ minLength: 0, maxLength: 150 }),
        }),
        { minLength: 0, maxLength: 3 }
      ),
    });

    it('never throws and always produces a strictly valid RemediationGuidance object', () => {
      fc.assert(
        fc.property(findingArbitrary, (finding) => {
          const guidance = generateRemediationGuidance(finding as FindingRecord);

          // Invariant 1: Return value must pass Zod schema validation
          const validation = RemediationGuidanceSchema.safeParse(guidance);
          expect(validation.success).toBe(true);

          // Invariant 2: RuleId matches finding
          expect(guidance.ruleId).toBe(finding.ruleId);

          // Invariant 3: Must always have at least one good example marked as primary
          expect(guidance.goodExamples.length).toBeGreaterThanOrEqual(1);
          const primarySnippets = guidance.goodExamples.filter((g) => g.isPrimary);
          expect(primarySnippets.length).toBe(1);

          // Invariant 4: Must always have at least one verification step
          expect(guidance.verificationSteps.length).toBeGreaterThanOrEqual(1);

          // Invariant 5: No eval or new Function in generated snippet code
          for (const snippet of guidance.goodExamples) {
            expect(snippet.code).not.toContain('eval(');
            expect(snippet.code).not.toContain('new Function');
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });
});
