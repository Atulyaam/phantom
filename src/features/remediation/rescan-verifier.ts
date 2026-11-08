/**
 * Phantom Audit — Rescan Verification & Lifecycle Integration Engine
 *
 * Coordinates between consecutive accessibility scans, the Phase 5 comparison engine,
 * and the remediation tracker to certify resolved issues, detect regressions, and
 * prevent premature or false verification claims.
 *
 * STRICT INVARIANTS:
 * 1. Confirmed Resolved: Only complete, successful scans on the identical target URL
 *    where the comparator confirms the issue is gone (with NO uncertain match) can verify a finding.
 * 2. Uncertain Match Protection: Selector changes NEVER falsely certify a fix.
 * 3. Regression Revocation: Any previously verified finding that reappears is immediately revoked to 'unresolved'.
 * 4. Incomparable Scans: Scans on different pages or incomplete/failed scans NEVER alter remediation state.
 * 5. Deduplication: Duplicate findings do not produce duplicate verification transitions.
 */

import type { ScanRecord } from '@/domain/scan';
import type { ScanComparison } from '@/domain/report';
import type {
  ScanVerificationResult,
  VerificationTransitionResult,
  RescanVerificationSummary,
} from '@/domain/remediation';
import {
  compareScans,
  normalizeUrlForComparison,
  evaluateScanComparability,
  type ScanComparabilityResult,
  type CompareScansOptions,
} from '@/features/comparison/scan-comparator';
import {
  remediationTracker as defaultRemediationTracker,
  RemediationTracker,
} from './remediation-tracker';

export {
  normalizeUrlForComparison,
  evaluateScanComparability,
  type ScanComparabilityResult,
  type CompareScansOptions,
};

export interface RescanVerificationExecutionResult {
  diff: ScanComparison | null;
  summary: RescanVerificationSummary;
}

/**
 * Executes full cross-scan verification lifecycle between a baseline scan and a rescan.
 *
 * Invariants:
 * - Incomparable or incomplete scans never modify stored remediation status.
 * - Confirmed resolved issues transition to 'verified'.
 * - Uncertain matches transition to 'unresolved' (if attempted/verified) and never 'verified'.
 * - Persistent issues that were attempted transition to 'unresolved'.
 * - Regressions (reappearing verified findings) have their verified status revoked to 'unresolved'.
 */
export async function executeRescanVerification(
  baselineScan: ScanRecord | null | undefined,
  rescan: ScanRecord,
  tracker: RemediationTracker = defaultRemediationTracker
): Promise<RescanVerificationExecutionResult> {
  const timestamp = new Date().toISOString();
  const comparability = evaluateScanComparability(baselineScan, rescan);

  if (!comparability.isComparable || !baselineScan) {
    const baselineFindings = baselineScan?.findings || [];
    const outcomeType = comparability.skippedOutcome || 'incomparable-scan';

    // Prepare retained outcomes for baseline findings without modifying status
    const inconclusiveOutcomes: ScanVerificationResult[] = baselineFindings.map((f) => ({
      fingerprint: f.fingerprint,
      outcome: outcomeType,
      scanId: rescan?.id,
      reason: comparability.reason,
    }));

    const transitions = await tracker.applyBatchVerification(inconclusiveOutcomes);

    return {
      diff: null,
      summary: {
        comparable: false,
        incomparableReason: comparability.reason,
        scanId: rescan.id,
        baselineScanId: baselineScan?.id,
        totalEvaluated: baselineFindings.length,
        newlyVerified: [],
        stillPresent: [],
        regressions: [],
        uncertainMatches: [],
        retained: transitions,
        skippedVerification: {
          count: baselineFindings.length,
          reason:
            comparability.reason || 'Verification skipped: scans are not comparable.',
        },
        timestamp,
      },
    };
  }

  // Comparable scans: compute deterministic comparison
  const diff = compareScans(baselineScan, rescan);

  const rawOutcomes: ScanVerificationResult[] = [];

  // 1. Confirmed resolved: baseline findings absent in rescan with no uncertain match
  for (const finding of diff.resolved) {
    rawOutcomes.push({
      fingerprint: finding.fingerprint,
      outcome: 'confirmed-resolved',
      scanId: rescan.id,
      reason: `Rule '${finding.ruleId}' confirmed resolved on rescan ${rescan.id}.`,
    });
  }

  // 2. Still present: baseline findings identical on rescan
  for (const finding of diff.unchanged) {
    rawOutcomes.push({
      fingerprint: finding.fingerprint,
      outcome: 'still-present',
      scanId: rescan.id,
      reason: `Rule '${finding.ruleId}' persists on target element.`,
    });
  }

  // 3. Uncertain matches: selector shifted on same element type
  const uncertainMatchesList = diff.uncertainMatches || [];
  for (const match of uncertainMatchesList) {
    rawOutcomes.push({
      fingerprint: match.baselineFinding.fingerprint,
      outcome: 'uncertain-match',
      scanId: rescan.id,
      reason: match.reason,
    });
  }

  // 4. Newly introduced findings: check if any was previously verified (regression)
  for (const finding of diff.newFindings) {
    rawOutcomes.push({
      fingerprint: finding.fingerprint,
      outcome: 'newly-introduced',
      scanId: rescan.id,
      reason: `New rule violation '${finding.ruleId}' detected on rescan.`,
    });
  }

  // Safeguard: Deduplicate outcomes by fingerprint
  const outcomeMap = new Map<string, ScanVerificationResult>();
  for (const outcome of rawOutcomes) {
    if (!outcomeMap.has(outcome.fingerprint)) {
      outcomeMap.set(outcome.fingerprint, outcome);
    }
  }
  const deduplicatedOutcomes = Array.from(outcomeMap.values());

  // Apply batch state transitions through the verified remediation tracker
  const transitions = await tracker.applyBatchVerification(deduplicatedOutcomes);

  // Categorize transitions for structured reporting
  const newlyVerified: VerificationTransitionResult[] = [];
  const stillPresent: VerificationTransitionResult[] = [];
  const regressions: VerificationTransitionResult[] = [];
  const uncertainTransitions: VerificationTransitionResult[] = [];
  const retained: VerificationTransitionResult[] = [];

  const uncertainFpSet = new Set(
    uncertainMatchesList.map((m) => m.baselineFinding.fingerprint)
  );

  for (const t of transitions) {
    if (uncertainFpSet.has(t.fingerprint)) {
      uncertainTransitions.push(t);
    }

    if (t.previousStatus === 'verified' && t.newStatus === 'unresolved') {
      regressions.push(t);
    } else if (t.action === 'verified' && t.previousStatus !== 'verified') {
      newlyVerified.push(t);
    } else if (t.newStatus === 'unresolved' && t.previousStatus !== 'verified') {
      stillPresent.push(t);
    } else if (t.action === 'retained') {
      retained.push(t);
    }
  }

  const summary: RescanVerificationSummary = {
    comparable: true,
    scanId: rescan.id,
    baselineScanId: baselineScan.id,
    totalEvaluated: deduplicatedOutcomes.length,
    newlyVerified,
    stillPresent,
    regressions,
    uncertainMatches: uncertainTransitions,
    retained,
    timestamp,
  };

  // Re-compute comparison with authoritative updated remediation records to certify verified fixes
  const updatedRecords = await tracker.getAllRecords();
  const certifiedDiff = compareScans(baselineScan, rescan, {
    remediationRecords: updatedRecords,
  });

  return {
    diff: certifiedDiff,
    summary,
  };
}
