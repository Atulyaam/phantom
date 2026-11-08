/**
 * Phantom Audit — Zero-Permission Report Download Engine
 *
 * Implements Phase 8 Workstream 4:
 * - Browser-native HTML5 Blob download handler.
 * - Predictable, sanitized filenames preventing path traversal.
 * - Correct MIME types (application/json, text/html) and UTF-8 charset.
 * - Object URL cleanup with guaranteed revocation.
 * - ZERO Chrome "downloads" permission required.
 */

import type { ScanRecord } from '@/domain/scan';

/**
 * Sanitizes a hostname for safe filename generation.
 * Strips ports, special characters, and prevents path traversal (../).
 */
export function sanitizeFilenamePart(raw: string): string {
  if (!raw) return 'unknown';

  let cleaned = raw.toLowerCase().trim();
  // Strip protocol
  cleaned = cleaned.replace(/^[a-z]+:\/\//, '');

  // Strip query strings and fragment identifiers (DEF-841)
  cleaned = (cleaned.split('?')[0] ?? '').split('#')[0] ?? '';

  // Strip userinfo credentials (user:pass@) (DEF-841)
  cleaned = cleaned.replace(/^[^/@]+@/, '');

  // Extract host part before port or path if not a relative path starting with dot
  if (!cleaned.startsWith('.')) {
    const hostMatch = cleaned.match(/^([^/?#:]+)/);
    if (hostMatch && hostMatch[1]) {
      cleaned = hostMatch[1];
    }
  }

  cleaned = cleaned
    .replace(/[/\\]+/g, '-') // replace path separators
    .replace(/[^a-z0-9.-]+/g, '-') // replace non-alphanumeric except dots/hyphens
    .replace(/\.+/g, '-') // neutralize dots into hyphens to eliminate traversal
    .replace(/^-+|-+$/g, '') // trim leading/trailing hyphens
    .slice(0, 40); // limit length

  return cleaned || 'unknown';
}

/**
 * Generates a clean, predictable filename for report exports.
 * Example: phantom-audit-example-com-2026-11-07.html
 */
export function generateReportFilename(
  scan: Readonly<ScanRecord>,
  format: 'json' | 'html',
  exportedAt?: string
): string {
  const hostPart = sanitizeFilenamePart(scan.hostname || scan.tabUrl);

  let datePart = 'export';
  try {
    const rawDate = exportedAt || scan.scannedAt || new Date().toISOString();
    datePart = rawDate.slice(0, 10); // YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      datePart = 'export';
    }
  } catch {
    datePart = 'export';
  }

  const ext = format === 'json' ? 'json' : 'html';
  return `phantom-audit-${hostPart}-${datePart}.${ext}`;
}

/**
 * MIME type mapping for exported report formats.
 */
export const REPORT_MIME_TYPES: Record<'json' | 'html', string> = {
  json: 'application/json;charset=utf-8',
  html: 'text/html;charset=utf-8',
};

/**
 * Triggers a browser-native file download using a temporary Object URL anchor.
 * Ensures the temporary anchor and Object URL are completely cleaned up.
 *
 * @throws {Error} if Blob creation or DOM dispatch fails.
 */
export function downloadReportBlob(
  content: string,
  filename: string,
  format: 'json' | 'html',
  cleanupDelayMs = 1000
): void {
  const mimeType = REPORT_MIME_TYPES[format] || 'text/plain;charset=utf-8';
  let objectUrl: string | null = null;
  let tempAnchor: HTMLAnchorElement | null = null;
  let isRevoked = false;

  try {
    const blob = new Blob([content], { type: mimeType });
    objectUrl = URL.createObjectURL(blob);

    tempAnchor = document.createElement('a');
    tempAnchor.href = objectUrl;
    tempAnchor.download = filename;
    tempAnchor.style.display = 'none';
    tempAnchor.setAttribute('aria-hidden', 'true');

    document.body.appendChild(tempAnchor);
    tempAnchor.click();
  } catch (err) {
    // If dispatch fails, attempt immediate revocation and prevent redundant delayed revocation (DEF-842)
    if (objectUrl && !isRevoked) {
      isRevoked = true;
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // Ignore revocation error on failure
      }
    }
    throw new Error(
      `Failed to initiate report download: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  } finally {
    if (tempAnchor && tempAnchor.parentNode) {
      tempAnchor.parentNode.removeChild(tempAnchor);
    }
    if (objectUrl && !isRevoked) {
      // Defer revocation slightly to ensure Chromium has queued the download stream
      const urlToRevoke = objectUrl;
      setTimeout(() => {
        try {
          URL.revokeObjectURL(urlToRevoke);
        } catch {
          // Ignore background cleanup errors
        }
      }, cleanupDelayMs);
    }
  }
}
