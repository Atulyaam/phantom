/**
 * Phantom Audit — Deterministic JSON Report Serializer
 *
 * Implements FR-060:
 * - Builds strongly typed, versioned (1.0.0) report export payloads from completed scans.
 * - Stably orders findings by severity, room, rule ID, and fingerprint.
 * - Enforces Zod schema validation before producing serialized JSON.
 * - Preserves complete immutability of the source scan and remediation records.
 * - Distinguishes between normative WCAG failures and best-practice advisory findings.
 */

import type { ScanRecord } from '@/domain/scan';
import type { Impact } from '@/domain/finding';
import { MANSION_ROOMS, type RoomId } from '@/domain/room';
import type {
  ExportReportOptions,
  ExportedFinding,
  ExportedFindingNode,
  ExportedFindingRemediation,
  ReportExportPayload,
  ReportMetadata,
  ReportSummary,
  ReportTarget,
  RoomSummary,
} from '@/domain/report';
import type { RemediationStoragePayload, RuleClassification } from '@/domain/remediation';
import { ReportExportPayloadSchema } from '@/lib/validation/schemas';
import { REMEDIATION_CATALOG } from '@/features/remediation/remediation-catalog';
import { sanitizeUrlForStorage } from '@/lib/storage';
import {
  AUTOMATED_TESTING_LIMITATIONS,
  MANUAL_REVIEW_CHECKLIST_PROMPTS,
} from './disclaimers';

const IMPACT_RANK: Record<Impact, number> = {
  critical: 0,
  serious: 1,
  moderate: 2,
  minor: 3,
  unknown: 4,
};

const ALL_ROOM_IDS: readonly RoomId[] = [
  'name-chamber',
  'contrast-crypt',
  'portrait-gallery',
  'form-cellar',
  'structure-hall',
  'focus-corridor',
  'other',
];

/**
 * Determines whether a rule represents a normative WCAG failure or an advisory best practice.
 */
export function determineRuleClassification(
  ruleId: string,
  wcagTags: readonly string[]
): RuleClassification {
  if (REMEDIATION_CATALOG[ruleId]) {
    return REMEDIATION_CATALOG[ruleId].classification;
  }
  const isNormativeWcag = wcagTags.some((tag) => tag.toLowerCase().startsWith('wcag'));
  return isNormativeWcag ? 'normative-wcag' : 'best-practice';
}

/**
 * Deterministically sorts finding records by:
 * 1. Severity rank (critical -> serious -> moderate -> minor -> unknown)
 * 2. RoomId alphabetically
 * 3. RuleId alphabetically
 * 4. Fingerprint alphabetically
 *
 * Does NOT mutate the input array.
 */
export function sortFindingsDeterministically(
  findings: readonly ExportedFinding[]
): ExportedFinding[] {
  return [...findings].sort((a, b) => {
    const rankA = IMPACT_RANK[a.impact] ?? 4;
    const rankB = IMPACT_RANK[b.impact] ?? 4;
    if (rankA !== rankB) return rankA - rankB;

    const roomCmp = a.roomId.localeCompare(b.roomId);
    if (roomCmp !== 0) return roomCmp;

    const ruleCmp = a.ruleId.localeCompare(b.ruleId);
    if (ruleCmp !== 0) return ruleCmp;

    return a.fingerprint.localeCompare(b.fingerprint);
  });
}

/**
 * Generates a standard UUID fallback if crypto.randomUUID is not available.
 */
function generateReportId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Builds a strongly typed, versioned (1.0.0) report export payload from a scan record.
 * Source scan and remediation records are strictly treated as read-only.
 */
