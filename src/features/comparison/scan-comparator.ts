/**
 * Phantom Audit — Cross-Scan Comparison Engine
 *
 * Deterministically compares accessibility scans (baseline vs. rescan / historical snapshots)
 * to categorize findings into verified fixes, disappeared findings, unchanged, new (regressions),
 * and uncertain matches.
 *
 * Enforces the core invariants:
 * 1. A finding is NEVER marked resolved solely because its selector changed if the same
 *    failure persists on a matching element type (uncertain match).
 * 2. Absence from rescan alone NEVER equals verified compliance: cleanly absent findings
 *    are categorized as 'disappeared' unless certified by an authoritative Phase 6
 *    verification record matching the certifying rescan ID.
 * 3. Scans across disparate URLs or incomplete scans return structured non-comparable outcomes.
 *    Comparability checks are ALWAYS enforced without bypass.
 * 4. Strictly read-only: comparison never mutates remediation state or storage.
 * 5. Input finding deduplication and deterministic sorting across all output arrays.
 */

import type { ScanRecord } from '@/domain/scan';
import type { FindingRecord, UncertainFindingMatch } from '@/domain/finding';
import type { ScanComparison, ScanComparisonMetrics } from '@/domain/report';
import type {
  RemediationStoragePayload,
  ScanVerificationOutcomeType,
} from '@/domain/remediation';

export interface ScanComparabilityResult {
  isComparable: boolean;
  reason?: string;
  skippedOutcome?: ScanVerificationOutcomeType;
}

export interface CompareScansOptions {
  /**
   * Authoritative Phase 6 remediation records (by finding fingerprint).
   * Used to distinguish verified fixes from mere disappearance.
   */
  remediationRecords?: RemediationStoragePayload;
}

/**
 * Extracts the likely element tag name from a selector string.
 * Examples:
 * - 'button.btn-primary' -> 'button'
 * - 'nav > ul > li:first-child a' -> 'a'
 * - 'input#email' -> 'input'
 * - '#main-container' -> 'div' or ''
 */
export function extractPrimaryTag(selector: string): string {
  if (!selector || typeof selector !== 'string') return '';
  const trimmed = selector.trim();

  // Get the last selector segment (the target element itself)
  const segments = trimmed.split(/[\s>+~]+/);
  const lastSegment = segments[segments.length - 1] || '';

  // Match leading tag name before ., #, [, or :
  const match = lastSegment.match(/^([a-zA-Z0-9-]+)/);
  return match?.[1] ? match[1].toLowerCase() : '';
}

/**
 * Evaluates whether two findings might be an uncertain match where the selector
 * path changed but the underlying failure persists on the same element.
 */
export function evaluateUncertainMatch(
  baseline: FindingRecord,
  candidate: FindingRecord
): { isMatch: boolean; confidence: 'high' | 'medium'; reason: string } {
  // Must share ruleId
  if (baseline.ruleId !== candidate.ruleId) {
    return { isMatch: false, confidence: 'medium', reason: '' };
  }

  // Must share room
  if (baseline.roomId !== candidate.roomId) {
    return { isMatch: false, confidence: 'medium', reason: '' };
  }

  // Check target tag similarity across first nodes
  const baselineTag = baseline.nodes[0]
    ? extractPrimaryTag(baseline.nodes[0].target[0] || '')
    : '';
  const candidateTag = candidate.nodes[0]
    ? extractPrimaryTag(candidate.nodes[0].target[0] || '')
    : '';

  if (baselineTag && candidateTag && baselineTag === candidateTag) {
    return {
      isMatch: true,
      confidence: 'high',
      reason: `Rule '${baseline.ruleId}' continues to fail on a matching <${baselineTag}> element, although the selector path shifted.`,
    };
  }

  // Check if failure summaries match exactly
  const baselineSummary = baseline.nodes[0]?.failureSummary?.trim();
  const candidateSummary = candidate.nodes[0]?.failureSummary?.trim();
  if (baselineSummary && candidateSummary && baselineSummary === candidateSummary) {
    return {
      isMatch: true,
      confidence: 'medium',
      reason: `Rule '${baseline.ruleId}' has an identical failure summary, suggesting the same issue moved within the DOM.`,
    };
  }

  return { isMatch: false, confidence: 'medium', reason: '' };
}

