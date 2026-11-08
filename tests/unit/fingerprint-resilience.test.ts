import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  canonicalizeSelectorSegment,
  normalizeSelector,
  generateFindingFingerprint,
  parseFingerprint,
  areFingerprintsEqual,
} from '@/features/normalization/fingerprint';

describe('Canonical Fingerprint Resilience Engine', () => {
  describe('canonicalizeSelectorSegment', () => {
    it('sorts intra-element class names deterministically', () => {
      const seg1 = 'button.btn-primary.btn.active';
      const seg2 = 'button.active.btn.btn-primary';
      const seg3 = 'button.btn.active.btn-primary';

      expect(canonicalizeSelectorSegment(seg1)).toBe(canonicalizeSelectorSegment(seg2));
      expect(canonicalizeSelectorSegment(seg2)).toBe(canonicalizeSelectorSegment(seg3));
      expect(canonicalizeSelectorSegment(seg1)).toBe('button.active.btn.btn-primary');
    });

    it('normalizes single quotes in attributes to double quotes', () => {
      expect(canonicalizeSelectorSegment("input[type='text']")).toBe(
        'input[type="text"]'
      );
      expect(canonicalizeSelectorSegment("a[aria-label='Close Dialog']")).toBe(
        'a[aria-label="Close Dialog"]'
      );
    });

    it('preserves pseudo-classes and IDs', () => {
      expect(canonicalizeSelectorSegment('div#main-header:first-child')).toBe(
        'div#main-header:first-child'
      );
    });
  });

  describe('normalizeSelector', () => {
    it('collapses excessive whitespace and standardizes combinators', () => {
      const messy = 'nav   >   ul   +   li    ~   a';
      expect(normalizeSelector(messy)).toBe('nav > ul + li ~ a');
    });

    it('normalizes shadow DOM and iframe boundaries', () => {
      const nested = 'custom-element >>> #inner-shadow >>> .btn.btn-primary';
      expect(normalizeSelector(nested)).toBe(
        'custom-element >>> #inner-shadow >>> .btn.btn-primary'
      );
    });

    it('handles empty and malformed selectors gracefully', () => {
      expect(normalizeSelector('')).toBe('');
      expect(normalizeSelector('   ')).toBe('');
    });
  });

  describe('generateFindingFingerprint', () => {
    it('produces identical fingerprints regardless of target array order', () => {
      const targetsA = ['#btn-submit', '.nav-link', 'footer a'];
      const targetsB = ['footer a', '#btn-submit', '.nav-link'];
      const targetsC = ['.nav-link', 'footer a', '#btn-submit'];

      const fpA = generateFindingFingerprint('color-contrast', targetsA);
      const fpB = generateFindingFingerprint('color-contrast', targetsB);
      const fpC = generateFindingFingerprint('color-contrast', targetsC);

      expect(fpA).toBe(fpB);
      expect(fpB).toBe(fpC);
    });

    it('produces identical fingerprints when class order varies within selectors', () => {
      const targets1 = ['button.btn-primary.btn'];
      const targets2 = ['button.btn.btn-primary'];

      const fp1 = generateFindingFingerprint('button-name', targets1);
      const fp2 = generateFindingFingerprint('button-name', targets2);

      expect(fp1).toBe(fp2);
    });

    it('deduplicates identical targets', () => {
      const targetsWithDuplicates = ['button#submit', 'button#submit', 'button#submit'];
      const targetsSingle = ['button#submit'];

      expect(generateFindingFingerprint('button-name', targetsWithDuplicates)).toBe(
        generateFindingFingerprint('button-name', targetsSingle)
      );
    });

    it('uses the v1 prefix and allows valid parsing', () => {
      const fp = generateFindingFingerprint('image-alt', ['img.hero']);
      expect(fp.startsWith('v1:')).toBe(true);

      const parsed = parseFingerprint(fp);
      expect(parsed).not.toBeNull();
      expect(parsed?.version).toBe('v1');
      expect(parsed?.ruleId).toBe('image-alt');
      expect(parsed?.targets).toEqual(['img.hero']);
    });

    it('is idempotent', () => {
      const targets = ['button.btn.active'];
      const fp1 = generateFindingFingerprint('button-name', targets);
      const parsed = parseFingerprint(fp1);
      expect(parsed).not.toBeNull();
      const fp2 = generateFindingFingerprint('button-name', parsed!.targets);
      expect(fp1).toBe(fp2);
    });
  });

  describe('areFingerprintsEqual', () => {
    it('correctly matches identical and whitespace-equivalent fingerprints', () => {
      const fp1 = generateFindingFingerprint('link-name', ['a.external.nav']);
      const fp2 = generateFindingFingerprint('link-name', ['a.nav.external']);
      expect(areFingerprintsEqual(fp1, fp2)).toBe(true);
    });

    it('distinguishes distinct rules or targets', () => {
      const fp1 = generateFindingFingerprint('link-name', ['a.nav']);
      const fp2 = generateFindingFingerprint('button-name', ['a.nav']);
      const fp3 = generateFindingFingerprint('link-name', ['button.nav']);

      expect(areFingerprintsEqual(fp1, fp2)).toBe(false);
      expect(areFingerprintsEqual(fp1, fp3)).toBe(false);
    });
  });

  describe('Property-Based Resilience (fast-check)', () => {
    it('target order commutativity holds for all permutations of target lists', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.array(fc.string({ minLength: 1, maxLength: 15 }), {
            minLength: 1,
            maxLength: 8,
          }),
          (ruleId, targets) => {
            const fpNormal = generateFindingFingerprint(ruleId, targets);
            const reversed = [...targets].reverse();
            const fpReversed = generateFindingFingerprint(ruleId, reversed);
            return fpNormal === fpReversed;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('class ordering inside selector segment is strictly invariant under arbitrary permutations', () => {
      const classGen = fc.array(fc.stringMatching(/^[a-z][a-z0-9-]{1,10}$/), {
        minLength: 2,
        maxLength: 5,
      });

      fc.assert(
        fc.property(classGen, (classes) => {
          const seg1 = 'div.' + classes.join('.');
          const shuffled = [...classes].sort(() => 0.5 - Math.random());
          const seg2 = 'div.' + shuffled.join('.');

          return canonicalizeSelectorSegment(seg1) === canonicalizeSelectorSegment(seg2);
        }),
        { numRuns: 100 }
      );
    });
  });
});
