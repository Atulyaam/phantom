import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
  normalizeUrlForComparison,
  evaluateScanComparability,
  executeRescanVerification,
} from '@/features/remediation/rescan-verifier';
import { RemediationTracker } from '@/features/remediation/remediation-tracker';
import { storageService } from '@/lib/storage';
import type { ScanRecord } from '@/domain/scan';
import type { FindingRecord } from '@/domain/finding';

function createMockFinding(
  overrides: Partial<FindingRecord> & { ruleId: string; target: string }
): FindingRecord {
  const { ruleId, target, ...rest } = overrides;
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
        htmlExcerpt: `<${target.split(/[\s.#[]/)[0]}>Test</>`,
        failureSummary: `Fix problem on ${target}`,
      },
    ],
    firstSeenAt: new Date().toISOString(),
    reviewed: false,
    ...rest,
  };
}

function createMockScan(
  findings: FindingRecord[],
  overrides?: Partial<ScanRecord>
): ScanRecord {
  return {
    id: crypto.randomUUID(),
    schemaVersion: 1,
    tabUrl: 'https://example.com/audit',
    pageTitle: 'Test Page',
    hostname: 'example.com',
    scannedAt: new Date().toISOString(),
    axeVersion: '4.14.0',
    extensionVersion: '0.1.0',
    browserName: 'chrome',
    status: 'completed',
    findings,
    incompleteChecksCount: 0,
    passesCount: 10,
    inapplicableCount: 5,
    ...overrides,
  };
}