/**
 * Normalizes a URL for deterministic cross-scan comparability.
 *
 * POLICY:
 * 1. Protocol & Hostname: Normalized to lowercase (case-insensitive per RFC 3986).
 * 2. Pathname: Case-sensitive path is PRESERVED (distinct views/resources must not collide).
 *    Trailing slashes on non-root paths are stripped (e.g., /about/ -> /about) to treat identical views consistently.
 * 3. Query Parameters:
 *    - Keys and values preserve case and percent-encoding integrity.
 *    - Parameter keys are sorted alphabetically (order-agnostic).
 *    - Multiple values for the same key are sorted deterministically.
 * 4. Fragments (#):
 *    - Meaningful SPA client routes (e.g. `#/settings`, `#!/dashboard`, or any hash containing `/`)
 *      are PRESERVED as distinct application views.
 *    - Trailing slashes inside SPA route fragments are normalized (e.g. `#/settings/` -> `#/settings`).
 *    - In-page element scroll anchors (e.g. `#top`, `#main-content`, `#section-1`) without `/`
 *      are STRIPPED so scans of different scroll positions on the identical document remain comparable.
 */
export function normalizeUrlForComparison(urlStr: string): string {
  if (!urlStr || typeof urlStr !== 'string') return '';
  const trimmed = urlStr.trim();
  try {
    const url = new URL(trimmed);

    // 1. Lowercase scheme and host only (RFC 3986 section 3.2.2)
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();

    // 2. Fragment normalization: preserve SPA routes, strip in-page scroll anchors
    if (url.hash) {
      const hash = url.hash;
      const cleanHashBody = hash.slice(1).replace(/\/+$/, '');
      const isSpaRoute =
        hash.startsWith('#/') || hash.startsWith('#!/') || cleanHashBody.includes('/');

      if (isSpaRoute) {
        // Normalize trailing slash inside SPA route fragment (e.g. #/settings/ -> #/settings)
        // while preserving root SPA fragments like '#/' or '#!/'
        if (hash === '#/' || hash === '#!/') {
          url.hash = hash;
        } else {
          url.hash = hash.replace(/\/+$/, '');
        }
      } else {
        url.hash = '';
      }
    }

    // 3. Alphabetically sort query parameters to be order-agnostic
    const params = new URLSearchParams(url.search);
    const keys = Array.from(new Set(params.keys())).sort();
    const sorted = new URLSearchParams();
    for (const key of keys) {
      const vals = params.getAll(key).sort();
      for (const val of vals) {
        sorted.append(key, val);
      }
    }
    url.search = sorted.toString() ? `?${sorted.toString()}` : '';

    // 4. Normalize trailing slashes on non-root paths (preserving root /)
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, '');
    }

    return url.toString();
  } catch {
    // If not a parseable URL, fallback: strip in-page anchor if not an SPA route
    const hashIndex = trimmed.indexOf('#');
    if (hashIndex !== -1) {
      const frag = trimmed.slice(hashIndex);
      const cleanFragBody = frag.slice(1).replace(/\/+$/, '');
      const isSpaRoute =
        frag.startsWith('#/') || frag.startsWith('#!/') || cleanFragBody.includes('/');
      if (!isSpaRoute) {
        return trimmed.slice(0, hashIndex);
      }
    }
    return trimmed;
  }
}

/**
 * Evaluates whether two scans are comparable for cross-scan comparison.
 */