export function buildReportPayload(
  scan: Readonly<ScanRecord>,
  options?: ExportReportOptions,
  remediationRecords?: Readonly<RemediationStoragePayload>,
  reportIdOverride?: string,
  exportedAtOverride?: string
): ReportExportPayload {
  const reportId = options?.reportId || reportIdOverride || generateReportId();
  const exportedAt =
    options?.exportedAt || exportedAtOverride || new Date().toISOString();

  // 1. Build Metadata
  const reportMetadata: ReportMetadata = {
    reportId,
    tool: 'Phantom Audit',
    toolVersion: scan.extensionVersion || '0.1.0',
    schemaVersion: 1,
    version: '1.0.0',
    exportedAt,
    environment: {
      browserName: scan.browserName || 'unknown',
      axeVersion: scan.axeVersion || '4.14.0',
    },
    ...(options ? { optionsApplied: { ...options } } : {}),
  };

  // 2. Build Target (Defense-in-depth sanitization of URL to prevent credential leakage)
  const target: ReportTarget = {
    scanId: scan.id,
    url: sanitizeUrlForStorage(scan.tabUrl),
    hostname: scan.hostname,
    pageTitle: scan.pageTitle,
    scannedAt: scan.scannedAt,
    ...(scan.completedAt ? { completedAt: scan.completedAt } : {}),
  };

  // 3. Initialize Rooms Summary
  const roomsSummary: Record<RoomId, RoomSummary> = {} as Record<RoomId, RoomSummary>;
  for (const roomId of ALL_ROOM_IDS) {
    roomsSummary[roomId] = {
      totalFindings: 0,
      criticalCount: 0,
      seriousCount: 0,
      moderateCount: 0,
      minorCount: 0,
    };
  }

  // 4. Map and Aggregate Findings
  const exportedFindings: ExportedFinding[] = [];
  let criticalCount = 0;
  let seriousCount = 0;
  let moderateCount = 0;
  let minorCount = 0;

  for (const finding of scan.findings) {
    // Accumulate total severity counts
    if (finding.impact === 'critical') criticalCount++;
    else if (finding.impact === 'serious') seriousCount++;
    else if (finding.impact === 'moderate') moderateCount++;
    else if (finding.impact === 'minor') minorCount++;

    // Accumulate room-level severity counts
    const roomBucket = roomsSummary[finding.roomId] || roomsSummary.other;
    roomBucket.totalFindings++;
    if (finding.impact === 'critical') roomBucket.criticalCount++;
    else if (finding.impact === 'serious') roomBucket.seriousCount++;
    else if (finding.impact === 'moderate') roomBucket.moderateCount++;
    else if (finding.impact === 'minor') roomBucket.minorCount++;

    // Format nodes (copying targets defensively, stably sorting nodes by primary target)
    const nodes: ExportedFindingNode[] = finding.nodes
      .map((n) => {
        const node: ExportedFindingNode = {
          target: [...n.target],
          failureSummary: n.failureSummary,
        };
        if (options?.includeHtmlExcerpts !== false && n.htmlExcerpt !== undefined) {
          node.htmlExcerpt = n.htmlExcerpt;
        }
        return node;
      })
      .sort((a, b) => (a.target[0] || '').localeCompare(b.target[0] || ''));

    // Resolve remediation recommendation if available
    let remediationRecommendation: ExportedFindingRemediation | undefined;
    const catalogItem = REMEDIATION_CATALOG[finding.ruleId];
    const storedRecord = remediationRecords?.[finding.fingerprint];

    if (catalogItem || storedRecord) {
      remediationRecommendation = {
        summary: catalogItem?.whyItMatters || finding.help,
        ...(catalogItem?.goodExamples?.[0]?.code
          ? { suggestedSnippet: catalogItem.goodExamples[0].code }
          : {}),
        ...(catalogItem?.verificationSteps?.[0]?.instruction
          ? { verificationMethod: catalogItem.verificationSteps[0].instruction }
          : {}),
        ...(storedRecord?.status ? { status: storedRecord.status } : {}),
        ...(storedRecord?.notes ? { notes: storedRecord.notes } : {}),
      };
    }

    const exportedFinding: ExportedFinding = {
      fingerprint: finding.fingerprint,
      ruleId: finding.ruleId,
      impact: finding.impact,
      roomId: finding.roomId,
      roomName: MANSION_ROOMS[finding.roomId]?.name || 'The Unmapped Catacombs',
      description: finding.description,
      help: finding.help,
      ...(finding.helpUrl ? { helpUrl: finding.helpUrl } : {}),
      wcagTags: [...finding.wcagTags],
      ruleClassification: determineRuleClassification(finding.ruleId, finding.wcagTags),
      affectedNodeCount: finding.affectedNodeCount,
      nodes,
      reviewed: finding.reviewed,
      ...(finding.comparisonCategory
        ? { comparisonCategory: finding.comparisonCategory }
        : {}),
      ...(finding.uncertainReason ? { uncertainReason: finding.uncertainReason } : {}),
      ...(remediationRecommendation ? { remediationRecommendation } : {}),
    };

    exportedFindings.push(exportedFinding);
  }

  // 5. Stably sort findings
  const sortedFindings = sortFindingsDeterministically(exportedFindings);

  // 6. Build Summary
  const summary: ReportSummary = {
    totalFindings: scan.findings.length,
    criticalCount,
    seriousCount,
    moderateCount,
    minorCount,
    passesCount: scan.passesCount ?? 0,
    incompleteChecksCount: scan.incompleteChecksCount ?? 0,
    inapplicableCount: scan.inapplicableCount ?? 0,
    roomsSummary,
  };

  const payload: ReportExportPayload = {
    reportMetadata,
    target,
    summary,
    findings: sortedFindings,
    limitations: AUTOMATED_TESTING_LIMITATIONS,
    manualReviewChecklist: [...MANUAL_REVIEW_CHECKLIST_PROMPTS],
  };

  // Validate the payload against Zod schema to ensure 100% schema conformance
  return ReportExportPayloadSchema.parse(payload) as ReportExportPayload;
}