describe('Rescan Verification & Lifecycle Integration Engine', () => {
  let tracker: RemediationTracker;

  beforeEach(async () => {
    await storageService.clearAllData();
    tracker = new RemediationTracker(storageService);
  });

  describe('normalizeUrlForComparison', () => {
    it('strips pure in-page element scroll anchors (#section, #top)', () => {
      const url1 = 'https://example.com/page#section1';
      const url2 = 'https://example.com/page#section2';
      expect(normalizeUrlForComparison(url1)).toBe(normalizeUrlForComparison(url2));
      expect(normalizeUrlForComparison(url1)).toBe('https://example.com/page');
    });

    it('preserves meaningful SPA route fragments (#/settings vs #/profile)', () => {
      const settingsUrl = 'https://example.com/#/settings';
      const profileUrl = 'https://example.com/#/profile';
      expect(normalizeUrlForComparison(settingsUrl)).not.toBe(
        normalizeUrlForComparison(profileUrl)
      );
      expect(normalizeUrlForComparison(settingsUrl)).toBe(
        'https://example.com/#/settings'
      );
      expect(normalizeUrlForComparison(profileUrl)).toBe('https://example.com/#/profile');
    });

    it('normalizes trailing slashes within SPA route fragments', () => {
      const withSlash = 'https://example.com/#/settings/';
      const withoutSlash = 'https://example.com/#/settings';
      expect(normalizeUrlForComparison(withSlash)).toBe(
        normalizeUrlForComparison(withoutSlash)
      );
      expect(normalizeUrlForComparison(withSlash)).toBe('https://example.com/#/settings');
    });

    it('preserves hashbang SPA routes (#!/dashboard)', () => {
      const hashbang = 'https://example.com/#!/dashboard';
      expect(normalizeUrlForComparison(hashbang)).toBe(
        'https://example.com/#!/dashboard'
      );
    });

    it('preserves case sensitivity on pathnames to prevent route collisions', () => {
      const upperPath = 'https://example.com/User/Profile';
      const lowerPath = 'https://example.com/user/profile';
      expect(normalizeUrlForComparison(upperPath)).not.toBe(
        normalizeUrlForComparison(lowerPath)
      );
    });

    it('sorts query parameters alphabetically regardless of order', () => {
      const urlA = 'https://example.com/search?b=2&a=1&c=3';
      const urlB = 'https://example.com/search?c=3&a=1&b=2';
      expect(normalizeUrlForComparison(urlA)).toBe(normalizeUrlForComparison(urlB));
    });

    it('sorts multiple query parameters for the same key deterministically', () => {
      const url1 = 'https://example.com/items?tag=beta&tag=alpha';
      const url2 = 'https://example.com/items?tag=alpha&tag=beta';
      expect(normalizeUrlForComparison(url1)).toBe(normalizeUrlForComparison(url2));
      expect(normalizeUrlForComparison(url1)).toBe(
        'https://example.com/items?tag=alpha&tag=beta'
      );
    });

    it('normalizes trailing slashes on non-root paths', () => {
      const withSlash = 'https://example.com/about/';
      const withoutSlash = 'https://example.com/about';
      expect(normalizeUrlForComparison(withSlash)).toBe(
        normalizeUrlForComparison(withoutSlash)
      );
    });

    it('normalizes scheme and hostname to lowercase', () => {
      const upper = 'HTTPS://EXAMPLE.COM/page';
      const lower = 'https://example.com/page';
      expect(normalizeUrlForComparison(upper)).toBe(normalizeUrlForComparison(lower));
    });

    it('distinguishes different paths and different domains', () => {
      expect(normalizeUrlForComparison('https://example.com/a')).not.toBe(
        normalizeUrlForComparison('https://example.com/b')
      );
      expect(normalizeUrlForComparison('https://a.example.com')).not.toBe(
        normalizeUrlForComparison('https://b.example.com')
      );
    });

    it('property test: idempotency of URL normalization', () => {
      fc.assert(
        fc.property(
          fc.webUrl({ withQueryParameters: true, withFragments: true }),
          (rawUrl) => {
            const firstPass = normalizeUrlForComparison(rawUrl);
            const secondPass = normalizeUrlForComparison(firstPass);
            expect(secondPass).toBe(firstPass);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('evaluateScanComparability', () => {
    it('returns false when baseline scan is null or undefined', () => {
      const rescan = createMockScan([]);
      const result = evaluateScanComparability(null, rescan);
      expect(result.isComparable).toBe(false);
      expect(result.skippedOutcome).toBe('incomparable-scan');
    });

    it('returns false when rescan is undefined', () => {
      const baseline = createMockScan([]);
      const result = evaluateScanComparability(baseline, undefined);
      expect(result.isComparable).toBe(false);
      expect(result.skippedOutcome).toBe('incomparable-scan');
    });

    it('returns false when rescan failed', () => {
      const baseline = createMockScan([]);
      const rescan = createMockScan([], { status: 'failed' });
      const result = evaluateScanComparability(baseline, rescan);
      expect(result.isComparable).toBe(false);
      expect(result.skippedOutcome).toBe('failed-scan');
      expect(result.reason).toContain('Failed scans cannot verify remediation');
    });

    it('returns false when rescan was cancelled', () => {
      const baseline = createMockScan([]);
      const rescan = createMockScan([], { status: 'cancelled' });
      const result = evaluateScanComparability(baseline, rescan);
      expect(result.isComparable).toBe(false);
      expect(result.skippedOutcome).toBe('cancelled-scan');
    });

    it('returns false when rescan is still running or queued', () => {
      const baseline = createMockScan([]);
      const rescan = createMockScan([], { status: 'running' });
      const result = evaluateScanComparability(baseline, rescan);
      expect(result.isComparable).toBe(false);
      expect(result.skippedOutcome).toBe('incomplete-scan');
    });

    it('returns false when baseline was incomplete or failed', () => {
      const baseline = createMockScan([], { status: 'failed' });
      const rescan = createMockScan([], { status: 'completed' });
      const result = evaluateScanComparability(baseline, rescan);
      expect(result.isComparable).toBe(false);
      expect(result.skippedOutcome).toBe('incomparable-scan');
    });

    it('returns false when URLs differ between baseline and rescan', () => {
      const baseline = createMockScan([], { tabUrl: 'https://example.com/page-1' });
      const rescan = createMockScan([], { tabUrl: 'https://example.com/page-2' });
      const result = evaluateScanComparability(baseline, rescan);
      expect(result.isComparable).toBe(false);
      expect(result.skippedOutcome).toBe('incomparable-scan');
      expect(result.reason).toContain('Scan targets differ');
    });

    it('returns true when both scans are completed on matching target URLs', () => {
      const baseline = createMockScan([], { tabUrl: 'https://example.com/app#view1' });
      const rescan = createMockScan([], { tabUrl: 'https://example.com/app#view2' });
      const result = evaluateScanComparability(baseline, rescan);
      expect(result.isComparable).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('returns false when scans target different SPA routes (#/settings vs #/profile)', () => {
      const baseline = createMockScan([], { tabUrl: 'https://example.com/#/settings' });
      const rescan = createMockScan([], { tabUrl: 'https://example.com/#/profile' });
      const result = evaluateScanComparability(baseline, rescan);
      expect(result.isComparable).toBe(false);
      expect(result.skippedOutcome).toBe('incomparable-scan');
      expect(result.reason).toContain('Scan targets differ');
    });
  });

  describe('executeRescanVerification — Successful Resolution', () => {
    it('certifies attempted finding as verified when confirmed resolved by rescan', async () => {
      const finding1 = createMockFinding({
        ruleId: 'button-name',
        target: 'button#submit',
      });
      const baseline = createMockScan([finding1]);

      // User marks finding as attempted
      await tracker.markAttempted(finding1.fingerprint, 'Added accessible label');
      expect(await tracker.getFindingStatus(finding1.fingerprint)).toBe('attempted');

      // Rescan has 0 findings (resolved)
      const rescan = createMockScan([]);
      const result = await executeRescanVerification(baseline, rescan, tracker);

      expect(result.summary.comparable).toBe(true);
      expect(result.summary.newlyVerified).toHaveLength(1);
      expect(result.summary.newlyVerified[0]?.fingerprint).toBe(finding1.fingerprint);
      expect(result.summary.newlyVerified[0]?.newStatus).toBe('verified');
      expect(result.summary.newlyVerified[0]?.action).toBe('verified');

      // Verify persistent storage record reflects verified status and scan certification ID
      const record = await tracker.getFindingRecord(finding1.fingerprint);
      expect(record?.status).toBe('verified');
      expect(record?.verifiedAtScanId).toBe(rescan.id);
      expect(record?.notes).toBe('Added accessible label');
    });

    it('certifies suggested finding as verified when confirmed resolved by rescan', async () => {
      const finding = createMockFinding({
        ruleId: 'image-alt',
        target: 'img.banner',
      });
      const baseline = createMockScan([finding]);
      const rescan = createMockScan([]);

      const result = await executeRescanVerification(baseline, rescan, tracker);
      expect(result.summary.newlyVerified).toHaveLength(1);
      expect(await tracker.getFindingStatus(finding.fingerprint)).toBe('verified');
    });

    it('handles multiple findings with mixed outcomes in a single rescan', async () => {
      const fResolved = createMockFinding({
        ruleId: 'button-name',
        target: 'button#ok',
      });
      const fUnchanged = createMockFinding({
        ruleId: 'color-contrast',
        target: 'p.subtext',
      });
      const baseline = createMockScan([fResolved, fUnchanged]);

      await tracker.markAttempted(fResolved.fingerprint, 'Fixed name');
      await tracker.markAttempted(fUnchanged.fingerprint, 'Drafted contrast');

      // Rescan only contains fUnchanged
      const rescan = createMockScan([fUnchanged]);
      const result = await executeRescanVerification(baseline, rescan, tracker);

      expect(result.summary.newlyVerified).toHaveLength(1);
      expect(result.summary.newlyVerified[0]?.fingerprint).toBe(fResolved.fingerprint);
      expect(result.summary.stillPresent).toHaveLength(1);
      expect(result.summary.stillPresent[0]?.fingerprint).toBe(fUnchanged.fingerprint);
      expect(result.summary.stillPresent[0]?.newStatus).toBe('unresolved');

      expect(await tracker.getFindingStatus(fResolved.fingerprint)).toBe('verified');
      expect(await tracker.getFindingStatus(fUnchanged.fingerprint)).toBe('unresolved');
    });
  });

  describe('executeRescanVerification — False Verification Prevention', () => {
    it('prevents verification when rescan failed, even if findings array is empty', async () => {
      const finding = createMockFinding({
        ruleId: 'button-name',
        target: 'button#pay',
      });
      const baseline = createMockScan([finding]);
      await tracker.markAttempted(finding.fingerprint, 'Drafting label');

      const failedRescan = createMockScan([], { status: 'failed' });
      const result = await executeRescanVerification(baseline, failedRescan, tracker);

      expect(result.summary.comparable).toBe(false);
      expect(result.summary.skippedVerification?.reason).toContain(
        'Failed scans cannot verify remediation'
      );
      expect(result.summary.newlyVerified).toHaveLength(0);

      // Status must remain 'attempted'
      expect(await tracker.getFindingStatus(finding.fingerprint)).toBe('attempted');
    });

    it('prevents verification on cancelled or incomplete scans', async () => {
      const finding = createMockFinding({
        ruleId: 'form-label',
        target: 'input#email',
      });
      const baseline = createMockScan([finding]);
      await tracker.markAttempted(finding.fingerprint);

      const cancelledRescan = createMockScan([], { status: 'cancelled' });
      const result = await executeRescanVerification(baseline, cancelledRescan, tracker);

      expect(result.summary.comparable).toBe(false);
      expect(result.summary.newlyVerified).toHaveLength(0);
      expect(await tracker.getFindingStatus(finding.fingerprint)).toBe('attempted');
    });

    it('prevents verification when scans were executed on different URLs', async () => {
      const finding = createMockFinding({
        ruleId: 'link-name',
        target: 'a.nav',
      });
      const baseline = createMockScan([finding], {
        tabUrl: 'https://example.com/home',
      });
      const rescan = createMockScan([], {
        tabUrl: 'https://example.com/checkout',
      });
      await tracker.markAttempted(finding.fingerprint);

      const result = await executeRescanVerification(baseline, rescan, tracker);
      expect(result.summary.comparable).toBe(false);
      expect(result.summary.newlyVerified).toHaveLength(0);
      expect(await tracker.getFindingStatus(finding.fingerprint)).toBe('attempted');
    });

    it('uncertain match protection: shifted selector on same element prevents false verification', async () => {
      const baseFinding = createMockFinding({
        ruleId: 'button-name',
        target: 'button.btn-checkout',
      });
      const candidateRescanFinding = createMockFinding({
        ruleId: 'button-name',
        target: 'div.wrapper > button.btn-checkout-new',
      });

      const baseline = createMockScan([baseFinding]);
      const rescan = createMockScan([candidateRescanFinding]);

      await tracker.markAttempted(baseFinding.fingerprint);

      const result = await executeRescanVerification(baseline, rescan, tracker);

      expect(result.summary.uncertainMatches).toHaveLength(1);
      expect(result.summary.newlyVerified).toHaveLength(0);
      // Attempted finding must NOT be marked verified; it moves to unresolved
      expect(await tracker.getFindingStatus(baseFinding.fingerprint)).toBe('unresolved');
    });

    it('deduplicates duplicate findings in scan payloads without crashing', async () => {
      const finding1 = createMockFinding({
        ruleId: 'button-name',
        target: 'button#dup',
      });
      // Duplicate entry with same fingerprint
      const baseline = createMockScan([finding1, { ...finding1 }]);
      const rescan = createMockScan([]);

      const result = await executeRescanVerification(baseline, rescan, tracker);
      expect(result.summary.totalEvaluated).toBe(1);
      expect(result.summary.newlyVerified).toHaveLength(1);
    });
  });

  describe('executeRescanVerification — Regression Revocation', () => {
    it('revokes verified status to unresolved when previously verified defect reappears in unchanged', async () => {
      const finding = createMockFinding({
        ruleId: 'color-contrast',
        target: 'span.error-msg',
      });
      const scan1 = createMockScan([finding]);
      const scan2 = createMockScan([]);

      // 1. First rescan confirms fix -> verified
      await executeRescanVerification(scan1, scan2, tracker);
      expect(await tracker.getFindingStatus(finding.fingerprint)).toBe('verified');
      const verifiedRecord = await tracker.getFindingRecord(finding.fingerprint);
      expect(verifiedRecord?.verifiedAtScanId).toBe(scan2.id);

      // 2. Next rescan: the defect reappears!
      const scan3 = createMockScan([finding]);
      const result = await executeRescanVerification(scan2, scan3, tracker);

      expect(result.summary.regressions).toHaveLength(1);
      expect(result.summary.regressions[0]?.fingerprint).toBe(finding.fingerprint);
      expect(result.summary.regressions[0]?.newStatus).toBe('unresolved');

      // Verify persistent record has isRegression true and historical verification preserved
      const regressedRecord = await tracker.getFindingRecord(finding.fingerprint);
      expect(regressedRecord?.status).toBe('unresolved');
      expect(regressedRecord?.isRegression).toBe(true);
      expect(regressedRecord?.previouslyVerifiedAtScanId).toBe(scan2.id);
      expect(regressedRecord?.regressionDetectedAt).toBeDefined();
    });

    it('revokes verified status when defect reappears as newly-introduced after multi-scan absence', async () => {
      const finding = createMockFinding({
        ruleId: 'aria-hidden-focus',
        target: 'div[aria-hidden="true"] button',
      });
      const scan1 = createMockScan([finding]);
      const scan2Clean = createMockScan([]);

      // Certified verified
      await executeRescanVerification(scan1, scan2Clean, tracker);
      expect(await tracker.getFindingStatus(finding.fingerprint)).toBe('verified');

      // Scan 3 has finding again (relative to clean scan 2, it is in newFindings)
      const scan3Regressed = createMockScan([finding]);
      const result = await executeRescanVerification(scan2Clean, scan3Regressed, tracker);

      expect(result.summary.regressions).toHaveLength(1);
      expect(await tracker.getFindingStatus(finding.fingerprint)).toBe('unresolved');
      const record = await tracker.getFindingRecord(finding.fingerprint);
      expect(record?.isRegression).toBe(true);
    });
  });
});
