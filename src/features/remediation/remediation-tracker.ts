/**
 * Phantom Audit — Remediation Lifecycle Tracker & State Machine
 *
 * Deterministically tracks finding remediation progress through a verified finite state machine:
 *
 *   [suggested] <--> [attempted]
 *        |                |
 *        |           (Rescan confirms fix)
 *        |                v
 *   (Unaddressed)    [verified]
 *        |                |
 *        |         (Rescan detects regression)
 *        |                v
 *        +---------> [unresolved] <--> [attempted]
 *
 * STRICT INVARIANTS:
 * 1. Default status for any untracked finding is 'suggested'.
 * 2. Users may freely transition between 'suggested' and 'attempted'.
 * 3. Users CANNOT manually set 'verified'. Verification requires explicit scan confirmation.
 * 4. Uncertain comparisons (shifted selectors on identical elements) NEVER produce 'verified'.
 * 5. Failed, cancelled, or incomplete scans NEVER modify remediation status.
 * 6. A verified finding that reappears on a subsequent scan is automatically revoked to 'unresolved'.
 * 7. Malformed records or unknown fingerprints NEVER crash the tracker.
 */

import type {
  RemediationStatus,
  StoredRemediationRecord,
  RemediationStoragePayload,
  ScanVerificationResult,
  VerificationTransitionResult,
} from '@/domain/remediation';
import { storageService as defaultStorageService, StorageService } from '@/lib/storage';

export class InvalidStateTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStateTransitionError';
  }
}

export class InvalidFingerprintError extends Error {
  constructor(message = 'A valid non-empty string fingerprint is required.') {
    super(message);
    this.name = 'InvalidFingerprintError';
  }
}

/**
 * Validates fingerprint format defensively.
 */
function assertValidFingerprint(fingerprint: string): void {
  if (!fingerprint || typeof fingerprint !== 'string' || fingerprint.trim() === '') {
    throw new InvalidFingerprintError();
  }
}

/**
 * Pure transition evaluation function for scan verification outcomes.
 * Decides next status and transition action without side effects.
 */
export function evaluateVerificationTransition(
  currentStatus: RemediationStatus,
  outcome: ScanVerificationResult
): {
  newStatus: RemediationStatus;
  action: 'verified' | 'unresolved' | 'retained' | 'suggested';
  reason: string;
} {
  // Invariant 5: Failed, cancelled, incomplete, or incomparable scans NEVER modify status
  if (
    outcome.outcome === 'failed-scan' ||
    outcome.outcome === 'cancelled-scan' ||
    outcome.outcome === 'incomplete-scan' ||
    outcome.outcome === 'incomparable-scan'
  ) {
    return {
      newStatus: currentStatus,
      action: 'retained',
      reason: `Scan outcome '${outcome.outcome}' is inconclusive; existing status retained.`,
    };
  }

  switch (outcome.outcome) {
    case 'confirmed-resolved': {
      // Invariant 3 & Requirement 5: Only successful scan with scanId can verify
      if (!outcome.scanId) {
        return {
          newStatus: currentStatus,
          action: 'retained',
          reason: 'Cannot verify resolution without a valid certifying scan ID.',
        };
      }

      if (currentStatus === 'verified') {
        return {
          newStatus: 'verified',
          action: 'retained',
          reason: 'Finding remains certified verified.',
        };
      }

      return {
        newStatus: 'verified',
        action: 'verified',
        reason: 'Finding certified resolved by rescan comparison.',
      };
    }

    case 'still-present': {
      // If user attempted a fix but it still fails, move to unresolved
      if (currentStatus === 'attempted') {
        return {
          newStatus: 'unresolved',
          action: 'unresolved',
          reason: 'Attempted remediation did not resolve the defect on rescan.',
        };
      }

      // Invariant 6: Regression detection - if previously verified, revoke to unresolved
      if (currentStatus === 'verified') {
        return {
          newStatus: 'unresolved',
          action: 'unresolved',
          reason:
            'Regression detected: previously verified finding has reappeared on the target page.',
        };
      }

      // suggested remains suggested, unresolved remains unresolved
      return {
        newStatus: currentStatus,
        action: 'retained',
        reason: `Defect persists on target page (status: ${currentStatus}).`,
      };
    }

    case 'uncertain-match': {
      // Invariant 4: Anti-fraud - Uncertain match NEVER produces verified
      if (currentStatus === 'attempted' || currentStatus === 'verified') {
        return {
          newStatus: 'unresolved',
          action: 'unresolved',
          reason:
            outcome.reason ||
            'Uncertain match: element selector shifted but defect likely persists.',
        };
      }

      return {
        newStatus: currentStatus,
        action: 'retained',
        reason: outcome.reason || 'Uncertain match detected; existing status preserved.',
      };
    }

    case 'newly-introduced': {
      if (currentStatus === 'verified') {
        return {
          newStatus: 'unresolved',
          action: 'unresolved',
          reason:
            'Regression detected: previously verified finding has reappeared on the target page.',
        };
      }
      return {
        newStatus: 'suggested',
        action: 'suggested',
        reason: 'New finding introduced on rescan.',
      };
    }

    default:
      return {
        newStatus: currentStatus,
        action: 'retained',
        reason: 'Unrecognized verification outcome; existing status retained.',
      };
  }
}

/**
 * Deterministic Remediation Tracker service.
 */
export class RemediationTracker {
  constructor(private storage: StorageService = defaultStorageService) {}

