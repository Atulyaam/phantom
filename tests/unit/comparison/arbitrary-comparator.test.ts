/**
 * Phantom Audit — Arbitrary Scan Comparison & Disappeared vs. Verified Engine Tests
 *
 * Comprehensive tests for Phase 7 Workstream 2:
 * 1. Arbitrary scan pair comparison (baseline vs rescan, historical vs current, historical vs historical).
 * 2. Strict distinction between verified fixes (authoritative Phase 6 verification record)
 *    and disappeared findings (absence without verification evidence).
 * 3. Exact fingerprint matching (unchanged), new findings, and uncertain heuristic matches.
 * 4. Comparability validation: normalized URL parity, SPA route discrimination, scan status checks.
 * 5. Strictly read-only operation: zero side-effects on remediation records or scans.
 * 6. Property-based testing with fast-check for partition invariants and metric determinism.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  compareScans,
  evaluateScanComparability,
  normalizeUrlForComparison,
} from '@/features/comparison/scan-comparator';
import type { ScanRecord } from '@/domain/scan';
import type { FindingRecord } from '@/domain/finding';
import type {
  RemediationStoragePayload,
  StoredRemediationRecord,
} from '@/domain/remediation';

// Helper to construct mock findings
function createMockFinding(
  overrides: Partial<FindingRecord> & { ruleId: string; target: string }
): FindingRecord {
  const { ruleId, target, ...rest } = overrides;
  const tag = target.split(/[\s.#[]/)[0] || 'div';
  return {
    fingerprint: `v1:${ruleId}:${target}`,
    ruleId,
    impact: 'serious',
    description: `Description for ${ruleId}`,
    help: `Fix ${ruleId}`,
    wcagTags: ['wcag2a', 'wcag111'],
    roomId: 'name-chamber',
    affectedNodeCount: 1,
    nodes: [
      {
        target: [target],
        htmlExcerpt: `<${tag}>Test element</${tag}>`,
        failureSummary: `Fix problem on ${target}`,
      },
    ],
    firstSeenAt: new Date().toISOString(),
    reviewed: false,
    ...rest,
  };
}

// Helper to construct mock scans
function createMockScan(
  findings: FindingRecord[],
  id = 'scan-1',
  tabUrl = 'https://example.com/app',
  status: ScanRecord['status'] = 'completed'
): ScanRecord {
  return {
    id,
    schemaVersion: 1,
    tabUrl,
    pageTitle: 'Test Page',
    hostname: 'example.com',
    scannedAt: new Date().toISOString(),
    axeVersion: '4.14.0',
    extensionVersion: '0.1.0',
    browserName: 'chrome',
    status,
    findings,
    incompleteChecksCount: 0,
    passesCount: 10,
    inapplicableCount: 5,
  };
}

describe('Arbitrary Scan Comparison & Disappeared vs. Verified Engine', () => {
  describe('Arbitrary Scan Pair Comparisons', () => {
    it('compares two arbitrary historical snapshots', () => {
      const f1 = createMockFinding({ ruleId: 'color-contrast', target: '#header-title' });
      const f2 = createMockFinding({ ruleId: 'image-alt', target: 'img#avatar' });
      const f3 = createMockFinding({ ruleId: 'button-name', target: 'button#submit' });

      const historicalA = createMockScan([f1, f2], 'hist-snap-001');
      const historicalB = createMockScan([f2, f3], 'hist-snap-002');

      const result = compareScans(historicalA, historicalB);

      expect(result.fromScanId).toBe('hist-snap-001');
      expect(result.toScanId).toBe('hist-snap-002');
      expect(result.isComparable).toBe(true);
      expect(result.unchanged).toHaveLength(1);
      expect(result.unchanged[0].fingerprint).toBe(f2.fingerprint);
      expect(result.newFindings).toHaveLength(1);
      expect(result.newFindings[0].fingerprint).toBe(f3.fingerprint);
      expect(result.disappeared).toHaveLength(1);
      expect(result.disappeared[0].fingerprint).toBe(f1.fingerprint);
      expect(result.verifiedResolved).toHaveLength(0);
      expect(result.resolved).toHaveLength(1);
    });

    it('compares a historical snapshot against the current live scan', () => {
      const f1 = createMockFinding({ ruleId: 'color-contrast', target: '#header-title' });
      const historical = createMockScan([f1], 'hist-snap-001');
      const current = createMockScan([], 'live-scan-today');

      const result = compareScans(historical, current);

      expect(result.fromScanId).toBe('hist-snap-001');
      expect(result.toScanId).toBe('live-scan-today');
      expect(result.isComparable).toBe(true);
      expect(result.resolved).toHaveLength(1);
      expect(result.metrics?.netProgress).toBe(1);
      expect(result.metrics?.improvementScore).toBe(100);
    });

    it('returns 100% improvement score when both baseline and rescan have zero findings', () => {
      const scanA = createMockScan([], 'scan-empty-a');
      const scanB = createMockScan([], 'scan-empty-b');

      const result = compareScans(scanA, scanB);

      expect(result.isComparable).toBe(true);
      expect(result.metrics?.baselineTotal).toBe(0);
      expect(result.metrics?.rescanTotal).toBe(0);
      expect(result.metrics?.improvementScore).toBe(100);
      expect(result.metrics?.netProgress).toBe(0);
    });
  });

  describe('Disappeared vs. Verified Invariants', () => {
    it('classifies absent finding as verifiedResolved when authoritative verification matches rescan ID', () => {
      const finding = createMockFinding({ ruleId: 'image-alt', target: 'img#hero' });
      const baselineScan = createMockScan([finding], 'scan-baseline');
      const rescan = createMockScan([], 'scan-rescan-target');

      const remediationRecords: RemediationStoragePayload = {
        [finding.fingerprint]: {
          fingerprint: finding.fingerprint,
          status: 'verified',
          updatedAt: new Date().toISOString(),
          attemptedAt: new Date().toISOString(),
          verifiedAtScanId: 'scan-rescan-target',
        },
      };

      const result = compareScans(baselineScan, rescan, { remediationRecords });

      expect(result.verifiedResolved).toHaveLength(1);
      expect(result.verifiedResolved[0].fingerprint).toBe(finding.fingerprint);
      expect(result.disappeared).toHaveLength(0);
      expect(result.resolved).toHaveLength(1);
      expect(result.metrics?.verifiedResolvedCount).toBe(1);
      expect(result.metrics?.disappearedCount).toBe(0);
      expect(result.metrics?.resolvedCount).toBe(1);
    });

    it('INVARIANT: Absent finding without verification record is classified as disappeared, NEVER verifiedResolved', () => {
      const finding = createMockFinding({ ruleId: 'image-alt', target: 'img#hero' });
      const baselineScan = createMockScan([finding], 'scan-baseline');
      const rescan = createMockScan([], 'scan-rescan-target');

      // No remediation records provided
      const result = compareScans(baselineScan, rescan);

      expect(result.verifiedResolved).toHaveLength(0);
      expect(result.disappeared).toHaveLength(1);
      expect(result.disappeared[0].fingerprint).toBe(finding.fingerprint);
      expect(result.resolved).toHaveLength(1);
      expect(result.metrics?.verifiedResolvedCount).toBe(0);
      expect(result.metrics?.disappearedCount).toBe(1);
      expect(result.metrics?.resolvedCount).toBe(1);
    });

    it('INVARIANT: Absent finding with status "attempted" or "suggested" is disappeared, NEVER verifiedResolved', () => {
      const fSuggested = createMockFinding({ ruleId: 'image-alt', target: 'img#hero' });
      const fAttempted = createMockFinding({
        ruleId: 'button-name',
        target: 'button#cta',
      });
      const baselineScan = createMockScan([fSuggested, fAttempted], 'scan-baseline');
      const rescan = createMockScan([], 'scan-rescan');

      const remediationRecords: RemediationStoragePayload = {
        [fSuggested.fingerprint]: {
          fingerprint: fSuggested.fingerprint,
          status: 'suggested',
          updatedAt: new Date().toISOString(),
        },
        [fAttempted.fingerprint]: {
          fingerprint: fAttempted.fingerprint,
          status: 'attempted',
          updatedAt: new Date().toISOString(),
          attemptedAt: new Date().toISOString(),
        },
      };

      const result = compareScans(baselineScan, rescan, { remediationRecords });

      expect(result.verifiedResolved).toHaveLength(0);
      expect(result.disappeared).toHaveLength(2);
      expect(result.metrics?.verifiedResolvedCount).toBe(0);
      expect(result.metrics?.disappearedCount).toBe(2);
      expect(result.metrics?.resolvedCount).toBe(2);
    });

    it('INVARIANT: Absent finding with status "verified" but mismatched verifiedAtScanId is classified as disappeared', () => {
      const finding = createMockFinding({ ruleId: 'image-alt', target: 'img#hero' });
      const baselineScan = createMockScan([finding], 'scan-baseline');
      const rescan = createMockScan([], 'scan-target-999');

      // Verified at a completely different scan, not the target scan being compared against
      const remediationRecords: RemediationStoragePayload = {
        [finding.fingerprint]: {
          fingerprint: finding.fingerprint,
          status: 'verified',
          updatedAt: new Date().toISOString(),
          verifiedAtScanId: 'scan-certified-earlier-123',
        },
      };

      const result = compareScans(baselineScan, rescan, { remediationRecords });

      expect(result.verifiedResolved).toHaveLength(0);
      expect(result.disappeared).toHaveLength(1);
      expect(result.metrics?.verifiedResolvedCount).toBe(0);
      expect(result.metrics?.disappearedCount).toBe(1);
      expect(result.metrics?.resolvedCount).toBe(1);
    });

    it('partitions absent findings accurately into verifiedResolved and disappeared simultaneously', () => {
      const fVerified = createMockFinding({ ruleId: 'image-alt', target: 'img#hero' });
      const fDisappeared = createMockFinding({
        ruleId: 'color-contrast',
        target: 'p.caption',
      });
      const baselineScan = createMockScan([fVerified, fDisappeared], 'scan-base');
      const rescan = createMockScan([], 'scan-rescan');

      const remediationRecords: RemediationStoragePayload = {
        [fVerified.fingerprint]: {
          fingerprint: fVerified.fingerprint,
          status: 'verified',
          updatedAt: new Date().toISOString(),
          verifiedAtScanId: 'scan-rescan',
        },
      };

      const result = compareScans(baselineScan, rescan, { remediationRecords });

      expect(result.verifiedResolved).toHaveLength(1);
      expect(result.verifiedResolved[0].fingerprint).toBe(fVerified.fingerprint);
      expect(result.disappeared).toHaveLength(1);
      expect(result.disappeared[0].fingerprint).toBe(fDisappeared.fingerprint);
      expect(result.resolved).toHaveLength(2);
      expect(result.metrics?.verifiedResolvedCount).toBe(1);
      expect(result.metrics?.disappearedCount).toBe(1);
      expect(result.metrics?.resolvedCount).toBe(2);
    });
  });

  describe('Unchanged, New Findings and Uncertain Matches', () => {
    it('accurately identifies unchanged findings by exact canonical fingerprint', () => {
      const f1 = createMockFinding({ ruleId: 'button-name', target: 'button#btn1' });
      const f2 = createMockFinding({ ruleId: 'image-alt', target: 'img#logo' });

      const baseline = createMockScan([f1, f2], 'scan-1');
      const rescan = createMockScan([f1, f2], 'scan-2');

      const result = compareScans(baseline, rescan);

      expect(result.unchanged).toHaveLength(2);
      expect(result.resolved).toHaveLength(0);
      expect(result.newFindings).toHaveLength(0);
      expect(result.uncertainMatches).toHaveLength(0);
      expect(result.metrics?.unchangedCount).toBe(2);
      expect(result.metrics?.netProgress).toBe(0);
      expect(result.metrics?.improvementScore).toBe(0);
    });

    it('accurately identifies new regression findings present only in rescan', () => {
      const fOld = createMockFinding({ ruleId: 'button-name', target: 'button#btn1' });
      const fNew = createMockFinding({ ruleId: 'link-name', target: 'a.read-more' });

      const baseline = createMockScan([fOld], 'scan-1');
      const rescan = createMockScan([fOld, fNew], 'scan-2');

      const result = compareScans(baseline, rescan);

      expect(result.unchanged).toHaveLength(1);
      expect(result.newFindings).toHaveLength(1);
      expect(result.newFindings[0].fingerprint).toBe(fNew.fingerprint);
      expect(result.metrics?.newCount).toBe(1);
      expect(result.metrics?.netProgress).toBe(-1);
    });

    it('identifies uncertain matches when selector shifts on same element tag and failure summary', () => {
      const fBase = createMockFinding({
        ruleId: 'button-name',
        target: 'button.old-class',
        roomId: 'name-chamber',
      });
      const fRescan = createMockFinding({
        ruleId: 'button-name',
        target: 'div.container > button.new-class',
        roomId: 'name-chamber',
      });

      const baseline = createMockScan([fBase], 'scan-1');
      const rescan = createMockScan([fRescan], 'scan-2');

      const result = compareScans(baseline, rescan);

      expect(result.uncertainMatches).toHaveLength(1);
      expect(result.uncertainMatches?.[0].baselineFinding.fingerprint).toBe(
        fBase.fingerprint
      );
      expect(result.uncertainMatches?.[0].candidateRescanFinding.fingerprint).toBe(
        fRescan.fingerprint
      );
      expect(result.resolved).toHaveLength(0);
      expect(result.verifiedResolved).toHaveLength(0);
      expect(result.disappeared).toHaveLength(0);
      expect(result.newFindings).toHaveLength(0);
      expect(result.metrics?.uncertainCount).toBe(1);
    });
  });

  describe('Comparability Gate Enforcement', () => {
    it('directly verifies normalizeUrlForComparison normalization rules', () => {
      expect(
        normalizeUrlForComparison('HTTPS://Example.COM:443/Path/?b=2&a=1#section')
      ).toBe('https://example.com/Path?a=1&b=2');
      expect(normalizeUrlForComparison('https://app.com/#/settings/')).toBe(
        'https://app.com/#/settings'
      );
    });

    it('directly verifies evaluateScanComparability behavior', () => {
      const scanA = createMockScan([], 'scan-a', 'https://example.com/page');
      const scanB = createMockScan([], 'scan-b', 'https://example.com/other');
      const comp = evaluateScanComparability(scanA, scanB);
      expect(comp.isComparable).toBe(false);
      expect(comp.skippedOutcome).toBe('incomparable-scan');
    });

    it('rejects cross-domain scan comparisons with structured isComparable: false', () => {
      const scanA = createMockScan([], 'scan-a', 'https://domain-one.com/dashboard');
      const scanB = createMockScan([], 'scan-b', 'https://domain-two.com/dashboard');

      const result = compareScans(scanA, scanB);

      expect(result.isComparable).toBe(false);
      expect(result.incomparableReason).toContain('Scan targets differ');
      expect(result.resolved).toHaveLength(0);
      expect(result.unchanged).toHaveLength(0);
      expect(result.newFindings).toHaveLength(0);
      expect(result.metrics?.resolvedCount).toBe(0);
    });

    it('rejects comparisons between different SPA routes', () => {
      const scanA = createMockScan([], 'scan-a', 'https://app.com/#/settings');
      const scanB = createMockScan([], 'scan-b', 'https://app.com/#/profile');

      const result = compareScans(scanA, scanB);

      expect(result.isComparable).toBe(false);
      expect(result.incomparableReason).toContain('Scan targets differ');
    });

    it('permits comparisons when URLs differ only by in-page scroll anchors (#top vs #footer)', () => {
      const scanA = createMockScan([], 'scan-a', 'https://app.com/about#top');
      const scanB = createMockScan([], 'scan-b', 'https://app.com/about#footer');

      const result = compareScans(scanA, scanB);

      expect(result.isComparable).toBe(true);
    });

    it('permits comparisons when query parameters are in different order', () => {
      const scanA = createMockScan(
        [],
        'scan-a',
        'https://app.com/search?order=desc&query=test'
      );
      const scanB = createMockScan(
        [],
        'scan-b',
        'https://app.com/search?query=test&order=desc'
      );

      const result = compareScans(scanA, scanB);

      expect(result.isComparable).toBe(true);
    });

    it('rejects comparisons when baseline scan status is incomplete, failed, or cancelled', () => {
      const scanA = createMockScan([], 'scan-a', 'https://app.com/test', 'failed');
      const scanB = createMockScan([], 'scan-b', 'https://app.com/test', 'completed');

      const result = compareScans(scanA, scanB);

      expect(result.isComparable).toBe(false);
      expect(result.incomparableReason).toContain("Baseline scan status is 'failed'");
    });

    it('rejects comparisons when rescan status is failed or cancelled', () => {
      const scanA = createMockScan([], 'scan-a', 'https://app.com/test', 'completed');
      const scanFailed = createMockScan([], 'scan-b', 'https://app.com/test', 'failed');
      const scanCancelled = createMockScan(
        [],
        'scan-c',
        'https://app.com/test',
        'cancelled'
      );

      const resFailed = compareScans(scanA, scanFailed);
      expect(resFailed.isComparable).toBe(false);
      expect(resFailed.incomparableReason).toContain('Rescan failed with an error');

      const resCancelled = compareScans(scanA, scanCancelled);
      expect(resCancelled.isComparable).toBe(false);
      expect(resCancelled.incomparableReason).toContain('Rescan was cancelled');
    });

    it('CRITICAL: Comparability cannot be bypassed; cross-domain scans always return isComparable: false and 0 verified', () => {
      const f1 = createMockFinding({ ruleId: 'button-name', target: 'button#btn' });
      const scanA = createMockScan([f1], 'scan-a', 'https://domain-one.com/test');
      const scanB = createMockScan([], 'scan-b', 'https://domain-two.com/other');

      const remediationRecords: RemediationStoragePayload = {
        [f1.fingerprint]: {
          fingerprint: f1.fingerprint,
          status: 'verified',
          updatedAt: new Date().toISOString(),
          verifiedAtScanId: 'scan-b',
        },
      };

      const result = compareScans(scanA, scanB, { remediationRecords });

      expect(result.isComparable).toBe(false);
      expect(result.verifiedResolved).toHaveLength(0);
      expect(result.disappeared).toHaveLength(0);
      expect(result.resolved).toHaveLength(0);
      expect(result.metrics?.verifiedResolvedCount).toBe(0);
    });

    it('enforces pathname case sensitivity per RFC 3986 (rejects /Dashboard vs /dashboard)', () => {
      const scanA = createMockScan([], 'scan-a', 'https://app.com/Dashboard');
      const scanB = createMockScan([], 'scan-b', 'https://app.com/dashboard');

      const result = compareScans(scanA, scanB);
      expect(result.isComparable).toBe(false);
      expect(result.incomparableReason).toContain('Scan targets differ');
    });
  });

  describe('Read-Only Purity & Side-Effect Free Invariant', () => {
    it('never mutates input remediation records or scan objects', () => {
      const f1 = createMockFinding({ ruleId: 'color-contrast', target: '#txt' });
      const baseScan = createMockScan([f1], 'scan-1');
      const rescan = createMockScan([], 'scan-2');

      const record: StoredRemediationRecord = {
        fingerprint: f1.fingerprint,
        status: 'verified',
        updatedAt: '2026-11-06T12:00:00.000Z',
        verifiedAtScanId: 'scan-2',
      };
      const remediationRecords: RemediationStoragePayload = {
        [f1.fingerprint]: { ...record },
      };

      const originalSnapshot = JSON.stringify(remediationRecords);
      const originalBase = JSON.stringify(baseScan);
      const originalRescan = JSON.stringify(rescan);

      compareScans(baseScan, rescan, { remediationRecords });

      expect(JSON.stringify(remediationRecords)).toBe(originalSnapshot);
      expect(JSON.stringify(baseScan)).toBe(originalBase);
      expect(JSON.stringify(rescan)).toBe(originalRescan);
    });

    it('is strictly deterministic: repeating compareScans yields identical results', () => {
      const f1 = createMockFinding({ ruleId: 'color-contrast', target: '#txt' });
      const f2 = createMockFinding({ ruleId: 'image-alt', target: 'img#icon' });
      const baseScan = createMockScan([f1, f2], 'scan-1');
      const rescan = createMockScan([f2], 'scan-2');

      const r1 = compareScans(baseScan, rescan);
      const r2 = compareScans(baseScan, rescan);

      expect(r1.metrics).toEqual(r2.metrics);
      expect(r1.unchanged.map((f) => f.fingerprint)).toEqual(
        r2.unchanged.map((f) => f.fingerprint)
      );
      expect(r1.resolved.map((f) => f.fingerprint)).toEqual(
        r2.resolved.map((f) => f.fingerprint)
      );
      expect(r1.disappeared.map((f) => f.fingerprint)).toEqual(
        r2.disappeared.map((f) => f.fingerprint)
      );
      expect(r1.verifiedResolved.map((f) => f.fingerprint)).toEqual(
        r2.verifiedResolved.map((f) => f.fingerprint)
      );
    });
  });

  describe('Defensive Verification Evidence & Edge Case Hardening', () => {
    it('rejects verified claim if record fingerprint does not match finding fingerprint', () => {
      const finding = createMockFinding({ ruleId: 'button-name', target: 'button#btn' });
      const baseScan = createMockScan([finding], 'scan-1');
      const rescan = createMockScan([], 'scan-2');

      // Key in dictionary matches finding.fingerprint, but internal fingerprint is corrupted/tampered
      const remediationRecords: RemediationStoragePayload = {
        [finding.fingerprint]: {
          fingerprint: 'completely-different-fp',
          status: 'verified',
          updatedAt: new Date().toISOString(),
          verifiedAtScanId: 'scan-2',
        },
      };

      const result = compareScans(baseScan, rescan, { remediationRecords });
      expect(result.verifiedResolved).toHaveLength(0);
      expect(result.disappeared).toHaveLength(1);
      expect(result.metrics?.verifiedResolvedCount).toBe(0);
    });

    it('rejects verified claim if rescan ID or verifiedAtScanId is empty or whitespace', () => {
      const finding = createMockFinding({ ruleId: 'button-name', target: 'button#btn' });
      const baseScan = createMockScan([finding], 'scan-1');
      const rescanEmptyId = createMockScan([], '   ');

      const remediationRecords: RemediationStoragePayload = {
        [finding.fingerprint]: {
          fingerprint: finding.fingerprint,
          status: 'verified',
          updatedAt: new Date().toISOString(),
          verifiedAtScanId: '   ',
        },
      };

      const result = compareScans(baseScan, rescanEmptyId, { remediationRecords });
      expect(result.verifiedResolved).toHaveLength(0);
      expect(result.disappeared).toHaveLength(1);
    });

    it('defensively deduplicates duplicate findings in baseline or rescan to maintain strict one-to-one matching', () => {
      const f1 = createMockFinding({ ruleId: 'button-name', target: 'button#btn1' });
      const f1Duplicate = { ...f1 };

      // Base scan has duplicated finding
      const baseScan = createMockScan([f1, f1Duplicate], 'scan-1');
      const rescan = createMockScan([f1], 'scan-2');

      const result = compareScans(baseScan, rescan);

      expect(result.unchanged).toHaveLength(1);
      expect(result.metrics?.unchangedCount).toBe(1);
      expect(result.metrics?.baselineTotal).toBe(1);
      expect(result.metrics?.rescanTotal).toBe(1);
    });

    it('handles multiple findings with same rule ID independently without cross-talk', () => {
      const fBtn1 = createMockFinding({ ruleId: 'button-name', target: 'button#btn1' });
      const fBtn2 = createMockFinding({ ruleId: 'button-name', target: 'button#btn2' });
      const fBtn3 = createMockFinding({ ruleId: 'button-name', target: 'button#btn3' });

      // fBtn1 is unchanged, fBtn2 is verified, fBtn3 disappeared without verification
      const baseScan = createMockScan([fBtn1, fBtn2, fBtn3], 'scan-1');
      const rescan = createMockScan([fBtn1], 'scan-2');

      const remediationRecords: RemediationStoragePayload = {
        [fBtn2.fingerprint]: {
          fingerprint: fBtn2.fingerprint,
          status: 'verified',
          updatedAt: new Date().toISOString(),
          verifiedAtScanId: 'scan-2',
        },
      };

      const result = compareScans(baseScan, rescan, { remediationRecords });

      expect(result.unchanged).toHaveLength(1);
      expect(result.unchanged[0].fingerprint).toBe(fBtn1.fingerprint);
      expect(result.verifiedResolved).toHaveLength(1);
      expect(result.verifiedResolved[0].fingerprint).toBe(fBtn2.fingerprint);
      expect(result.disappeared).toHaveLength(1);
      expect(result.disappeared[0].fingerprint).toBe(fBtn3.fingerprint);
      expect(result.metrics?.verifiedResolvedCount).toBe(1);
      expect(result.metrics?.disappearedCount).toBe(1);
      expect(result.metrics?.resolvedCount).toBe(2);
    });

    it('proves that reappearance of a previously verified finding is classified as unchanged or new, never resolved', () => {
      const finding = createMockFinding({ ruleId: 'link-name', target: 'a.nav-link' });

      // Finding is present in baseline and present in rescan
      const baseScan = createMockScan([finding], 'scan-1');
      const rescan = createMockScan([finding], 'scan-2');

      const remediationRecords: RemediationStoragePayload = {
        [finding.fingerprint]: {
          fingerprint: finding.fingerprint,
          status: 'verified',
          updatedAt: new Date().toISOString(),
          verifiedAtScanId: 'scan-ancient',
        },
      };

      const result = compareScans(baseScan, rescan, { remediationRecords });

      expect(result.unchanged).toHaveLength(1);
      expect(result.verifiedResolved).toHaveLength(0);
      expect(result.disappeared).toHaveLength(0);
      expect(result.resolved).toHaveLength(0);
    });

    it('ensures unverified disappeared findings yield 0% verified improvement score', () => {
      const f1 = createMockFinding({ ruleId: 'image-alt', target: 'img#banner' });
      const f2 = createMockFinding({ ruleId: 'color-contrast', target: 'p.sub' });

      // Both findings disappeared without verification
      const baseScan = createMockScan([f1, f2], 'scan-1');
      const rescan = createMockScan([], 'scan-2');

      const result = compareScans(baseScan, rescan);

      expect(result.verifiedResolved).toHaveLength(0);
      expect(result.disappeared).toHaveLength(2);
      expect(result.metrics?.verifiedResolvedCount).toBe(0);
      expect(result.metrics?.disappearedCount).toBe(2);
      expect(result.metrics?.verifiedNetProgress).toBe(0);
      expect(result.metrics?.verifiedImprovementScore).toBe(0);
      // Backward compatible metrics still report raw absent count
      expect(result.metrics?.resolvedCount).toBe(2);
      expect(result.metrics?.improvementScore).toBe(100);
    });

    it('sorts all output collections deterministically by canonical fingerprint', () => {
      const fZ = createMockFinding({ ruleId: 'color-contrast', target: 'z#item' });
      const fA = createMockFinding({ ruleId: 'button-name', target: 'a#item' });
      const fM = createMockFinding({ ruleId: 'image-alt', target: 'm#item' });

      const baseScan = createMockScan([fZ, fA, fM], 'scan-1');
      const rescan = createMockScan([fM, fZ, fA], 'scan-2');

      const result = compareScans(baseScan, rescan);

      const fingerprints = result.unchanged.map((f) => f.fingerprint);
      const sortedFingerprints = [...fingerprints].sort((a, b) => a.localeCompare(b));
      expect(fingerprints).toEqual(sortedFingerprints);
    });
  });

  describe('Property-Based Invariants (fast-check)', () => {
    // Generate valid distinct target selectors
    const arbSelector = fc.stringMatching(/^[a-z]{3,8}#[a-z0-9-]{3,10}$/);
    const arbRuleId = fc.constantFrom(
      'color-contrast',
      'image-alt',
      'button-name',
      'link-name'
    );

    it('property test: maintains strict disjoint partition across baseline and rescan findings', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(arbSelector, { minLength: 0, maxLength: 8 }),
          fc.uniqueArray(arbSelector, { minLength: 0, maxLength: 8 }),
          arbRuleId,
          (baselineTargets, rescanTargets, ruleId) => {
            const baselineFindings = baselineTargets.map((target) =>
              createMockFinding({ ruleId, target })
            );
            const rescanFindings = rescanTargets.map((target) =>
              createMockFinding({ ruleId, target })
            );

            const baseScan = createMockScan(baselineFindings, 'scan-base');
            const rescan = createMockScan(rescanFindings, 'scan-rescan');

            // Randomly create verification records for some baseline findings
            const remediationRecords: RemediationStoragePayload = {};
            baselineFindings.forEach((f, idx) => {
              if (idx % 2 === 0) {
                remediationRecords[f.fingerprint] = {
                  fingerprint: f.fingerprint,
                  status: 'verified',
                  updatedAt: new Date().toISOString(),
                  verifiedAtScanId: 'scan-rescan',
                };
              }
            });

            const result = compareScans(baseScan, rescan, { remediationRecords });
            const metrics = result.metrics!;

            // Invariant 1: Disjoint partition of baseline findings
            // baselineTotal === unchangedCount + uncertainCount + verifiedResolvedCount + disappearedCount
            const baselinePartitionSum =
              metrics.unchangedCount +
              metrics.uncertainCount +
              metrics.verifiedResolvedCount! +
              metrics.disappearedCount!;
            expect(baselinePartitionSum).toBe(metrics.baselineTotal);

            // Invariant 2: Disjoint partition of rescan findings
            // rescanTotal === unchangedCount + uncertainCount + newCount
            const rescanPartitionSum =
              metrics.unchangedCount + metrics.uncertainCount + metrics.newCount;
            expect(rescanPartitionSum).toBe(metrics.rescanTotal);

            // Invariant 3: resolvedCount === verifiedResolvedCount + disappearedCount
            expect(metrics.resolvedCount).toBe(
              metrics.verifiedResolvedCount! + metrics.disappearedCount!
            );

            // Invariant 4: resolved array contains exactly verifiedResolved + disappeared
            expect(result.resolved.length).toBe(
              result.verifiedResolved.length + result.disappeared.length
            );

            // Invariant 5: Net progress formula
            expect(metrics.netProgress).toBe(metrics.resolvedCount - metrics.newCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
