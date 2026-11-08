import { describe, it, expect, beforeEach } from 'vitest';
import {
  RemediationTracker,
  evaluateVerificationTransition,
  InvalidStateTransitionError,
  InvalidFingerprintError,
} from '@/features/remediation/remediation-tracker';
import { storageService } from '@/lib/storage';
import type { ScanVerificationResult } from '@/domain/remediation';

describe('Remediation Lifecycle Tracker & State Machine', () => {
  let tracker: RemediationTracker;

  beforeEach(async () => {
    await storageService.clearAllData();
    tracker = new RemediationTracker(storageService);
  });

  describe('Default Status & Initial State', () => {
    it('defaults to "suggested" for any untracked finding', async () => {
      const status = await tracker.getFindingStatus('fp-new-finding');
      expect(status).toBe('suggested');

      const record = await tracker.getFindingRecord('fp-new-finding');
      expect(record).toBeNull();
    });

    it('returns empty records payload initially', async () => {
      const all = await tracker.getAllRecords();
      expect(all).toEqual({});
    });
  });

  describe('User-Driven State Transitions', () => {
    it('transitions from "suggested" to "attempted" via markAttempted', async () => {
      const fp = 'fp-button-name-1';
      const record = await tracker.markAttempted(fp, 'Added aria-label in UI');

      expect(record.status).toBe('attempted');
      expect(record.fingerprint).toBe(fp);
      expect(record.notes).toBe('Added aria-label in UI');
      expect(record.attemptedAt).toBeDefined();

      const currentStatus = await tracker.getFindingStatus(fp);
      expect(currentStatus).toBe('attempted');
    });

    it('transitions back to "suggested" via resetToSuggested', async () => {
      const fp = 'fp-link-name-1';
      await tracker.markAttempted(fp);
      expect(await tracker.getFindingStatus(fp)).toBe('attempted');

      const resetRecord = await tracker.resetToSuggested(fp, 'Resetting attempt');
      expect(resetRecord.status).toBe('suggested');
      expect(await tracker.getFindingStatus(fp)).toBe('suggested');
    });

    it('updates notes without changing current remediation status', async () => {
      const fp = 'fp-color-contrast-1';
      await tracker.markAttempted(fp);

      const updated = await tracker.updateNotes(fp, 'Consulted design tokens');
      expect(updated.status).toBe('attempted');
      expect(updated.notes).toBe('Consulted design tokens');
    });

    it('prohibits users from manually forcing "verified" status', () => {
      expect(() => {
        tracker.manuallySetVerified('fp-bypass-attempt');
      }).toThrowError(InvalidStateTransitionError);
    });

    it('rejects empty or invalid fingerprints with InvalidFingerprintError', async () => {
      await expect(tracker.markAttempted('')).rejects.toThrowError(
        InvalidFingerprintError
      );
      await expect(tracker.markAttempted('   ')).rejects.toThrowError(
        InvalidFingerprintError
      );
      // @ts-expect-error runtime type safety
      await expect(tracker.markAttempted(null)).rejects.toThrowError(
        InvalidFingerprintError
      );
    });
  });

  describe('Pure Verification Transition Logic (evaluateVerificationTransition)', () => {
    const scanId = '550e8400-e29b-41d4-a716-446655440000';

    it('certifies "attempted" finding as "verified" on confirmed-resolved outcome', () => {
      const outcome: ScanVerificationResult = {
        fingerprint: 'fp-1',
        outcome: 'confirmed-resolved',
        scanId,
      };

      const result = evaluateVerificationTransition('attempted', outcome);
      expect(result.newStatus).toBe('verified');
      expect(result.action).toBe('verified');
    });

    it('certifies "suggested" finding as "verified" on confirmed-resolved outcome', () => {
      const outcome: ScanVerificationResult = {
        fingerprint: 'fp-2',
        outcome: 'confirmed-resolved',
        scanId,
      };

      const result = evaluateVerificationTransition('suggested', outcome);
      expect(result.newStatus).toBe('verified');
      expect(result.action).toBe('verified');
    });

    it('retains status when confirmed-resolved outcome lacks a scanId', () => {
      const outcome: ScanVerificationResult = {
        fingerprint: 'fp-3',
        outcome: 'confirmed-resolved',
        // scanId missing
      };

      const result = evaluateVerificationTransition('attempted', outcome);
      expect(result.newStatus).toBe('attempted');
      expect(result.action).toBe('retained');
    });

    it('transitions "attempted" finding to "unresolved" when still-present on rescan', () => {
      const outcome: ScanVerificationResult = {
        fingerprint: 'fp-4',
        outcome: 'still-present',
        scanId,
      };

      const result = evaluateVerificationTransition('attempted', outcome);
      expect(result.newStatus).toBe('unresolved');
      expect(result.action).toBe('unresolved');
    });

    it('revokes "verified" finding to "unresolved" when regression is detected (still-present)', () => {
      const outcome: ScanVerificationResult = {
        fingerprint: 'fp-5',
        outcome: 'still-present',
        scanId,
      };

      const result = evaluateVerificationTransition('verified', outcome);
      expect(result.newStatus).toBe('unresolved');
      expect(result.action).toBe('unresolved');
      expect(result.reason).toContain('Regression detected');
    });

    it('anti-fraud: uncertain match NEVER produces "verified"', () => {
      const outcome: ScanVerificationResult = {
        fingerprint: 'fp-6',
        outcome: 'uncertain-match',
        scanId,
        reason: 'Button selector changed from #btn1 to #btn2',
      };

      // When attempted -> becomes unresolved
      const resultAttempted = evaluateVerificationTransition('attempted', outcome);
      expect(resultAttempted.newStatus).toBe('unresolved');
      expect(resultAttempted.action).toBe('unresolved');

      // When already verified -> revoked to unresolved
      const resultVerified = evaluateVerificationTransition('verified', outcome);
      expect(resultVerified.newStatus).toBe('unresolved');
      expect(resultVerified.action).toBe('unresolved');

      // When suggested -> retained as suggested
      const resultSuggested = evaluateVerificationTransition('suggested', outcome);
      expect(resultSuggested.newStatus).toBe('suggested');
      expect(resultSuggested.action).toBe('retained');
    });

    it('preserves status unchanged on failed, cancelled, incomplete, or incomparable scans', () => {
      const failedOutcomes: ScanVerificationResult['outcome'][] = [
        'failed-scan',
        'cancelled-scan',
        'incomplete-scan',
        'incomparable-scan',
      ];

      for (const outcomeType of failedOutcomes) {
        for (const status of [
          'suggested',
          'attempted',
          'verified',
          'unresolved',
        ] as const) {
          const result = evaluateVerificationTransition(status, {
            fingerprint: 'fp-7',
            outcome: outcomeType,
          });
          expect(result.newStatus).toBe(status);
          expect(result.action).toBe('retained');
        }
      }
    });

    it('marks newly introduced findings as "suggested"', () => {
      const result = evaluateVerificationTransition('suggested', {
        fingerprint: 'fp-new',
        outcome: 'newly-introduced',
      });
      expect(result.newStatus).toBe('suggested');
      expect(result.action).toBe('suggested');
    });
  });

  describe('Controlled Verification Ingestion API', () => {
    const scanId = '550e8400-e29b-41d4-a716-446655440001';

    it('applies confirmed-resolved verification and persists certified record', async () => {
      const fp = 'fp-verify-target';
      await tracker.markAttempted(fp, 'Initial fix');

      const transition = await tracker.applyVerificationOutcome({
        fingerprint: fp,
        outcome: 'confirmed-resolved',
        scanId,
      });

      expect(transition.action).toBe('verified');
      expect(transition.previousStatus).toBe('attempted');
      expect(transition.newStatus).toBe('verified');
      expect(transition.updatedRecord?.verifiedAtScanId).toBe(scanId);

      const stored = await tracker.getFindingRecord(fp);
      expect(stored?.status).toBe('verified');
      expect(stored?.verifiedAtScanId).toBe(scanId);
    });

    it('applies regression revocation and persists unresolved status', async () => {
      const fp = 'fp-regress-target';
      // First verify it
      await tracker.applyVerificationOutcome({
        fingerprint: fp,
        outcome: 'confirmed-resolved',
        scanId,
      });
      expect(await tracker.getFindingStatus(fp)).toBe('verified');

      // Now report still-present on a subsequent scan
      const regression = await tracker.applyVerificationOutcome({
        fingerprint: fp,
        outcome: 'still-present',
        scanId: '550e8400-e29b-41d4-a716-446655440002',
      });

      expect(regression.action).toBe('unresolved');
      expect(regression.previousStatus).toBe('verified');
      expect(regression.newStatus).toBe('unresolved');

      const stored = await tracker.getFindingRecord(fp);
      expect(stored?.status).toBe('unresolved');
      expect(stored?.verifiedAtScanId).toBeUndefined();
    });

    it('applies batch verification results across multiple findings', async () => {
      const fp1 = 'fp-batch-1';
      const fp2 = 'fp-batch-2';
      const fp3 = 'fp-batch-3';

      await tracker.markAttempted(fp1);
      await tracker.markAttempted(fp2);

      const batchResults = await tracker.applyBatchVerification([
        {
          fingerprint: fp1,
          outcome: 'confirmed-resolved',
          scanId,
        },
        {
          fingerprint: fp2,
          outcome: 'still-present',
          scanId,
        },
        {
          fingerprint: fp3,
          outcome: 'failed-scan', // Scan failed for fp3
        },
      ]);

      expect(batchResults).toHaveLength(3);
      expect(batchResults[0]?.newStatus).toBe('verified');
      expect(batchResults[1]?.newStatus).toBe('unresolved');
      expect(batchResults[2]?.newStatus).toBe('suggested'); // Untracked fp3 remains suggested

      expect(await tracker.getFindingStatus(fp1)).toBe('verified');
      expect(await tracker.getFindingStatus(fp2)).toBe('unresolved');
      expect(await tracker.getFindingStatus(fp3)).toBe('suggested');
    });

    it('handles malformed entries in batch without crashing the pipeline', async () => {
      const batchResults = await tracker.applyBatchVerification([
        {
          fingerprint: 'fp-valid',
          outcome: 'confirmed-resolved',
          scanId,
        },
        // @ts-expect-error testing defensive recovery from malformed outcome
        {
          fingerprint: '',
          outcome: 'confirmed-resolved',
        },
      ]);

      expect(batchResults).toHaveLength(2);
      expect(batchResults[0]?.newStatus).toBe('verified');
      expect(batchResults[1]?.action).toBe('retained');
    });

    it('preserves historical verifiedAtScanId and sets isRegression on regression', async () => {
      const fp = 'fp-regression-test';
      // 1. Mark verified
      await tracker.applyVerificationOutcome({
        fingerprint: fp,
        outcome: 'confirmed-resolved',
        scanId,
      });
      const verifiedRecord = await tracker.getFindingRecord(fp);
      expect(verifiedRecord?.status).toBe('verified');
      expect(verifiedRecord?.verifiedAtScanId).toBe(scanId);

      // 2. Reappears on subsequent scan (regression)
      const rescanId = crypto.randomUUID();
      const transition = await tracker.applyVerificationOutcome({
        fingerprint: fp,
        outcome: 'still-present',
        scanId: rescanId,
      });

      expect(transition.previousStatus).toBe('verified');
      expect(transition.newStatus).toBe('unresolved');
      expect(transition.action).toBe('unresolved');

      const regressedRecord = await tracker.getFindingRecord(fp);
      expect(regressedRecord?.status).toBe('unresolved');
      expect(regressedRecord?.isRegression).toBe(true);
      expect(regressedRecord?.previouslyVerifiedAtScanId).toBe(scanId);
      expect(regressedRecord?.verifiedAtScanId).toBeUndefined();
      expect(regressedRecord?.regressionDetectedAt).toBeDefined();
    });

    it('revokes verified status when reappearing as newly-introduced defect', async () => {
      const fp = 'fp-newly-reintroduced';
      await tracker.applyVerificationOutcome({
        fingerprint: fp,
        outcome: 'confirmed-resolved',
        scanId,
      });

      const transition = await tracker.applyVerificationOutcome({
        fingerprint: fp,
        outcome: 'newly-introduced',
        scanId: crypto.randomUUID(),
      });

      expect(transition.previousStatus).toBe('verified');
      expect(transition.newStatus).toBe('unresolved');
      expect(transition.action).toBe('unresolved');
      expect(transition.reason).toContain('Regression detected');
    });
  });
});
