import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateTabEligibility } from '@/features/tab-management/url-validator';

describe('Target Tab URL Eligibility Validator', () => {
  it('approves standard HTTPS and HTTP websites', () => {
    const urls = [
      'https://example.com',
      'https://www.w3.org/WAI/WCAG22/quickref/',
      'http://localhost:3000',
      'http://127.0.0.1:8080/app',
      'https://subdomain.domain.org/path?param=1#hash',
    ];

    for (const url of urls) {
      const result = validateTabEligibility(url);
      expect(result.isEligible).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.normalizedUrl).toBe(url);
    }
  });

  it('rejects chrome:// and chrome-error:// internal pages', () => {
    const chromeUrls = [
      'chrome://settings',
      'chrome://extensions',
      'chrome://newtab',
      'chrome://version',
      'chrome-error://chromewebdata/',
    ];

    for (const url of chromeUrls) {
      const result = validateTabEligibility(url);
      expect(result.isEligible).toBe(false);
      expect(['chrome-internal', 'browser-error']).toContain(result.reason);
      expect(result.guidance).toMatch(/prohibits extensions from inspecting/i);
    }
  });

  it('rejects edge:// internal pages', () => {
    const edgeUrls = ['edge://settings', 'edge://extensions', 'edge://flags'];

    for (const url of edgeUrls) {
      const result = validateTabEligibility(url);
      expect(result.isEligible).toBe(false);
      expect(result.reason).toBe('edge-internal');
    }
  });

  it('rejects browser about: pages', () => {
    const aboutUrls = ['about:blank', 'about:config', 'about:neterror'];

    for (const url of aboutUrls) {
      const result = validateTabEligibility(url);
      expect(result.isEligible).toBe(false);
      expect(result.reason).toBe('about-page');
    }
  });

  it('rejects view-source: URLs', () => {
    const result = validateTabEligibility('view-source:https://example.com');
    expect(result.isEligible).toBe(false);
    expect(result.reason).toBe('view-source');
  });

  it('rejects chrome-extension:// and moz-extension:// pages', () => {
    const extUrls = [
      'chrome-extension://abcdefghijklmnop/dashboard.html',
      'moz-extension://12345-6789/options.html',
    ];

    for (const url of extUrls) {
      const result = validateTabEligibility(url);
      expect(result.isEligible).toBe(false);
      expect(result.reason).toBe('extension-internal');
    }
  });

  it('rejects Chrome Web Store and Edge Add-ons pages', () => {
    const storeUrls = [
      'https://chromewebstore.google.com/detail/phantom-audit/12345',
      'https://chrome.google.com/webstore/detail/phantom-audit/12345',
      'https://microsoftedge.microsoft.com/addons/detail/phantom-audit/12345',
    ];

    for (const url of storeUrls) {
      const result = validateTabEligibility(url);
      expect(result.isEligible).toBe(false);
      expect(result.reason).toBe('web-store');
      expect(result.guidance).toMatch(/web store domains/i);
    }
  });

  it('rejects data: and javascript: schemes', () => {
    const dataResult = validateTabEligibility('data:text/html,<h1>Hello</h1>');
    expect(dataResult.isEligible).toBe(false);
    expect(dataResult.reason).toBe('data-url');

    const jsResult = validateTabEligibility('javascript:void(0)');
    expect(jsResult.isEligible).toBe(false);
    expect(jsResult.reason).toBe('javascript-url');
  });

  it('marks file:// scheme as eligible but notes explicit permission guidance', () => {
    const fileResult = validateTabEligibility('file:///C:/Users/test/index.html');
    expect(fileResult.isEligible).toBe(true);
    expect(fileResult.reason).toBe('file-scheme');
    expect(fileResult.guidance).toMatch(/Allow access to file URLs/i);
  });

  it('gracefully handles empty, null, undefined, or malformed strings', () => {
    expect(validateTabEligibility('').isEligible).toBe(false);
    expect(validateTabEligibility('   ').isEligible).toBe(false);
    expect(validateTabEligibility(null).isEligible).toBe(false);
    expect(validateTabEligibility(undefined).isEligible).toBe(false);
    expect(validateTabEligibility('not a valid url').isEligible).toBe(false);
    expect(validateTabEligibility('ftp://ftp.is.not.supported/').isEligible).toBe(false);
  });

  describe('Property-Based Resilience (fast-check)', () => {
    it('always returns a structured TabEligibilityResult with boolean isEligible for any arbitrary string', () => {
      fc.assert(
        fc.property(fc.string(), (arbitraryUrl) => {
          const result = validateTabEligibility(arbitraryUrl);
          expect(typeof result.isEligible).toBe('boolean');
          expect(typeof result.title).toBe('string');
          expect(typeof result.normalizedUrl).toBe('string');
          if (!result.isEligible) {
            expect(result.reason).toBeDefined();
          }
          return true;
        })
      );
    });
  });
});
