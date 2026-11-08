/**
 * Phantom Audit — Dashboard Launch Query Validator (SEC-003)
 *
 * Enforces strict input validation on parameters received via window.location.search:
 * - Safely decodes percent-encoded components without throwing URIError.
 * - Scrubs sensitive credentials and tokens from URLs.
 * - Rejects dangerous pseudoprotocols (javascript:, data:, blob:) and internal browser schemes.
 * - Validates tabId, title bounds, and unsupported page reasons.
 */

import { sanitizeUrlForStorage } from '@/lib/storage';
import {
  validateTabEligibility,
  type TabEligibilityResult,
} from '@/features/tab-management/url-validator';

export interface ValidatedDashboardParams {
  tabId: number | null;
  targetUrl: string;
  targetTitle: string;
  isUnsupported: boolean;
  unsupportedReason: string;
  eligibility: TabEligibilityResult;
}

/**
 * Safely decodes a percent-encoded string. Returns fallback on URIError.
 */
export function safeDecodeURIComponent(
  value: string | null | undefined,
  fallback = ''
): string {
  if (!value) return fallback;
  try {
    return decodeURIComponent(value);
  } catch {
    return fallback;
  }
}

/**
 * Validates whether a target URL is structurally safe and uses an authorized scheme.
 * Only http:, https:, and file: are allowed for accessibility auditing.
 */
export function isAuthorizedTargetScheme(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();

  // Reject dangerous pseudo-schemes immediately
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('blob:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('about:')
  ) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return (
      parsed.protocol === 'http:' ||
      parsed.protocol === 'https:' ||
      parsed.protocol === 'file:'
    );
  } catch {
    return false;
  }
}

/**
 * Parses and strictly validates dashboard launch query parameters.
 */
export function parseDashboardQueryParams(search: string): ValidatedDashboardParams {
  const params = new URLSearchParams(search);

  // 1. Validate tabId (must be positive integer)
  const rawTabId = params.get('tabId');
  let tabId: number | null = null;
  if (rawTabId && /^\d+$/.test(rawTabId)) {
    const num = Number(rawTabId);
    if (Number.isSafeInteger(num) && num > 0) {
      tabId = num;
    }
  }

  // 2. Decode and sanitize target URL
  const rawUrlParam = safeDecodeURIComponent(params.get('url')).trim();
  let targetUrl = '';
  if (rawUrlParam && !rawUrlParam.includes('\ufffd')) {
    // Defense-in-depth: scrub credentials and auth tokens first
    const sanitized = sanitizeUrlForStorage(rawUrlParam);
    targetUrl = sanitized;
  }

  // 3. Decode and sanitize page title (capped at 500 characters)
  const rawTitleParam = safeDecodeURIComponent(params.get('title')).trim();
  const targetTitle = rawTitleParam.includes('\ufffd') ? '' : rawTitleParam.slice(0, 500);

  // 4. Validate unsupported flag and reason
  const isUnsupported = params.get('unsupported') === '1';
  const rawReasonParam = safeDecodeURIComponent(params.get('reason')).trim();
  const unsupportedReason = rawReasonParam.includes('\ufffd')
    ? ''
    : rawReasonParam.slice(0, 100);

  // 5. Evaluate Tab Eligibility
  const eligibility = validateTabEligibility(targetUrl);

  return {
    tabId,
    targetUrl,
    targetTitle,
    isUnsupported,
    unsupportedReason,
    eligibility,
  };
}
