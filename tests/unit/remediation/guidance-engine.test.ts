import { describe, it, expect } from 'vitest';
import {
  extractAllowlistedContext,
  generateRemediationGuidance,
} from '@/features/remediation/guidance-engine';
import { RemediationGuidanceSchema } from '@/lib/validation/schemas';
import type { FindingRecord } from '@/domain/finding';

function createMockFinding(overrides: Partial<FindingRecord> = {}): FindingRecord {
  return {
    id: 'finding-test-1',
    scanId: 'scan-test-1',
    ruleId: 'button-name',
    description: 'Buttons must have discernible text',
    help: 'Ensure buttons have accessible text',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.14/button-name',
    severity: 'critical',
    room: 'name-chamber',
    fingerprint: 'fp-button-name-1234567890abcdef',
    selector: 'button.btn-icon',
    wcagTags: ['cat.name-role-value', 'wcag2a', 'wcag412', 'section508'],
    nodes: [
      {
        target: ['button.btn-icon'],
        htmlExcerpt: '<button class="btn-icon" id="menu-toggle"><svg></svg></button>',
        failureSummary: 'Fix any of the following: Element does not have an inner text',
      },
    ],
    ...overrides,
  };
}

describe('Context-Aware Guidance Engine', () => {
  describe('extractAllowlistedContext', () => {
    it('extracts allowlisted attributes from well-formed HTML button', () => {
      const excerpt =
        '<button id="submit-btn" class="btn btn-primary" type="submit">Submit</button>';
      const context = extractAllowlistedContext(excerpt);
      expect(context).not.toBeNull();
      expect(context?.tagName).toBe('button');
      expect(context?.id).toBe('submit-btn');
      expect(context?.className).toBe('btn btn-primary');
      expect(context?.type).toBe('submit');
      expect(context?.textContent).toBe('Submit');
    });

    it('extracts input attributes including placeholder and type', () => {
      const excerpt =
        '<input id="user-email" class="form-control" type="email" placeholder="you@domain.com" />';
      const context = extractAllowlistedContext(excerpt);
      expect(context).not.toBeNull();
      expect(context?.tagName).toBe('input');
      expect(context?.id).toBe('user-email');
      expect(context?.className).toBe('form-control');
      expect(context?.type).toBe('email');
      expect(context?.placeholder).toBe('you@domain.com');
    });

    it('extracts image attributes including src', () => {
      const excerpt =
        '<img src="/assets/hero-banner.jpg" class="responsive-img" id="hero" />';
      const context = extractAllowlistedContext(excerpt);
      expect(context).not.toBeNull();
      expect(context?.tagName).toBe('img');
      expect(context?.src).toBe('/assets/hero-banner.jpg');
      expect(context?.className).toBe('responsive-img');
      expect(context?.id).toBe('hero');
    });

    it('extracts link attributes including href', () => {
      const excerpt =
        '<a href="/pricing" class="cta-link" id="nav-pricing">View Plans</a>';
      const context = extractAllowlistedContext(excerpt);
      expect(context).not.toBeNull();
      expect(context?.tagName).toBe('a');
      expect(context?.href).toBe('/pricing');
      expect(context?.className).toBe('cta-link');
      expect(context?.id).toBe('nav-pricing');
      expect(context?.textContent).toBe('View Plans');
    });

    it('returns null for empty, whitespace, or invalid inputs', () => {
      expect(extractAllowlistedContext('')).toBeNull();
      expect(extractAllowlistedContext('   \n  \t  ')).toBeNull();
      // @ts-expect-error Testing runtime edge cases
      expect(extractAllowlistedContext(null)).toBeNull();
      // @ts-expect-error Testing runtime edge cases
      expect(extractAllowlistedContext(undefined)).toBeNull();
    });

    it('gracefully handles malformed or unclosed HTML tags', () => {
      const malformed = '<button id="broken-btn" class="unclosed';
      const context = extractAllowlistedContext(malformed);
      expect(context).not.toBeNull();
      expect(context?.tagName).toBe('button');
      expect(context?.id).toBe('broken-btn');
    });

    it('strips dangerous injection characters from attribute values', () => {
      const dirty =
        '<input placeholder="hello &quot;><script>alert(1)</script>" id="safe-id" />';
      const context = extractAllowlistedContext(dirty);
      expect(context).not.toBeNull();
      expect(context?.id).toBe('safe-id');
      // Angle brackets and quotes should be stripped from placeholder
      expect(context?.placeholder).not.toContain('<');
      expect(context?.placeholder).not.toContain('>');
      expect(context?.placeholder).not.toContain('"');
    });

    it('ignores non-allowlisted attributes such as event handlers', () => {
      const withEvent =
        '<button onclick="evilCode()" onmouseover="track()" class="action-btn">Action</button>';
      const context = extractAllowlistedContext(withEvent);
      expect(context).not.toBeNull();
      expect(context?.tagName).toBe('button');
      expect(context?.className).toBe('action-btn');
      // context should not have onclick or onmouseover properties
      expect((context as Record<string, unknown>)['onclick']).toBeUndefined();
      expect((context as Record<string, unknown>)['onmouseover']).toBeUndefined();
    });

    it('truncates inputs exceeding the defensive 2000 character ceiling', () => {
      const longText = 'Hello World '.repeat(300); // ~3600 characters
      const oversized = `<button class="btn-primary" id="btn-submit">${longText}</button>`;
      const context = extractAllowlistedContext(oversized);
      expect(context).not.toBeNull();
      expect(context?.tagName).toBe('button');
      expect(context?.className).toBe('btn-primary');
      expect(context?.id).toBe('btn-submit');
      // textContent is safely capped at 100 characters
      expect(context?.textContent?.length).toBeLessThanOrEqual(100);
    });
  });

  describe('generateRemediationGuidance for Curated Rules', () => {
    it('returns valid guidance conforming to RemediationGuidanceSchema for button-name', () => {
      const finding = createMockFinding({ ruleId: 'button-name' });
      const guidance = generateRemediationGuidance(finding);

      expect(guidance.ruleId).toBe('button-name');
      expect(guidance.classification).toBe('normative-wcag');
      expect(guidance.wcagLevel).toBe('A');
      expect(guidance.isCustomFallback).toBeFalsy();

      const validation = RemediationGuidanceSchema.safeParse(guidance);
      expect(validation.success).toBe(true);
    });

    it('tailors primary HTML snippet with extracted element class and id for button-name', () => {
      const finding = createMockFinding({
        ruleId: 'button-name',
        nodes: [
          {
            target: ['button#checkout-btn.btn-pay'],
            htmlExcerpt: '<button id="checkout-btn" class="btn-pay"><svg></svg></button>',
            failureSummary: 'Element has no discernible text',
          },
        ],
      });

      const guidance = generateRemediationGuidance(finding);
      const primaryHtml = guidance.goodExamples.find(
        (g) => g.isPrimary && g.language === 'html'
      );
      expect(primaryHtml).toBeDefined();
      expect(primaryHtml?.code).toContain('id="checkout-btn"');
      expect(primaryHtml?.code).toContain('class="btn-pay"');
      expect(primaryHtml?.code).toContain('Action Label');
    });

    it('tailors label guidance using input id and placeholder', () => {
      const finding = createMockFinding({
        ruleId: 'label',
        nodes: [
          {
            target: ['input#user-phone'],
            htmlExcerpt:
              '<input id="user-phone" type="tel" placeholder="Enter mobile number" />',
            failureSummary: 'Form element does not have an explicit or implicit label',
          },
        ],
      });

      const guidance = generateRemediationGuidance(finding);
      const primaryHtml = guidance.goodExamples.find(
        (g) => g.isPrimary && g.language === 'html'
      );
      expect(primaryHtml).toBeDefined();
      expect(primaryHtml?.code).toContain(
        '<label for="user-phone">Enter mobile number</label>'
      );
      expect(primaryHtml?.code).toContain('id="user-phone"');
      expect(primaryHtml?.code).toContain('type="tel"');
    });

    it('tailors image-alt guidance using existing img src and class', () => {
      const finding = createMockFinding({
        ruleId: 'image-alt',
        nodes: [
          {
            target: ['img.banner'],
            htmlExcerpt: '<img src="/images/halloween-hero.png" class="banner" />',
            failureSummary: 'Image missing alt attribute',
          },
        ],
      });

      const guidance = generateRemediationGuidance(finding);
      const primaryHtml = guidance.goodExamples.find(
        (g) => g.isPrimary && g.language === 'html'
      );
      expect(primaryHtml).toBeDefined();
      expect(primaryHtml?.code).toContain('src="/images/halloween-hero.png"');
      expect(primaryHtml?.code).toContain('class="banner"');
      expect(primaryHtml?.code).toContain(
        'alt="Describe the informative purpose of this image"'
      );
    });

    it('tailors link-name guidance using existing anchor href and class', () => {
      const finding = createMockFinding({
        ruleId: 'link-name',
        nodes: [
          {
            target: ['a.icon-link'],
            htmlExcerpt:
              '<a href="/terms-and-conditions" class="icon-link"><i class="fa fa-file"></i></a>',
            failureSummary: 'Anchor element has no text',
          },
        ],
      });

      const guidance = generateRemediationGuidance(finding);
      const primaryHtml = guidance.goodExamples.find(
        (g) => g.isPrimary && g.language === 'html'
      );
      expect(primaryHtml).toBeDefined();
      expect(primaryHtml?.code).toContain('href="/terms-and-conditions"');
      expect(primaryHtml?.code).toContain('class="icon-link"');
    });

    it('returns pristine catalog examples when excerpt provides no id/class context', () => {
      const finding = createMockFinding({
        ruleId: 'button-name',
        nodes: [
          {
            target: ['button'],
            htmlExcerpt: '<button></button>',
            failureSummary: 'Element has no accessible name',
          },
        ],
      });

      const guidance = generateRemediationGuidance(finding);
      const primaryHtml = guidance.goodExamples.find(
        (g) => g.isPrimary && g.language === 'html'
      );
      expect(primaryHtml).toBeDefined();
      expect(primaryHtml?.code).toContain('Close');
    });

    it('handles findings with empty or missing nodes gracefully', () => {
      const finding = createMockFinding({
        ruleId: 'button-name',
        nodes: [],
      });

      const guidance = generateRemediationGuidance(finding);
      expect(guidance.ruleId).toBe('button-name');
      expect(guidance.goodExamples.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Fallback Guidance for Unmapped or Custom Rules', () => {
    it('creates an honest fallback conforming to schema for unknown rules', () => {
      const finding = createMockFinding({
        ruleId: 'marquee-disallowed',
        help: 'Elements must not scroll continuously',
        description: 'The <marquee> tag is obsolete and causes cognitive distraction.',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.14/marquee',
        wcagTags: ['wcag2a', 'wcag222'],
        nodes: [
          {
            target: ['marquee'],
            htmlExcerpt: '<marquee>Breaking News</marquee>',
            failureSummary: 'Disallowed marquee element detected',
          },
        ],
      });

      const guidance = generateRemediationGuidance(finding);
      expect(guidance.ruleId).toBe('marquee-disallowed');
      expect(guidance.isCustomFallback).toBe(true);
      expect(guidance.title).toBe('Elements must not scroll continuously');
      expect(guidance.classification).toBe('normative-wcag');
      expect(guidance.wcagLevel).toBe('A');
      expect(guidance.officialDocUrl).toBe(
        'https://dequeuniversity.com/rules/axe/4.14/marquee'
      );

      const validation = RemediationGuidanceSchema.safeParse(guidance);
      expect(validation.success).toBe(true);
    });

    it('classifies unmapped best-practice findings as best-practice with Advisory level', () => {
      const finding = createMockFinding({
        ruleId: 'scope-attr-valid',
        help: 'Ensure scope attribute is used correctly on table headers',
        description: 'The scope attribute should only be used on <th> elements.',
        wcagTags: ['cat.tables', 'best-practice'],
        nodes: [
          {
            target: ['td[scope]'],
            htmlExcerpt: '<td scope="row">Item</td>',
            failureSummary: 'Scope attribute used on td element',
          },
        ],
      });

      const guidance = generateRemediationGuidance(finding);
      expect(guidance.ruleId).toBe('scope-attr-valid');
      expect(guidance.isCustomFallback).toBe(true);
      expect(guidance.classification).toBe('best-practice');
      expect(guidance.wcagLevel).toBe('Advisory');
      expect(guidance.wcagCriterion).toBe('Advisory Accessibility Best Practice');

      const validation = RemediationGuidanceSchema.safeParse(guidance);
      expect(validation.success).toBe(true);
    });
  });
});