/**
 * Serializes a report payload into deterministic, formatted JSON.
 * Validates against ReportExportPayloadSchema before returning.
 *
 * Defense-in-depth: Enforces that target.url is always sanitized and conforms
 * to optionsApplied (if present), eliminating export API bypass risks.
 */
export function serializeReportToJson(payload: ReportExportPayload): string {
  // Validate schema before serialization
  const validated = ReportExportPayloadSchema.parse(payload) as ReportExportPayload;

  // Ensure deterministic finding order
  const stablyOrderedFindings = sortFindingsDeterministically(validated.findings);

  // Defense-in-depth: guarantee target.url is sanitized
  let safeUrl = sanitizeUrlForStorage(validated.target.url);
  if (validated.reportMetadata.optionsApplied?.urlRedactionLevel) {
    const level = validated.reportMetadata.optionsApplied.urlRedactionLevel;
    if (level === 'hostname-only' && safeUrl.includes('/')) {
      try {
        const u = new URL(safeUrl);
        safeUrl = u.host ? `${u.protocol}//${u.host}` : u.origin;
      } catch {
        safeUrl = '[REDACTED_URL]';
      }
    } else if (
      level === 'path-only' &&
      (safeUrl.includes('?') || safeUrl.includes('#'))
    ) {
      safeUrl = safeUrl.split('?')[0]?.split('#')[0] ?? safeUrl;
    }
  }

  const normalizedPayload: ReportExportPayload = {
    ...validated,
    target: {
      ...validated.target,
      url: safeUrl,
    },
    findings: stablyOrderedFindings,
  };

  return JSON.stringify(normalizedPayload, null, 2);
}

/**
 * Deserializes and validates a JSON report string into a strongly typed ReportExportPayload.
 */
export function deserializeReportFromJson(jsonString: string): ReportExportPayload {
  const parsed = JSON.parse(jsonString);
  return ReportExportPayloadSchema.parse(parsed) as ReportExportPayload;
}
