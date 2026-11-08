/**
 * Target Tab URL Eligibility & Classification Engine
 *
 * Enforces Chromium extension security boundaries:
 * Identifies restricted internal pages, web stores, and inaccessible targets
 * with clear diagnostic reasons and remediation guidance.
 */

export type UnsupportedReason =
  | 'chrome-internal'
  | 'edge-internal'
  | 'browser-error'
  | 'about-page'
  | 'view-source'
  | 'web-store'
  | 'extension-internal'
  | 'data-url'
  | 'javascript-url'
  | 'file-scheme'
  | 'invalid-url'
  | 'tab-closed';

export interface TabEligibilityResult {
  isEligible: boolean;
  reason?: UnsupportedReason;
  title: string;
  guidance?: string;
  normalizedUrl: string;
}

/**
 * Validates whether a target URL is eligible for accessibility inspection.
 */
export function validateTabEligibility(
  url: string | undefined | null
): TabEligibilityResult {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return {
      isEligible: false,
      reason: 'invalid-url',
      title: 'Missing or Empty Target URL',
      guidance:
        'No target page URL was provided. Please navigate to a webpage and launch Phantom Audit.',
      normalizedUrl: '',
    };
  }

  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();

  // 1. Browser internal chrome:// pages and chrome-error://
  if (lower.startsWith('chrome://') || lower.startsWith('chrome-error://')) {
    return {
      isEligible: false,
      reason: lower.startsWith('chrome-error://') ? 'browser-error' : 'chrome-internal',
      title: lower.startsWith('chrome-error://')
        ? 'Browser Error Page Restricted'
        : 'Chrome Internal Page Restricted',
      guidance:
        'Browser security prohibits extensions from inspecting internal browser and error pages. Please navigate to a standard website.',
      normalizedUrl: trimmed,
    };
  }

  // 2. Browser internal edge:// pages
  if (lower.startsWith('edge://')) {
    return {
      isEligible: false,
      reason: 'edge-internal',
      title: 'Edge Internal Page Restricted',
      guidance:
        'Browser security prohibits extensions from inspecting edge:// pages. Please open a standard HTTP or HTTPS website.',
      normalizedUrl: trimmed,
    };
  }

  // 3. Browser about: pages (about:blank, about:config)
  if (lower.startsWith('about:')) {
    return {
      isEligible: false,
      reason: 'about-page',
      title: 'Browser About Page Restricted',
      guidance:
        'Extensions cannot inspect about: pages. Please navigate to an active web page.',
      normalizedUrl: trimmed,
    };
  }

  // 4. Source code viewer
  if (lower.startsWith('view-source:')) {
    return {
      isEligible: false,
      reason: 'view-source',
      title: 'Source View Restricted',
      guidance:
        'Cannot audit view-source pages directly. Please audit the rendered HTML document instead.',
      normalizedUrl: trimmed,
    };
  }

  // 5. Extension internal pages (chrome-extension://)
  if (lower.startsWith('chrome-extension://') || lower.startsWith('moz-extension://')) {
    return {
      isEligible: false,
      reason: 'extension-internal',
      title: 'Extension Internal Page Restricted',
      guidance:
        'Browser extensions cannot audit other extension pages or their own dashboard to prevent recursion.',
      normalizedUrl: trimmed,
    };
  }

  // 6. Data URLs
  if (lower.startsWith('data:')) {
    return {
      isEligible: false,
      reason: 'data-url',
      title: 'Data URI Scheme Ineligible',
      guidance:
        'data: URIs are isolated from standard document contexts and cannot be reliably audited by extensions.',
      normalizedUrl: trimmed,
    };
  }

  // 7. JavaScript pseudoprotocol
  if (lower.startsWith('javascript:')) {
    return {
      isEligible: false,
      reason: 'javascript-url',
      title: 'JavaScript URI Ineligible',
      guidance: 'JavaScript pseudo-URLs are not valid web documents.',
      normalizedUrl: trimmed,
    };
  }

  // 8. File scheme (requires explicit browser setting)
  if (lower.startsWith('file://')) {
    return {
      isEligible: true,
      reason: 'file-scheme',
      title: 'Local File Inspection',
      guidance:
        'Inspecting local file:// pages requires enabling "Allow access to file URLs" in chrome://extensions for Phantom Audit.',
      normalizedUrl: trimmed,
    };
  }

  // 9. Web Stores (Google Web Store, Edge Addons)
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    const isGoogleWebStore =
      host === 'chromewebstore.google.com' ||
      (host === 'chrome.google.com' && parsed.pathname.startsWith('/webstore'));

    const isEdgeAddons =
      host === 'microsoftedge.microsoft.com' && parsed.pathname.startsWith('/addons');

    if (isGoogleWebStore || isEdgeAddons) {
      return {
        isEligible: false,
        reason: 'web-store',
        title: 'Browser Web Store Protected',
        guidance:
          'Chromium prevents extension script execution on official web store domains for user security.',
        normalizedUrl: trimmed,
      };
    }

    // Must be http: or https:
    if (
      parsed.protocol !== 'http:' &&
      parsed.protocol !== 'https:' &&
      parsed.protocol !== 'file:'
    ) {
      return {
        isEligible: false,
        reason: 'invalid-url',
        title: 'Unsupported Protocol Scheme',
        guidance: `Protocol "${parsed.protocol}" is not supported for accessibility evaluation. Use http:// or https://.`,
        normalizedUrl: trimmed,
      };
    }

    return {
      isEligible: true,
      title: 'Eligible Target Page',
      normalizedUrl: trimmed,
    };
  } catch {
    return {
      isEligible: false,
      reason: 'invalid-url',
      title: 'Invalid URL Format',
      guidance: 'The target URL could not be parsed as a valid address.',
      normalizedUrl: trimmed,
    };
  }
}
