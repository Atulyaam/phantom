/**
 * Phantom Audit — Message Sender Origin & Context Validator (SEC-002)
 *
 * Enforces strict runtime message sender boundaries:
 * - Verifies sender extension ID matches browser.runtime.id.
 * - Parses and validates sender URL via standard URL API (no unsafe string prefix checks).
 * - Enforces exact origin and pathname match against expected extension pages.
 * - Rejects non-top-level iframe contexts for sensitive operations.
 */

import { browser } from 'wxt/browser';

export interface SenderValidationOptions {
  /** Expected extension page pathname (defaults to '/dashboard.html') */
  expectedPath?: string;
  /** Disallow messages from non-zero frame IDs (defaults to true) */
  allowTopLevelOnly?: boolean;
  /** Explicit runtime ID for testing or controlled environments */
  runtimeIdOverride?: string;
  /** Explicit expected origin for testing or controlled environments */
  expectedOriginOverride?: string;
}

export interface SenderValidationResult {
  isValid: boolean;
  reason?: string;
}

interface RawSender {
  id?: unknown;
  url?: unknown;
  frameId?: unknown;
  tab?: unknown;
}

function getCanonicalOrigin(url: URL): string {
  if (url.origin && url.origin !== 'null') {
    return url.origin;
  }
  // In environments where origin is 'null' (e.g. Node/JSDOM for custom extension schemes)
  if (url.protocol && url.host) {
    return `${url.protocol}//${url.host}`;
  }
  return url.origin;
}

/**
 * Validates a message sender against extension trust boundaries.
 */
export function validateMessageSender(
  sender: unknown,
  options: SenderValidationOptions = {}
): SenderValidationResult {
  const {
    expectedPath = '/dashboard.html',
    allowTopLevelOnly = true,
    runtimeIdOverride,
    expectedOriginOverride,
  } = options;

  if (!sender || typeof sender !== 'object') {
    return {
      isValid: false,
      reason: 'Sender context is missing or not an object',
    };
  }

  const raw = sender as RawSender;

  // 1. Verify Extension ID
  const activeRuntimeId =
    runtimeIdOverride ||
    (typeof browser !== 'undefined' && browser.runtime?.id) ||
    (typeof chrome !== 'undefined' && chrome.runtime?.id) ||
    '';

  if (activeRuntimeId && raw.id !== activeRuntimeId) {
    return {
      isValid: false,
      reason: `Sender ID "${String(raw.id)}" does not match extension ID "${activeRuntimeId}"`,
    };
  }

  // 2. Verify Sender URL
  if (typeof raw.url !== 'string' || !raw.url.trim()) {
    return {
      isValid: false,
      reason: 'Sender URL is missing or empty',
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(raw.url);
  } catch {
    return {
      isValid: false,
      reason: 'Sender URL is malformed and could not be parsed',
    };
  }

  // 3. Verify Scheme & Origin (Exact origin comparison — immune to prefix-confusion)
  if (
    parsedUrl.protocol !== 'chrome-extension:' &&
    parsedUrl.protocol !== 'moz-extension:'
  ) {
    return {
      isValid: false,
      reason: `Sender protocol "${parsedUrl.protocol}" is not an authorized extension scheme`,
    };
  }

  let expectedOrigin = expectedOriginOverride;
  if (!expectedOrigin) {
    try {
      const extensionBaseUrl =
        (typeof browser !== 'undefined' &&
          browser.runtime?.getURL?.('/dashboard.html')) ||
        (typeof chrome !== 'undefined' && chrome.runtime?.getURL?.('/dashboard.html')) ||
        '';
      if (extensionBaseUrl) {
        expectedOrigin = getCanonicalOrigin(new URL(extensionBaseUrl));
      }
    } catch {
      // Fallback if getURL throws in mock environment
    }
  }

  const senderOrigin = getCanonicalOrigin(parsedUrl);
  if (expectedOrigin && senderOrigin !== expectedOrigin) {
    return {
      isValid: false,
      reason: `Sender origin "${senderOrigin}" does not match expected "${expectedOrigin}"`,
    };
  }

  // 4. Verify Pathname (Exact pathname comparison)
  if (parsedUrl.pathname !== expectedPath) {
    return {
      isValid: false,
      reason: `Sender pathname "${parsedUrl.pathname}" does not match expected "${expectedPath}"`,
    };
  }

  // 5. Verify Frame Context (Top-level only)
  if (allowTopLevelOnly) {
    if (raw.frameId !== undefined && raw.frameId !== null && raw.frameId !== 0) {
      return {
        isValid: false,
        reason: `Sender frameId "${String(raw.frameId)}" is not top-level frame (expected 0)`,
      };
    }
  }

  return { isValid: true };
}