export function evaluateScanComparability(
  baselineScan: ScanRecord | null | undefined,
  rescan: ScanRecord | null | undefined
): ScanComparabilityResult {
  if (!baselineScan) {
    return {
      isComparable: false,
      reason: 'No baseline scan available for cross-scan comparison.',
      skippedOutcome: 'incomparable-scan',
    };
  }

  if (!rescan) {
    return {
      isComparable: false,
      reason: 'Rescan record is missing or undefined.',
      skippedOutcome: 'incomparable-scan',
    };
  }

  // Check rescan completion status
  if (rescan.status === 'failed') {
    return {
      isComparable: false,
      reason: 'Rescan failed with an error. Failed scans cannot verify remediation.',
      skippedOutcome: 'failed-scan',
    };
  }

  if (rescan.status === 'cancelled') {
    return {
      isComparable: false,
      reason: 'Rescan was cancelled before completion.',
      skippedOutcome: 'cancelled-scan',
    };
  }

  if (rescan.status !== 'completed') {
    return {
      isComparable: false,
      reason: `Rescan status is '${rescan.status}'. Only fully completed scans can verify fixes.`,
      skippedOutcome: 'incomplete-scan',
    };
  }

  // Check baseline completion status
  if (baselineScan.status !== 'completed') {
    return {
      isComparable: false,
      reason: `Baseline scan status is '${baselineScan.status}'. Cannot verify against an incomplete baseline.`,
      skippedOutcome: 'incomparable-scan',
    };
  }

  // Check URLs
  if (!baselineScan.tabUrl || !rescan.tabUrl) {
    return {
      isComparable: false,
      reason: 'Scan records are missing target URLs.',
      skippedOutcome: 'incomparable-scan',
    };
  }

  const baselineNorm = normalizeUrlForComparison(baselineScan.tabUrl);
  const rescanNorm = normalizeUrlForComparison(rescan.tabUrl);

  if (baselineNorm !== rescanNorm) {
    return {
      isComparable: false,
      reason: `Scan targets differ: baseline '${baselineScan.tabUrl}' vs rescan '${rescan.tabUrl}'. Cannot verify fixes across different pages.`,
      skippedOutcome: 'incomparable-scan',
    };
  }

  return {
    isComparable: true,
  };
}

/**
 * Deterministically compares two accessibility scans.
 *
 * Invariants:
 * 1. If scans are not comparable (different URLs, failed/incomplete status),
 *    returns an incomparable ScanComparison object with isComparable: false.
 *    Comparability checks are strictly mandatory and cannot be bypassed.
 * 2. Findings absent in rescan are partitioned into:
 *    - verifiedResolved: Authoritative Phase 6 verification record exists with status === 'verified'
 *      AND verifiedAtScanId matches rescan.id.
 *    - disappeared: Baseline finding is absent, but no qualifying verification record exists.
 *      Disappearance alone NEVER constitutes verification of compliance.
 * 3. resolved is populated with [...verifiedResolved, ...disappeared] for backward compatibility.
 * 4. Comparison is strictly read-only and free of side effects.
 * 5. Input findings are deduplicated by canonical fingerprint to guarantee one-to-one matching.
 * 6. Output finding lists are sorted deterministically by fingerprint.
 */