  /**
   * Retrieves the current remediation status for a finding fingerprint.
   * Defaults to 'suggested' for any unrecorded or newly detected finding.
   */
  async getFindingStatus(fingerprint: string): Promise<RemediationStatus> {
    if (!fingerprint || typeof fingerprint !== 'string') return 'suggested';
    try {
      const record = await this.storage.getRemediationRecord(fingerprint.trim());
      return record?.status || 'suggested';
    } catch {
      return 'suggested';
    }
  }

  /**
   * Retrieves the stored record for a finding fingerprint.
   */
  async getFindingRecord(fingerprint: string): Promise<StoredRemediationRecord | null> {
    if (!fingerprint || typeof fingerprint !== 'string') return null;
    try {
      return await this.storage.getRemediationRecord(fingerprint.trim());
    } catch {
      return null;
    }
  }

  /**
   * Retrieves all stored remediation records.
   */
  async getAllRecords(): Promise<RemediationStoragePayload> {
    try {
      return await this.storage.getRemediationRecords();
    } catch {
      return {};
    }
  }

  /**
   * User action: Marks a finding as 'attempted'.
   * Permitted from 'suggested', 'unresolved', or updating an existing 'attempted'.
   */
  async markAttempted(
    fingerprint: string,
    notes?: string
  ): Promise<StoredRemediationRecord> {
    assertValidFingerprint(fingerprint);
    const cleanFp = fingerprint.trim();

    return await this.storage.updateRemediationStatus(cleanFp, 'attempted', {
      notes,
    });
  }

  /**
   * User action: Resets an attempted or unresolved finding back to 'suggested'.
   */
  async resetToSuggested(
    fingerprint: string,
    notes?: string
  ): Promise<StoredRemediationRecord> {
    assertValidFingerprint(fingerprint);
    const cleanFp = fingerprint.trim();

    return await this.storage.updateRemediationStatus(cleanFp, 'suggested', {
      notes,
    });
  }

  /**
   * User action: Updates user notes on a finding without altering its status.
   */
  async updateNotes(
    fingerprint: string,
    notes: string
  ): Promise<StoredRemediationRecord> {
    assertValidFingerprint(fingerprint);
    const cleanFp = fingerprint.trim();

    const currentStatus = await this.getFindingStatus(cleanFp);
    return await this.storage.updateRemediationStatus(cleanFp, currentStatus, {
      notes,
    });
  }

  /**
   * Prohibited User Action Guard:
   * Throws InvalidStateTransitionError if user tries to manually force 'verified'.
   */
  manuallySetVerified(_fingerprint: string): never {
    throw new InvalidStateTransitionError(
      "Manual transition to 'verified' is prohibited. Verification requires rescan certification."
    );
  }

  /**
   * Controlled Verification API Boundary (used by Workstream 4 rescan diffing).
   * Ingests a single verification outcome and applies the state transition.
   */
  async applyVerificationOutcome(
    outcome: ScanVerificationResult
  ): Promise<VerificationTransitionResult> {
    assertValidFingerprint(outcome.fingerprint);
    const cleanFp = outcome.fingerprint.trim();

    const currentRecord = await this.getFindingRecord(cleanFp);
    const currentStatus: RemediationStatus = currentRecord?.status || 'suggested';

    const evaluation = evaluateVerificationTransition(currentStatus, outcome);

    let updatedRecord: StoredRemediationRecord | undefined;

    const isRegression =
      currentStatus === 'verified' && evaluation.newStatus === 'unresolved';

    // Only update storage if status actually changed or scanId certification is attached
    if (
      evaluation.newStatus !== currentStatus ||
      (evaluation.newStatus === 'verified' &&
        outcome.scanId !== currentRecord?.verifiedAtScanId)
    ) {
      updatedRecord = await this.storage.updateRemediationStatus(
        cleanFp,
        evaluation.newStatus,
        {
          verifiedAtScanId:
            evaluation.newStatus === 'verified' ? outcome.scanId : undefined,
          previouslyVerifiedAtScanId: isRegression
            ? currentRecord?.verifiedAtScanId
            : currentRecord?.previouslyVerifiedAtScanId,
          regressionDetectedAt: isRegression
            ? new Date().toISOString()
            : evaluation.newStatus === 'verified'
              ? undefined
              : currentRecord?.regressionDetectedAt,
          isRegression: isRegression
            ? true
            : evaluation.newStatus === 'verified'
              ? false
              : currentRecord?.isRegression,
          notes: currentRecord?.notes,
        }
      );
    } else {
      updatedRecord = currentRecord || undefined;
    }

    return {
      fingerprint: cleanFp,
      previousStatus: currentStatus,
      newStatus: evaluation.newStatus,
      action: evaluation.action,
      reason: evaluation.reason,
      updatedRecord,
    };
  }

  /**
   * Controlled Verification API Boundary (Batch):
   * Ingests an array of scan verification outcomes and updates all matching records.
   */
  async applyBatchVerification(
    outcomes: ScanVerificationResult[]
  ): Promise<VerificationTransitionResult[]> {
    if (!Array.isArray(outcomes)) return [];

    const results: VerificationTransitionResult[] = [];
    for (const outcome of outcomes) {
      try {
        const transition = await this.applyVerificationOutcome(outcome);
        results.push(transition);
      } catch (err) {
        // Defensive: a single malformed outcome must not abort batch processing
        results.push({
          fingerprint: outcome.fingerprint || 'unknown',
          previousStatus: 'suggested',
          newStatus: 'suggested',
          action: 'retained',
          reason: `Error applying verification outcome: ${(err as Error).message}`,
        });
      }
    }

    return results;
  }

  /**
   * Clears all remediation tracking records.
   */
  async clearTrackerData(): Promise<void> {
    await this.storage.clearRemediationData();
  }
}

export const remediationTracker = new RemediationTracker();
