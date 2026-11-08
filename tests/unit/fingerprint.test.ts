import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  generateFindingFingerprint,
  normalizeSelector,
} from '@/features/normalization/fingerprint';

describe('Finding Fingerprint Generator', () => {
  it('normalizes selector whitespace correctly', () => {
    expect(normalizeSelector('  div   >   span.label   ')).toBe('div > span.label');
    expect(normalizeSelector('ul  +  p')).toBe('ul + p');
  });

  it('generates deterministic fingerprint independent of target array ordering', () => {
    const fp1 = generateFindingFingerprint('button-name', ['button#b', 'button#a']);
    const fp2 = generateFindingFingerprint('button-name', ['button#a', 'button#b']);

    expect(fp1).toBe(fp2);
    expect(fp1).toBe('v1:button-name:button#a|button#b');
  });

  it('is case-insensitive for rule ID', () => {
    const fp1 = generateFindingFingerprint('Button-Name', ['#btn']);
    const fp2 = generateFindingFingerprint('button-name', ['#btn']);

    expect(fp1).toBe(fp2);
  });

  describe('Property-based testing (fast-check)', () => {
    it('always generates identical fingerprints regardless of target ordering', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
          (ruleId, targets) => {
            const reversed = [...targets].reverse();
            const fpA = generateFindingFingerprint(ruleId, targets);
            const fpB = generateFindingFingerprint(ruleId, reversed);
            return fpA === fpB;
          }
        )
      );
    });

    it('always starts with version prefix v1:', () => {
      fc.assert(
        fc.property(fc.string(), fc.array(fc.string()), (ruleId, targets) => {
          const fp = generateFindingFingerprint(ruleId, targets);
          return fp.startsWith('v1:');
        })
      );
    });
  });
});
