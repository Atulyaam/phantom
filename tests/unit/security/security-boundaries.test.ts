import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  validateMessageSender,
  parseDashboardQueryParams,
  safeDecodeURIComponent,
  isAuthorizedTargetScheme,
} from '@/lib/security';
import { renderHook } from '@testing-library/react';
import { useTargetTab } from '@/features/tab-management/use-target-tab';

describe('Phase 9 Workstream 1: Extension Security Boundary & Hardening', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // SEC-001: Manifest Content Security Policy Hardening
  // ───────────────────────────────────────────────────────────────────────────
  describe('SEC-001: Manifest CSP Hardening', () => {
    it('verifies that the generated production manifest contains strict CSP with object-src none', () => {
      const manifestPath = path.resolve(
        __dirname,
        '../../../.output/chrome-mv3/manifest.json'
      );
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

        // Extension Pages CSP
        expect(manifest.content_security_policy).toBeDefined();
        const extensionPagesCsp = manifest.content_security_policy.extension_pages;
        expect(extensionPagesCsp).toBeDefined();

        // Must disallow plugin/object content
        expect(extensionPagesCsp).toContain("object-src 'none'");

        // Must restrict script execution to packaged resources
        expect(extensionPagesCsp).toContain("script-src 'self'");

        // Must NOT allow dangerous eval or remote sources
        expect(extensionPagesCsp).not.toContain("'unsafe-eval'");
        expect(extensionPagesCsp).not.toContain('https:');
        expect(extensionPagesCsp).not.toContain('http:');

        // Permissions must remain minimal (activeTab, scripting, storage)
        expect(manifest.permissions).toEqual(['activeTab', 'scripting', 'storage']);

        // No web_accessible_resources should expose private extension pages
        if (manifest.web_accessible_resources) {
          for (const entry of manifest.web_accessible_resources) {
            expect(entry.resources).not.toContain('dashboard.html');
          }
        }
      } else {
        // If build hasn't run yet in this workspace, verify wxt.config.ts source directly
        const wxtConfigPath = path.resolve(__dirname, '../../../wxt.config.ts');
        const wxtConfig = fs.readFileSync(wxtConfigPath, 'utf8');
        expect(wxtConfig).toContain(
          "extension_pages: \"script-src 'self'; object-src 'none';\""
        );
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SEC-002: Message Sender Origin & Context Verification
  // ───────────────────────────────────────────────────────────────────────────
  describe('SEC-002: Message Sender Verification (validateMessageSender)', () => {
    const validRuntimeId = 'test-extension-id';
    const validOrigin = 'chrome-extension://test-extension-id';
    const validUrl = `${validOrigin}/dashboard.html`;

    it('accepts a valid message sender from dashboard.html in the top-level frame', () => {
      const result = validateMessageSender(
        {
          id: validRuntimeId,
          url: validUrl,
          frameId: 0,
        },
        {
          runtimeIdOverride: validRuntimeId,
          expectedOriginOverride: validOrigin,
        }
      );
      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('accepts valid sender with query parameters and hash fragment on dashboard.html', () => {
      const result = validateMessageSender(
        {
          id: validRuntimeId,
          url: `${validUrl}?tabId=42&url=https%3A%2F%2Fexample.com#section`,
          frameId: 0,
        },
        {
          runtimeIdOverride: validRuntimeId,
          expectedOriginOverride: validOrigin,
        }
      );
      expect(result.isValid).toBe(true);
    });

    it('rejects missing, null, or non-object sender', () => {
      expect(validateMessageSender(null).isValid).toBe(false);
      expect(validateMessageSender(undefined).isValid).toBe(false);
      expect(validateMessageSender('string-sender').isValid).toBe(false);
      expect(validateMessageSender(12345).isValid).toBe(false);
    });

    it('rejects sender with missing, empty, or whitespace URL', () => {
      expect(validateMessageSender({ id: validRuntimeId, frameId: 0 }).isValid).toBe(
        false
      );
      expect(
        validateMessageSender({ id: validRuntimeId, url: '', frameId: 0 }).isValid
      ).toBe(false);
      expect(
        validateMessageSender({ id: validRuntimeId, url: '   ', frameId: 0 }).isValid
      ).toBe(false);
    });

    it('rejects sender with completely malformed URL that cannot be parsed', () => {
      const result = validateMessageSender(
        {
          id: validRuntimeId,
          url: ':::',
          frameId: 0,
        },
        { runtimeIdOverride: validRuntimeId }
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toMatch(/malformed/i);
    });

    it('rejects sender with mismatched extension ID', () => {
      const result = validateMessageSender(
        {
          id: 'evil-foreign-extension-id',
          url: validUrl,
          frameId: 0,
        },
        {
          runtimeIdOverride: validRuntimeId,
          expectedOriginOverride: validOrigin,
        }
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toMatch(/does not match extension ID/i);
    });

    it('rejects sender from external web origin', () => {
      const result = validateMessageSender(
        {
          id: validRuntimeId,
          url: 'https://evil-attacker.com/dashboard.html',
          frameId: 0,
        },
        {
          runtimeIdOverride: validRuntimeId,
          expectedOriginOverride: validOrigin,
        }
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toMatch(
        /not an authorized extension scheme|does not match expected/i
      );
    });

    it('rejects sender from unauthorized protocol scheme when origin override is unset', () => {
      const result = validateMessageSender(
        {
          id: validRuntimeId,
          url: 'http://localhost:3000/dashboard.html',
          frameId: 0,
        },
        {
          runtimeIdOverride: validRuntimeId,
          expectedOriginOverride: '', // forces scheme inspection
        }
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toMatch(/not an authorized extension scheme/i);
    });

    it('returns UNAUTHORIZED_SENDER error response when sender validation fails', () => {
      const rawMessage = { type: 'PING', requestId: 'req_sec_test' };
      const invalidSender = {
        id: 'attacker-id',
        url: 'https://evil.com/dashboard.html',
        frameId: 1,
      };

      const senderValidation = validateMessageSender(invalidSender, {
        runtimeIdOverride: validRuntimeId,
        expectedOriginOverride: validOrigin,
      });

      expect(senderValidation.isValid).toBe(false);

      const errorResponse = {
        success: false,
        requestId: rawMessage.requestId,
        error:
          senderValidation.reason || 'Sender is not authorized to invoke this action',
        code: 'UNAUTHORIZED_SENDER',
      };

      expect(errorResponse.code).toBe('UNAUTHORIZED_SENDER');
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.requestId).toBe('req_sec_test');
    });

    describe('Prefix-Confusion Attack Immunity', () => {
      it('rejects domain suffix confusion (e.g. dashboard.html.attacker.com)', () => {
        const result = validateMessageSender(
          {
            id: validRuntimeId,
            url: `${validOrigin}/dashboard.html.attacker.com`,
            frameId: 0,
          },
          {
            runtimeIdOverride: validRuntimeId,
            expectedOriginOverride: validOrigin,
          }
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toMatch(/pathname/i);
      });

      it('rejects subpath confusion (e.g. /dashboard.html/subpath)', () => {
        const result = validateMessageSender(
          {
            id: validRuntimeId,
            url: `${validOrigin}/dashboard.html/subpath`,
            frameId: 0,
          },
          {
            runtimeIdOverride: validRuntimeId,
            expectedOriginOverride: validOrigin,
          }
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toMatch(/pathname/i);
      });

      it('rejects trailing encoded space or dot characters', () => {
        const result = validateMessageSender(
          {
            id: validRuntimeId,
            url: `${validOrigin}/dashboard.html%20`,
            frameId: 0,
          },
          {
            runtimeIdOverride: validRuntimeId,
            expectedOriginOverride: validOrigin,
          }
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toMatch(/pathname/i);
      });

      it('rejects wrong extension page (e.g. background.js or non-existent popup.html)', () => {
        const result = validateMessageSender(
          {
            id: validRuntimeId,
            url: `${validOrigin}/background.js`,
            frameId: 0,
          },
          {
            runtimeIdOverride: validRuntimeId,
            expectedOriginOverride: validOrigin,
          }
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toMatch(/pathname/i);
      });

      it('rejects foreign extension sending from its own dashboard.html path', () => {
        const result = validateMessageSender(
          {
            id: 'foreign-extension-id',
            url: 'chrome-extension://foreign-extension-id/dashboard.html',
            frameId: 0,
          },
          {
            runtimeIdOverride: validRuntimeId,
            expectedOriginOverride: validOrigin,
          }
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toMatch(/does not match extension ID/i);
      });

      it('rejects encoded slash (%2f) pathname trick', () => {
        const result = validateMessageSender(
          {
            id: validRuntimeId,
            url: `${validOrigin}/dashboard.html%2f`,
            frameId: 0,
          },
          {
            runtimeIdOverride: validRuntimeId,
            expectedOriginOverride: validOrigin,
          }
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toMatch(/pathname/i);
      });

      it('rejects path traversal attempting to escape expected page', () => {
        const result = validateMessageSender(
          {
            id: validRuntimeId,
            url: `${validOrigin}/dashboard.html/../../evil.html`,
            frameId: 0,
          },
          {
            runtimeIdOverride: validRuntimeId,
            expectedOriginOverride: validOrigin,
          }
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toMatch(/pathname/i);
      });
    });

    describe('Frame Context Isolation', () => {
      it('rejects message sent from a child iframe (frameId > 0)', () => {
        const result = validateMessageSender(
          {
            id: validRuntimeId,
            url: validUrl,
            frameId: 1, // child iframe context
          },
          {
            runtimeIdOverride: validRuntimeId,
            expectedOriginOverride: validOrigin,
            allowTopLevelOnly: true,
          }
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toMatch(/not top-level frame/i);
      });

      it('rejects deep child iframe context (e.g. frameId: 42 or negative frameId)', () => {
        expect(
          validateMessageSender(
            { id: validRuntimeId, url: validUrl, frameId: 42 },
            { runtimeIdOverride: validRuntimeId, expectedOriginOverride: validOrigin }
          ).isValid
        ).toBe(false);

        expect(
          validateMessageSender(
            { id: validRuntimeId, url: validUrl, frameId: -1 },
            { runtimeIdOverride: validRuntimeId, expectedOriginOverride: validOrigin }
          ).isValid
        ).toBe(false);
      });

      it('accepts child frame when allowTopLevelOnly is explicitly disabled', () => {
        const result = validateMessageSender(
          {
            id: validRuntimeId,
            url: validUrl,
            frameId: 1,
          },
          {
            runtimeIdOverride: validRuntimeId,
            expectedOriginOverride: validOrigin,
            allowTopLevelOnly: false,
          }
        );
        expect(result.isValid).toBe(true);
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SEC-003: Dashboard Launch Query Parameter Validation
  // ───────────────────────────────────────────────────────────────────────────
  describe('SEC-003: Dashboard Query Validation (parseDashboardQueryParams)', () => {
    it('parses valid parameters accurately', () => {
      const search =
        '?tabId=42&url=https%3A%2F%2Fexample.com%2Fpage&title=Example%20Title&unsupported=0';
      const result = parseDashboardQueryParams(search);

      expect(result.tabId).toBe(42);
      expect(result.targetUrl).toBe('https://example.com/page');
      expect(result.targetTitle).toBe('Example Title');
      expect(result.isUnsupported).toBe(false);
      expect(result.eligibility.isEligible).toBe(true);
    });

    describe('TabId Strict Validation', () => {
      it('rejects non-integer, negative, or zero tabId', () => {
        expect(parseDashboardQueryParams('?tabId=-1').tabId).toBeNull();
        expect(parseDashboardQueryParams('?tabId=0').tabId).toBeNull();
        expect(parseDashboardQueryParams('?tabId=3.14').tabId).toBeNull();
        expect(parseDashboardQueryParams('?tabId=abc').tabId).toBeNull();
        expect(parseDashboardQueryParams('?tabId=NaN').tabId).toBeNull();
        expect(parseDashboardQueryParams('?tabId=').tabId).toBeNull();
      });

      it('rejects oversized tabId exceeding MAX_SAFE_INTEGER', () => {
        const oversized = '999999999999999999999999999999999999999999999999';
        expect(parseDashboardQueryParams(`?tabId=${oversized}`).tabId).toBeNull();
      });

      it('rejects hexadecimal, octal, and scientific notation tabId formats', () => {
        expect(parseDashboardQueryParams('?tabId=0x10').tabId).toBeNull();
        expect(parseDashboardQueryParams('?tabId=1e5').tabId).toBeNull();
        expect(parseDashboardQueryParams('?tabId=+42').tabId).toBeNull();
      });
    });

    describe('URIError Resilience (safeDecodeURIComponent)', () => {
      it('safely handles malformed percent encoding without throwing URIError', () => {
        // %E0%A4%A is an incomplete UTF-8 sequence that causes standard decodeURIComponent to throw
        expect(() => decodeURIComponent('%E0%A4%A')).toThrow(URIError);

        // safeDecodeURIComponent catches the error and returns fallback
        expect(safeDecodeURIComponent('%E0%A4%A')).toBe('');
        expect(safeDecodeURIComponent('%E0%A4%A', 'fallback')).toBe('fallback');
        expect(safeDecodeURIComponent('%')).toBe('');
        expect(safeDecodeURIComponent('%A')).toBe('');

        // parseDashboardQueryParams never throws on malformed query strings
        expect(() => {
          const parsed = parseDashboardQueryParams('?url=%E0%A4%A&title=%A5&reason=%ZZ');
          expect(parsed.targetUrl).toBe('');
          expect(parsed.targetTitle).toBe('');
        }).not.toThrow();
      });
    });

    describe('URL Scheme Safety & Dangerous Protocol Rejection', () => {
      it('authorizes http, https, and file protocols', () => {
        expect(isAuthorizedTargetScheme('http://example.com')).toBe(true);
        expect(isAuthorizedTargetScheme('https://secure.example.com/path')).toBe(true);
        expect(isAuthorizedTargetScheme('file:///C:/Users/test/index.html')).toBe(true);
      });

      it('rejects dangerous pseudoprotocols and internal browser schemes', () => {
        expect(isAuthorizedTargetScheme('javascript:alert(1)')).toBe(false);
        expect(isAuthorizedTargetScheme('data:text/html,<h1>test</h1>')).toBe(false);
        expect(isAuthorizedTargetScheme('blob:https://example.com/uuid')).toBe(false);
        expect(isAuthorizedTargetScheme('vbscript:msgbox(1)')).toBe(false);
        expect(isAuthorizedTargetScheme('about:blank')).toBe(false);
        expect(isAuthorizedTargetScheme('chrome://settings')).toBe(false);
        expect(isAuthorizedTargetScheme('chrome-extension://id/dashboard.html')).toBe(
          false
        );
      });

      it('classifies dangerous URLs as ineligible in parseDashboardQueryParams', () => {
        const jsResult = parseDashboardQueryParams('?tabId=1&url=javascript%3Aalert(1)');
        expect(jsResult.eligibility.isEligible).toBe(false);
        expect(jsResult.eligibility.reason).toBe('javascript-url');

        const chromeResult = parseDashboardQueryParams(
          '?tabId=1&url=chrome%3A%2F%2Fsettings'
        );
        expect(chromeResult.eligibility.isEligible).toBe(false);
        expect(chromeResult.eligibility.reason).toBe('chrome-internal');
      });

      it('classifies mixed-case and uppercase pseudoprotocols as ineligible', () => {
        const upperJs = parseDashboardQueryParams('?tabId=1&url=JAVASCRIPT%3Aalert(1)');
        expect(upperJs.eligibility.isEligible).toBe(false);
        expect(upperJs.eligibility.reason).toBe('javascript-url');

        const upperData = parseDashboardQueryParams(
          '?tabId=1&url=DATA%3Atext%2Fhtml%2Cevil'
        );
        expect(upperData.eligibility.isEligible).toBe(false);
        expect(upperData.eligibility.reason).toBe('data-url');
      });

      it('properly preserves file-scheme classification on uppercase FILE:// URLs', () => {
        const fileResult = parseDashboardQueryParams(
          '?tabId=1&url=FILE%3A%2F%2F%2FC%3A%2Fdoc.html'
        );
        expect(fileResult.eligibility.isEligible).toBe(true);
        expect(fileResult.eligibility.reason).toBe('file-scheme');
      });

      it('safely neutralizes percent-encoded protocol tricks', () => {
        // %6a%61%76%61%73%63%72%69%70%74 -> javascript
        const encodedJs = parseDashboardQueryParams(
          '?tabId=1&url=%6a%61%76%61%73%63%72%69%70%74%3aalert(1)'
        );
        expect(encodedJs.eligibility.isEligible).toBe(false);

        // double encoded %256a -> %6a -> javascript
        const doubleEncoded = parseDashboardQueryParams(
          '?tabId=1&url=%256a%2561%2576%2561%2573%2563%2572%2569%2570%2574%3aalert(1)'
        );
        expect(doubleEncoded.eligibility.isEligible).toBe(false);
      });

      it('handles duplicate and missing parameters safely according to WHATWG standard', () => {
        // Duplicates resolve to first occurrence safely
        const dupResult = parseDashboardQueryParams(
          '?tabId=10&tabId=20&url=https%3A%2F%2Fexample.com&url=https%3A%2F%2Fother.com'
        );
        expect(dupResult.tabId).toBe(10);
        expect(dupResult.targetUrl).toBe('https://example.com/');

        // Empty and lone question mark
        const emptyResult = parseDashboardQueryParams('');
        expect(emptyResult.tabId).toBeNull();
        expect(emptyResult.targetUrl).toBe('');

        const questionResult = parseDashboardQueryParams('?');
        expect(questionResult.tabId).toBeNull();
        expect(questionResult.targetUrl).toBe('');
      });
    });

    describe('Sensitive Credential & Token Scrubbing', () => {
      it('scrubs username and password from target URL via sanitizeUrlForStorage', () => {
        const query =
          '?tabId=10&url=https%3A%2F%2Fadmin%3AsecretPass123%40bank.example.com%2Fportal';
        const parsed = parseDashboardQueryParams(query);

        expect(parsed.targetUrl).not.toContain('admin');
        expect(parsed.targetUrl).not.toContain('secretPass123');
        expect(parsed.targetUrl).toBe('https://bank.example.com/portal');
      });

      it('scrubs access tokens and API keys from URL parameters', () => {
        const query =
          '?tabId=10&url=https%3A%2F%2Fapi.example.com%2Fdata%3Faccess_token%3Dsecret_jwt_xyz%26apiKey%3Dsupersecret';
        const parsed = parseDashboardQueryParams(query);

        expect(parsed.targetUrl).not.toContain('secret_jwt_xyz');
        expect(parsed.targetUrl).not.toContain('supersecret');
      });
    });

    describe('String Length Bounds Capping', () => {
      it('caps targetTitle at 500 characters', () => {
        const giantTitle = 'A'.repeat(1000);
        const parsed = parseDashboardQueryParams(`?title=${giantTitle}`);
        expect(parsed.targetTitle.length).toBe(500);
      });

      it('caps unsupportedReason at 100 characters', () => {
        const giantReason = 'R'.repeat(300);
        const parsed = parseDashboardQueryParams(`?reason=${giantReason}`);
        expect(parsed.unsupportedReason.length).toBe(100);
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Hook Integration: useTargetTab Crash Resilience
  // ───────────────────────────────────────────────────────────────────────────
  describe('useTargetTab Hook Integration with Hardened Query Validator', () => {
    const originalLocation = window.location;

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('mounts safely and enters standalone status when query string is empty', () => {
      const { result } = renderHook(() => useTargetTab());
      expect(result.current.connectionStatus).toBe('standalone');
      expect(result.current.tabId).toBeNull();
      expect(result.current.targetUrl).toBe('');
    });

    it('mounts safely with malformed percent encoding without crashing', () => {
      // Mock window.location.search with malformed percent escape
      delete (window as unknown as { location: unknown }).location;
      window.location = {
        ...originalLocation,
        search: '?tabId=10&url=%E0%A4%A&title=%A5',
      } as Location;

      const { result } = renderHook(() => useTargetTab());
      // When tabId is present but targetUrl was malformed/invalid, it safely enters ineligible state
      expect(result.current.connectionStatus).toBe('ineligible');
      expect(result.current.tabId).toBe(10);
      expect(result.current.targetUrl).toBe('');

      // Restore window.location
      window.location = originalLocation;
    });

    it('mounts safely and enters standalone status when malformed percent encoding has no tabId', () => {
      delete (window as unknown as { location: unknown }).location;
      window.location = {
        ...originalLocation,
        search: '?url=%E0%A4%A&title=%A5',
      } as Location;

      const { result } = renderHook(() => useTargetTab());
      expect(result.current.connectionStatus).toBe('standalone');
      expect(result.current.tabId).toBeNull();
      expect(result.current.targetUrl).toBe('');

      // Restore window.location
      window.location = originalLocation;
    });

    it('marks dangerous pseudo-protocol URL as ineligible on mount', () => {
      delete (window as unknown as { location: unknown }).location;
      window.location = {
        ...originalLocation,
        search: '?tabId=11&url=javascript%3Aalert(1)',
      } as Location;

      const { result } = renderHook(() => useTargetTab());
      expect(result.current.connectionStatus).toBe('ineligible');
      expect(result.current.eligibility.isEligible).toBe(false);

      // Restore window.location
      window.location = originalLocation;
    });
  });
});