export function compareScans(
  baselineScan: ScanRecord,
  rescan: ScanRecord,
  options?: CompareScansOptions
): ScanComparison {
  const timestamp = new Date().toISOString();

  // 1. Mandatory Comparability Check
  const comparability = evaluateScanComparability(baselineScan, rescan);
  if (!comparability.isComparable) {
    const baselineTotal = baselineScan?.findings?.length || 0;
    const rescanTotal = rescan?.findings?.length || 0;

    return {
      fromScanId: baselineScan?.id || '',
      toScanId: rescan?.id || '',
      generatedAt: timestamp,
      isComparable: false,
      incomparableReason: comparability.reason,
      verifiedResolved: [],
      disappeared: [],
      resolved: [],
      unchanged: [],
      newFindings: [],
      uncertainMatches: [],
      metrics: {
        baselineTotal,
        rescanTotal,
        resolvedCount: 0,
        verifiedResolvedCount: 0,
        disappearedCount: 0,
        unchangedCount: 0,
        newCount: 0,
        uncertainCount: 0,
        netProgress: 0,
        verifiedNetProgress: 0,
        improvementScore: 0,
        verifiedImprovementScore: 0,
      },
    };
  }

  // Defensive deduplication of finding inputs by canonical fingerprint
  const uniqueBaselineMap = new Map<string, FindingRecord>();
  for (const f of baselineScan?.findings || []) {
    if (f && f.fingerprint && typeof f.fingerprint === 'string') {
      if (!uniqueBaselineMap.has(f.fingerprint)) {
        uniqueBaselineMap.set(f.fingerprint, f);
      }
    }
  }
  const baselineFindings = Array.from(uniqueBaselineMap.values());

  const uniqueRescanMap = new Map<string, FindingRecord>();
  for (const f of rescan?.findings || []) {
    if (f && f.fingerprint && typeof f.fingerprint === 'string') {
      if (!uniqueRescanMap.has(f.fingerprint)) {
        uniqueRescanMap.set(f.fingerprint, f);
      }
    }
  }
  const rescanFindings = Array.from(uniqueRescanMap.values());

  // Map rescan findings by canonical fingerprint for O(1) lookup
  const rescanByFp = new Map<string, FindingRecord>();
  for (const finding of rescanFindings) {
    rescanByFp.set(finding.fingerprint, finding);
  }

  const baselineByFp = new Map<string, FindingRecord>();
  for (const finding of baselineFindings) {
    baselineByFp.set(finding.fingerprint, finding);
  }

  const unchanged: FindingRecord[] = [];
  const baselineUnmatched: FindingRecord[] = [];

  // 2. Exact Fingerprint Matching (Unchanged)
  for (const baseFinding of baselineFindings) {
    if (rescanByFp.has(baseFinding.fingerprint)) {
      unchanged.push(baseFinding);
    } else {
      baselineUnmatched.push(baseFinding);
    }
  }

  // Rescan candidates not matched by exact fingerprint
  let rescanUnmatched: FindingRecord[] = [];
  for (const rescanFinding of rescanFindings) {
    if (!baselineByFp.has(rescanFinding.fingerprint)) {
      rescanUnmatched.push(rescanFinding);
    }
  }

  // 3. Uncertain Match Resolution (Heuristic similarity check)
  const uncertainMatches: UncertainFindingMatch[] = [];
  const cleanlyAbsent: FindingRecord[] = [];

  for (const baseFinding of baselineUnmatched) {
    // Check if there is an unmatched candidate in rescan that matches rule and tag / failure summary
    const candidateIdx = rescanUnmatched.findIndex((cand) => {
      const evaluation = evaluateUncertainMatch(baseFinding, cand);
      return evaluation.isMatch;
    });

    if (candidateIdx >= 0 && rescanUnmatched[candidateIdx]) {
      const matchedCandidate = rescanUnmatched[candidateIdx]!;
      const evaluation = evaluateUncertainMatch(baseFinding, matchedCandidate);

      uncertainMatches.push({
        baselineFinding: baseFinding,
        candidateRescanFinding: matchedCandidate,
        confidence: evaluation.confidence,
        reason: evaluation.reason,
      });

      // Remove candidate so it is not double-counted as a new regression finding
      rescanUnmatched = rescanUnmatched.filter((_, idx) => idx !== candidateIdx);
    } else {
      // Cleanly absent: absent in rescan with no uncertain candidate match
      cleanlyAbsent.push(baseFinding);
    }
  }

  // 4. Partition Cleanly Absent into Verified vs. Disappeared
  // Strict rule: Disappeared is NEVER verified unless authoritative Phase 6 evidence
  // exists confirming 'verified' status AND verifiedAtScanId matches the target rescan.
  const verifiedResolved: FindingRecord[] = [];
  const disappeared: FindingRecord[] = [];
  const remediationRecords = options?.remediationRecords;

  for (const finding of cleanlyAbsent) {
    const record = remediationRecords
      ? remediationRecords[finding.fingerprint]
      : undefined;

    const isValidTargetScanId = Boolean(
      rescan?.id && typeof rescan.id === 'string' && rescan.id.trim() !== ''
    );

    const isExactCertifyingScan = Boolean(
      isValidTargetScanId &&
      record?.verifiedAtScanId &&
      typeof record.verifiedAtScanId === 'string' &&
      record.verifiedAtScanId.trim() === rescan.id.trim()
    );

    const isAuthenticVerifiedRecord = Boolean(
      record &&
      record.status === 'verified' &&
      record.fingerprint === finding.fingerprint &&
      isExactCertifyingScan
    );

    if (isAuthenticVerifiedRecord) {
      verifiedResolved.push(finding);
    } else {
      disappeared.push(finding);
    }
  }

  // Backward-compatible alias combining all absent findings
  const resolved: FindingRecord[] = [...verifiedResolved, ...disappeared];

  // 5. New Findings (Regressions): remaining unmatched rescan findings
  const newFindings = rescanUnmatched;

  // Deterministic sorting of all output collections by canonical fingerprint
  const sortByFp = (a: FindingRecord, b: FindingRecord) =>
    a.fingerprint.localeCompare(b.fingerprint);

  unchanged.sort(sortByFp);
  newFindings.sort(sortByFp);
  verifiedResolved.sort(sortByFp);
  disappeared.sort(sortByFp);
  resolved.sort(sortByFp);
  uncertainMatches.sort((a, b) =>
    a.baselineFinding.fingerprint.localeCompare(b.baselineFinding.fingerprint)
  );

  // 6. Metrics Calculation
  const baselineTotal = baselineFindings.length;
  const rescanTotal = rescanFindings.length;
  const verifiedResolvedCount = verifiedResolved.length;
  const disappearedCount = disappeared.length;
  const resolvedCount = resolved.length;
  const unchangedCount = unchanged.length;
  const newCount = newFindings.length;
  const uncertainCount = uncertainMatches.length;

  const netProgress = resolvedCount - newCount;
  const verifiedNetProgress = verifiedResolvedCount - newCount;

  let improvementScore = 0;
  if (baselineTotal === 0 && rescanTotal === 0) {
    improvementScore = 100;
  } else if (baselineTotal > 0) {
    const rawRatio = (resolvedCount - newCount) / baselineTotal;
    improvementScore = Math.max(0, Math.min(100, Math.round(rawRatio * 100)));
  }

  let verifiedImprovementScore = 0;
  if (baselineTotal === 0 && rescanTotal === 0) {
    verifiedImprovementScore = 100;
  } else if (baselineTotal > 0) {
    const verifiedRatio = (verifiedResolvedCount - newCount) / baselineTotal;
    verifiedImprovementScore = Math.max(
      0,
      Math.min(100, Math.round(verifiedRatio * 100))
    );
  }

  const metrics: ScanComparisonMetrics = {
    baselineTotal,
    rescanTotal,
    resolvedCount,
    verifiedResolvedCount,
    disappearedCount,
    unchangedCount,
    newCount,
    uncertainCount,
    netProgress,
    verifiedNetProgress,
    improvementScore,
    verifiedImprovementScore,
  };

  return {
    fromScanId: baselineScan.id,
    toScanId: rescan.id,
    generatedAt: timestamp,
    isComparable: true,
    verifiedResolved,
    disappeared,
    resolved,
    unchanged,
    newFindings,
    uncertainMatches,
    metrics,
  };
}
