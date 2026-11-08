/**
 * Phantom Audit — axe Result Normalizer
 *
 * Converts raw in-page scan results into strictly validated,
 * canonical ScanRecord and FindingRecord domain entities.
 */

import type { ScanRecord } from '@/domain/scan';
import type { FindingRecord, FindingNode, Impact } from '@/domain/finding';
import { ScanRecordSchema } from '@/lib/validation/schemas';
import { mapRuleToRoom } from '@/features/normalization/room-mapper';
import { generateFindingFingerprint } from '@/features/normalization/fingerprint';
import type {
  InPageScanOutput,
  InPageRuleResult,
} from '@/features/scanner/in-page-runner';

export interface NormalizerOptions {
  tabUrl: string;
  pageTitle?: string;
  browserName?: 'chrome' | 'edge' | 'unknown';
  extensionVersion?: string;
}

/**
 * Normalizes an axe impact string to the domain Impact union.
 */
export function normalizeImpact(rawImpact: string | null | undefined): Impact {
  if (!rawImpact) return 'unknown';
  const clean = rawImpact.toLowerCase().trim();
  switch (clean) {
    case 'critical':
      return 'critical';
    case 'serious':
      return 'serious';
    case 'moderate':
      return 'moderate';
    case 'minor':
      return 'minor';
    default:
      return 'unknown';
  }
}

/**
 * Validates and normalizes a helpUrl to ensure it is a valid HTTP/HTTPS URL.
 */
export function sanitizeHelpUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl || typeof rawUrl !== 'string') return undefined;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extracts the hostname safely from a URL string.
 */
export function extractHostname(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return 'unknown-host';
  }
}

/**
 * Detects the host browser name from userAgent or environment.
 */
export function detectBrowserName(): 'chrome' | 'edge' | 'unknown' {
  if (typeof navigator === 'undefined' || !navigator.userAgent) {
    return 'chrome';
  }
  const ua = navigator.userAgent;
  if (ua.includes('Edg/')) return 'edge';
  if (ua.includes('Chrome/')) return 'chrome';
  return 'unknown';
}

/**
 * Converts InPageScanOutput into a validated ScanRecord domain entity.
 */
export function normalizeScanResults(
  output: InPageScanOutput,
  options: NormalizerOptions
): ScanRecord {
  const timestamp = new Date().toISOString();
  const effectiveUrl = options.tabUrl || output.url || 'https://unknown.local';
  const hostname = extractHostname(effectiveUrl);

  const findings: FindingRecord[] = output.violations.map(
    (violation: InPageRuleResult): FindingRecord => {
      // Gather all target selectors across nodes for fingerprinting
      const allTargets: string[] = [];
      const nodes: FindingNode[] = violation.nodes.map((n) => {
        const targetStr = n.target.join(', ') || 'body';
        allTargets.push(...n.target);
        return {
          target: n.target.length > 0 ? n.target : ['body'],
          htmlExcerpt: n.html || `<${targetStr}>`,
          failureSummary: n.failureSummary || violation.help,
        };
      });

      const fingerprint = generateFindingFingerprint(
        violation.id,
        allTargets.length > 0 ? allTargets : [violation.id]
      );

      const roomId = mapRuleToRoom(violation.id);
      const helpUrl = sanitizeHelpUrl(violation.helpUrl);

      // Filter tags to keep wcag and best-practice tags
      const wcagTags = violation.tags.filter(
        (t) => t.startsWith('wcag') || t === 'best-practice'
      );

      return {
        fingerprint,
        ruleId: violation.id,
        impact: normalizeImpact(violation.impact),
        description: violation.description || violation.help,
        help: violation.help,
        ...(helpUrl ? { helpUrl } : {}),
        wcagTags,
        roomId,
        affectedNodeCount: violation.totalNodeCount ?? violation.nodes.length,
        nodes,
        firstSeenAt: timestamp,
        reviewed: false,
      };
    }
  );

  const rawRecord = {
    id: crypto.randomUUID(),
    schemaVersion: 1 as const,
    tabUrl: effectiveUrl,
    pageTitle: options.pageTitle || output.pageTitle || 'Untitled Page',
    hostname,
    scannedAt: timestamp,
    completedAt: timestamp,
    axeVersion: output.axeVersion || '4.14.0',
    extensionVersion: options.extensionVersion || '0.1.0',
    browserName: options.browserName || detectBrowserName(),
    status: 'completed' as const,
    findings,
    incompleteChecksCount: output.incompleteCount,
    passesCount: output.passesCount,
    inapplicableCount: output.inapplicableCount,
  };

  // Strictly validate against Zod schema to prevent malformed data
  return ScanRecordSchema.parse(rawRecord);
}
