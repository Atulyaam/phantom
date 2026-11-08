import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { ScanRecord } from '@/domain/scan';
import type { FindingRecord } from '@/domain/finding';
import type { RemediationStoragePayload } from '@/domain/remediation';
import {
  buildReportPayload,
  serializeReportToJson,
  deserializeReportFromJson,
  sortFindingsDeterministically,
  determineRuleClassification,
} from '@/features/reports/json-serializer';
import {
  AUTOMATED_TESTING_LIMITATIONS,
  MANUAL_REVIEW_CHECKLIST_PROMPTS,
} from '@/features/reports/disclaimers';
import { ReportExportPayloadSchema } from '@/lib/validation/schemas';

// Sample mock findings
const createMockFinding = (overrides: Partial<FindingRecord> = {}): FindingRecord => ({
  fingerprint: 'fp-button-spectral-101',
  ruleId: 'button-name',
  impact: 'critical',
  description: 'Button in the Grand Ballroom has no discernible accessible name',
  help: 'Buttons must have discernible text',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.14/button-name',
  wcagTags: ['wcag2a', 'wcag412'],
  roomId: 'name-chamber',
  affectedNodeCount: 1,
  nodes: [
    {
      target: ['button.spectral-door'],
      htmlExcerpt: '<button class="spectral-door"></button>',
      failureSummary: 'Fix element name: aria-label missing',
    },
  ],
  firstSeenAt: '2026-10-31T20:00:00.000Z',
  reviewed: false,
  ...overrides,
});

const createMockScan = (overrides: Partial<ScanRecord> = {}): ScanRecord => ({
  id: '770e8400-e29b-41d4-a716-446655440000',
  schemaVersion: 1,
  tabUrl: 'https://haunted-manor.example.com/ballroom?page=1',
  pageTitle: 'Haunted Ballroom — Accessibility Audit',
  hostname: 'haunted-manor.example.com',
  scannedAt: '2026-10-31T20:00:00.000Z',
  completedAt: '2026-10-31T20:00:05.000Z',
  axeVersion: '4.14.0',
  extensionVersion: '0.1.0',
  browserName: 'chrome',
  status: 'completed',
  findings: [
    createMockFinding(),
    createMockFinding({
      fingerprint: 'fp-contrast-crypt-102',
      ruleId: 'color-contrast',
      impact: 'serious',
      roomId: 'contrast-crypt',
      description: 'Faint inscription in crypt foyer',
      wcagTags: ['wcag2aa', 'wcag143'],
    }),
  ],
  incompleteChecksCount: 0,
  passesCount: 24,
  inapplicableCount: 12,
  ...overrides,
});

describe('Phase 8 Workstream 1: Report Domain, Versioned Schema & Deterministic JSON Serialization', () => {
  describe('1. Valid Report Payload Generation & Schema Validation', () => {
    it('builds a strongly typed, schema-valid report payload from a completed scan', () => {
      const scan = createMockScan();
      const payload = buildReportPayload(
        scan,
        {
          format: 'json',
          includeHtmlExcerpts: true,
          urlRedactionLevel: 'full',
        },
        undefined,
        'report-uuid-1234',
        '2026-10-31T20:05:00.000Z'
      );

      // Verify Metadata
      expect(payload.reportMetadata.reportId).toBe('report-uuid-1234');
      expect(payload.reportMetadata.tool).toBe('Phantom Audit');
      expect(payload.reportMetadata.toolVersion).toBe('0.1.0');
      expect(payload.reportMetadata.schemaVersion).toBe(1);
      expect(payload.reportMetadata.version).toBe('1.0.0');
      expect(payload.reportMetadata.exportedAt).toBe('2026-10-31T20:05:00.000Z');
      expect(payload.reportMetadata.environment.browserName).toBe('chrome');
      expect(payload.reportMetadata.environment.axeVersion).toBe('4.14.0');

      // Verify Target
      expect(payload.target.scanId).toBe(scan.id);
      expect(payload.target.url).toBe(scan.tabUrl);
      expect(payload.target.hostname).toBe('haunted-manor.example.com');
      expect(payload.target.pageTitle).toBe('Haunted Ballroom — Accessibility Audit');
      expect(payload.target.scannedAt).toBe(scan.scannedAt);
      expect(payload.target.completedAt).toBe(scan.completedAt);

      // Verify Summary
      expect(payload.summary.totalFindings).toBe(2);
      expect(payload.summary.criticalCount).toBe(1);
      expect(payload.summary.seriousCount).toBe(1);
      expect(payload.summary.moderateCount).toBe(0);
      expect(payload.summary.minorCount).toBe(0);
      expect(payload.summary.passesCount).toBe(24);
      expect(payload.summary.incompleteChecksCount).toBe(0);
      expect(payload.summary.inapplicableCount).toBe(12);

      // Verify Room Summaries
      expect(payload.summary.roomsSummary['name-chamber'].totalFindings).toBe(1);
      expect(payload.summary.roomsSummary['name-chamber'].criticalCount).toBe(1);
      expect(payload.summary.roomsSummary['contrast-crypt'].totalFindings).toBe(1);
      expect(payload.summary.roomsSummary['contrast-crypt'].seriousCount).toBe(1);
      expect(payload.summary.roomsSummary['portrait-gallery'].totalFindings).toBe(0);

      // Verify Findings Details
      expect(payload.findings).toHaveLength(2);
      expect(payload.findings[0].fingerprint).toBe('fp-button-spectral-101');
      expect(payload.findings[0].roomName).toBe('The Name Chamber');
      expect(payload.findings[0].ruleClassification).toBe('normative-wcag');

      // Verify Limitations and Manual Checklist
      expect(payload.limitations).toBe(AUTOMATED_TESTING_LIMITATIONS);
      expect(payload.manualReviewChecklist).toEqual(MANUAL_REVIEW_CHECKLIST_PROMPTS);

      // Verify Zod schema validation passes without throwing
      expect(() => ReportExportPayloadSchema.parse(payload)).not.toThrow();
    });

    it('rejects invalid schemaVersion (must be literal 1)', () => {
      const scan = createMockScan();
      const payload = buildReportPayload(scan);
      // Mutate schemaVersion to an invalid version
      const invalidPayload = {
        ...payload,
        reportMetadata: {
          ...payload.reportMetadata,
          schemaVersion: 2,
        },
      };

      expect(() => ReportExportPayloadSchema.parse(invalidPayload)).toThrow();
    });

    it('rejects invalid version string (must be literal 1.0.0)', () => {
      const scan = createMockScan();
      const payload = buildReportPayload(scan);
      const invalidPayload = {
        ...payload,
        reportMetadata: {
          ...payload.reportMetadata,
          version: '2.0.0',
        },
      };

      expect(() => ReportExportPayloadSchema.parse(invalidPayload)).toThrow();
    });

    it('rejects payloads missing mandatory fields', () => {
      const scan = createMockScan();
      const payload = buildReportPayload(scan);

      // Missing target
      const noTarget = { ...payload } as Record<string, unknown>;
      delete noTarget.target;
      expect(() => ReportExportPayloadSchema.parse(noTarget)).toThrow();

      // Missing summary
      const noSummary = { ...payload } as Record<string, unknown>;
      delete noSummary.summary;
      expect(() => ReportExportPayloadSchema.parse(noSummary)).toThrow();

      // Missing disclaimers
      const noDisclaimers = { ...payload } as Record<string, unknown>;
      delete noDisclaimers.limitations;
      expect(() => ReportExportPayloadSchema.parse(noDisclaimers)).toThrow();
    });

    it('handles optional fields safely (completedAt omitted, helpUrl empty or missing)', () => {
      const scan = createMockScan({
        completedAt: undefined,
        findings: [
          createMockFinding({
            helpUrl: undefined,
            comparisonCategory: undefined,
            uncertainReason: undefined,
          }),
        ],
      });

      const payload = buildReportPayload(scan);
      expect(payload.target.completedAt).toBeUndefined();
      expect(payload.findings[0].helpUrl).toBeUndefined();
      expect(payload.findings[0].comparisonCategory).toBeUndefined();
      expect(() => ReportExportPayloadSchema.parse(payload)).not.toThrow();
    });
  });

  describe('2. Empty Findings Handling (Clean Baseline)', () => {
    it('correctly constructs and serializes a clean scan with zero violations', () => {
      const cleanScan = createMockScan({
        findings: [],
        passesCount: 45,
        incompleteChecksCount: 0,
        inapplicableCount: 20,
      });

      const payload = buildReportPayload(cleanScan);
      expect(payload.findings).toEqual([]);
      expect(payload.summary.totalFindings).toBe(0);
      expect(payload.summary.criticalCount).toBe(0);
      expect(payload.summary.seriousCount).toBe(0);
      expect(payload.summary.moderateCount).toBe(0);
      expect(payload.summary.minorCount).toBe(0);
      expect(payload.summary.passesCount).toBe(45);

      // All room summaries have 0
      for (const room of Object.values(payload.summary.roomsSummary)) {
        expect(room.totalFindings).toBe(0);
      }

      // Limitations notice is still present even with 0 findings
      expect(payload.limitations).toContain(
        'Zero reported automated violations does not establish that a web page is WCAG compliant'
      );

      const jsonStr = serializeReportToJson(payload);
      expect(jsonStr).toContain('"totalFindings": 0');
      expect(jsonStr).toContain('"findings": []');

      const roundTrip = deserializeReportFromJson(jsonStr);
      expect(roundTrip.findings).toEqual([]);
      expect(roundTrip.summary.totalFindings).toBe(0);
    });
  });

  describe('3. Deterministic Finding Sorting & Serialization Invariants', () => {
    it('stably sorts findings: severity -> roomId -> ruleId -> fingerprint', () => {
      const f1 = createMockFinding({
        fingerprint: 'fp-zzz-minor',
        impact: 'minor',
        roomId: 'structure-hall',
        ruleId: 'heading-order',
      });
      const f2 = createMockFinding({
        fingerprint: 'fp-aaa-critical',
        impact: 'critical',
        roomId: 'name-chamber',
        ruleId: 'button-name',
      });
      const f3 = createMockFinding({
        fingerprint: 'fp-bbb-serious',
        impact: 'serious',
        roomId: 'contrast-crypt',
        ruleId: 'color-contrast',
      });
      const f4 = createMockFinding({
        fingerprint: 'fp-ccc-critical',
        impact: 'critical',
        roomId: 'name-chamber',
        ruleId: 'aria-dialog-name',
      });

      const scan = createMockScan({
        findings: [f1, f2, f3, f4],
      });

      const payload = buildReportPayload(scan);

      // Expected order:
      // 1. Critical, name-chamber, aria-dialog-name, fp-ccc-critical
      // 2. Critical, name-chamber, button-name, fp-aaa-critical
      // 3. Serious, contrast-crypt, color-contrast, fp-bbb-serious
      // 4. Minor, structure-hall, heading-order, fp-zzz-minor
      expect(payload.findings[0].fingerprint).toBe('fp-ccc-critical');
      expect(payload.findings[1].fingerprint).toBe('fp-aaa-critical');
      expect(payload.findings[2].fingerprint).toBe('fp-bbb-serious');
      expect(payload.findings[3].fingerprint).toBe('fp-zzz-minor');

      // Test standalone sortFindingsDeterministically helper and immutability
      const reversed = [...payload.findings].reverse();
      const reSorted = sortFindingsDeterministically(reversed);
      expect(reSorted[0].fingerprint).toBe('fp-ccc-critical');
      expect(reversed[0].fingerprint).toBe('fp-zzz-minor'); // input untouched
    });

    it('produces byte-identical JSON strings for identical inputs', () => {
      const scan = createMockScan();
      const payload1 = buildReportPayload(
        scan,
        undefined,
        undefined,
        'fixed-id',
        '2026-10-31T20:00:00.000Z'
      );
      const payload2 = buildReportPayload(
        scan,
        undefined,
        undefined,
        'fixed-id',
        '2026-10-31T20:00:00.000Z'
      );

      const json1 = serializeReportToJson(payload1);
      const json2 = serializeReportToJson(payload2);

      expect(json1).toBe(json2);
      expect(Buffer.byteLength(json1)).toBe(Buffer.byteLength(json2));
    });

    it('property test: finding order permutation in source scan yields byte-identical output', () => {
      fc.assert(
        fc.property(
          fc.shuffledSubarray(
            [
              createMockFinding({
                fingerprint: 'fp-1',
                impact: 'critical',
                ruleId: 'button-name',
                roomId: 'name-chamber',
              }),
              createMockFinding({
                fingerprint: 'fp-2',
                impact: 'serious',
                ruleId: 'color-contrast',
                roomId: 'contrast-crypt',
              }),
              createMockFinding({
                fingerprint: 'fp-3',
                impact: 'moderate',
                ruleId: 'form-field',
                roomId: 'form-cellar',
              }),
              createMockFinding({
                fingerprint: 'fp-4',
                impact: 'minor',
                ruleId: 'heading-order',
                roomId: 'structure-hall',
              }),
            ],
            { minLength: 4 }
          ),
          (shuffledFindings) => {
            const scan = createMockScan({ findings: shuffledFindings });
            const payload = buildReportPayload(
              scan,
              undefined,
              undefined,
              'constant-report-id',
              '2026-10-31T20:00:00.000Z'
            );
            const json = serializeReportToJson(payload);

            const parsed = deserializeReportFromJson(json);
            // First item must always be critical fp-1
            expect(parsed.findings[0].fingerprint).toBe('fp-1');
            // Second item must always be serious fp-2
            expect(parsed.findings[1].fingerprint).toBe('fp-2');
            // Third item must always be moderate fp-3
            expect(parsed.findings[2].fingerprint).toBe('fp-3');
            // Fourth item must always be minor fp-4
            expect(parsed.findings[3].fingerprint).toBe('fp-4');
          }
        ),
        { numRuns: 24 }
      );
    });
  });

  describe('4. Source Scan & Remediation Immutability', () => {
    it('never mutates the input scan or its finding array', () => {
      const scan = createMockScan();
      const originalFindingsSnapshot = JSON.parse(JSON.stringify(scan.findings));
      const originalScanSnapshot = JSON.parse(JSON.stringify(scan));

      buildReportPayload(scan);

      expect(scan.findings).toEqual(originalFindingsSnapshot);
      expect(scan).toEqual(originalScanSnapshot);
    });

    it('never mutates the input remediation records', () => {
      const scan = createMockScan();
      const remediationRecords: RemediationStoragePayload = {
        'fp-button-spectral-101': {
          fingerprint: 'fp-button-spectral-101',
          status: 'attempted',
          updatedAt: '2026-10-31T21:00:00.000Z',
          notes: 'Added aria-label in source template',
        },
      };
      const originalRemediationSnapshot = JSON.parse(JSON.stringify(remediationRecords));

      buildReportPayload(scan, undefined, remediationRecords);

      expect(remediationRecords).toEqual(originalRemediationSnapshot);
    });
  });

  describe('5. Rule Classification: Normative WCAG vs Best-Practice', () => {
    it('classifies normative WCAG rules accurately from catalog and tags', () => {
      expect(determineRuleClassification('button-name', ['wcag2a', 'wcag412'])).toBe(
        'normative-wcag'
      );
      expect(determineRuleClassification('color-contrast', ['wcag2aa', 'wcag143'])).toBe(
        'normative-wcag'
      );
      expect(determineRuleClassification('custom-unknown-rule', ['wcag21aa'])).toBe(
        'normative-wcag'
      );
    });

    it('classifies advisory and best-practice rules accurately', () => {
      expect(determineRuleClassification('tabindex', ['best-practice'])).toBe(
        'best-practice'
      );
      expect(
        determineRuleClassification('unknown-advisory', ['experimental', 'cat.semantics'])
      ).toBe('best-practice');
    });
  });

  describe('6. Remediation Guidance Integration & Missing Records Handling', () => {
    it('integrates remediation guidance from catalog and stored records when available', () => {
      const scan = createMockScan();
      const remediationRecords: RemediationStoragePayload = {
        'fp-button-spectral-101': {
          fingerprint: 'fp-button-spectral-101',
          status: 'verified',
          updatedAt: '2026-10-31T21:00:00.000Z',
          notes: 'Audited and verified in rescan',
        },
      };

      const payload = buildReportPayload(scan, undefined, remediationRecords);
      const buttonFinding = payload.findings.find((f) => f.ruleId === 'button-name');
      expect(buttonFinding?.remediationRecommendation).toBeDefined();
      expect(buttonFinding?.remediationRecommendation?.status).toBe('verified');
      expect(buttonFinding?.remediationRecommendation?.notes).toBe(
        'Audited and verified in rescan'
      );
      expect(buttonFinding?.remediationRecommendation?.suggestedSnippet).toContain(
        '<button'
      );
    });

    it('gracefully handles missing remediation records without throwing', () => {
      const scan = createMockScan({
        findings: [
          createMockFinding({
            ruleId: 'completely-custom-rule-without-catalog-entry',
            help: 'Custom guidance help text',
          }),
        ],
      });

      // No remediation records passed
      const payload = buildReportPayload(scan, undefined, undefined);
      expect(payload.findings[0].remediationRecommendation).toBeUndefined();
      expect(() => serializeReportToJson(payload)).not.toThrow();
    });
  });

  describe('7. International Text & Unicode Resilience', () => {
    it('correctly serializes and deserializes international scripts, unicode entities, and emojis', () => {
      const unicodeFinding = createMockFinding({
        description: 'ボタンにアクセシブルな名前がありません (Missing name) 👻 [الأشباح]',
        help: 'Элементы должны иметь понятные подписи — Überprüfung erforderlich',
        nodes: [
          {
            target: ['button[aria-label="日本語・العربية・Русский"]'],
            htmlExcerpt: '<button class="👻-btn">幽霊</button>',
            failureSummary: 'Fix element name: 4.5:1 境界・حرج・критический',
          },
        ],
      });

      const scan = createMockScan({
        pageTitle: '呪われた館 — Haunted Manor 🏰',
        hostname: 'haunted-manor.jp',
        tabUrl: 'https://haunted-manor.jp/ballroom?filter=妖怪&page=1',
        findings: [unicodeFinding],
      });

      const payload = buildReportPayload(scan);
      const jsonStr = serializeReportToJson(payload);

      // Verify strings in raw JSON
      expect(jsonStr).toContain('呪われた館 — Haunted Manor 🏰');
      expect(jsonStr).toContain('ボタンにアクセシブルな名前がありません');
      expect(jsonStr).toContain('الأشباح');
      expect(jsonStr).toContain('Überprüfung');
      expect(jsonStr).toContain('幽霊');

      // Roundtrip parsing
      const parsed = deserializeReportFromJson(jsonStr);
      expect(parsed.target.pageTitle).toBe('呪われた館 — Haunted Manor 🏰');
      expect(parsed.findings[0].description).toBe(
        'ボタンにアクセシブルな名前がありません (Missing name) 👻 [الأشباح]'
      );
      expect(parsed.findings[0].nodes[0].htmlExcerpt).toBe(
        '<button class="👻-btn">幽霊</button>'
      );
    });
  });

  describe('8. Scale & Large Finding Collection Performance', () => {
    it('efficiently serializes a scan with 150 findings across all rooms without performance lag', () => {
      const largeFindings: FindingRecord[] = [];
      const rooms: FindingRecord['roomId'][] = [
        'name-chamber',
        'contrast-crypt',
        'portrait-gallery',
        'form-cellar',
        'structure-hall',
        'focus-corridor',
        'other',
      ];
      const impacts: FindingRecord['impact'][] = [
        'critical',
        'serious',
        'moderate',
        'minor',
      ];

      for (let i = 0; i < 150; i++) {
        largeFindings.push(
          createMockFinding({
            fingerprint: `fp-scale-${String(i).padStart(4, '0')}`,
            ruleId: `rule-${i % 15}`,
            roomId: rooms[i % rooms.length],
            impact: impacts[i % impacts.length],
            description: `Violation item ${i} across mansion rooms`,
          })
        );
      }

      const scan = createMockScan({ findings: largeFindings });
      const startTime = performance.now();
      const payload = buildReportPayload(scan);
      const json = serializeReportToJson(payload);
      const endTime = performance.now();

      expect(payload.findings).toHaveLength(150);
      expect(payload.summary.totalFindings).toBe(150);
      expect(json.length).toBeGreaterThan(10000);
      // Execution must complete well under 2000ms even under full concurrent test suite load
      expect(endTime - startTime).toBeLessThan(2000);

      const parsed = deserializeReportFromJson(json);
      expect(parsed.findings).toHaveLength(150);
    });
  });

  describe('9. Strict Schema: Anti-Leakage & Arbitrary State Rejection', () => {
    it('strict schema rejects injected arbitrary application state', () => {
      const scan = createMockScan();
      const payload = buildReportPayload(scan);

      // Infiltrate arbitrary application state (e.g. leaked secret or internal state)
      const leakedPayload = {
        ...payload,
        secretInternalState: { leakedToken: 'secret_12345', activeTabId: 42 },
      };

      expect(() => ReportExportPayloadSchema.parse(leakedPayload)).toThrow();
    });
  });

  describe('10. Property-based Roundtrip Identity (fast-check)', () => {
    it('preserves exact report structure across serialize -> deserialize roundtrip', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 20 }),
          fc.integer({ min: 0, max: 100 }),
          (criticalCount, passesCount) => {
            const findings: FindingRecord[] = [];
            for (let i = 0; i < criticalCount; i++) {
              findings.push(
                createMockFinding({
                  fingerprint: `fp-fuzz-${i}`,
                  ruleId: `rule-fuzz-${i % 3}`,
                })
              );
            }

            const scan = createMockScan({
              findings,
              passesCount,
            });

            const payload = buildReportPayload(
              scan,
              undefined,
              undefined,
              `rep-${criticalCount}`,
              '2026-10-31T20:00:00.000Z'
            );
            const json = serializeReportToJson(payload);
            const deserialized = deserializeReportFromJson(json);

            expect(deserialized.summary.totalFindings).toBe(criticalCount);
            expect(deserialized.summary.passesCount).toBe(passesCount);
            expect(deserialized.findings.length).toBe(criticalCount);
            expect(deserialized.reportMetadata.reportId).toBe(`rep-${criticalCount}`);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('11. Defect Hardening & Regression Tests (DEF-801 through DEF-805)', () => {
    it('DEF-801: nested schemas strictly reject unexpected arbitrary properties at every level', () => {
      const scan = createMockScan();
      const basePayload = buildReportPayload(scan);

      // Infiltrate property into reportMetadata
      const badMetadata = {
        ...basePayload,
        reportMetadata: { ...basePayload.reportMetadata, unauthorizedKey: 'leaked' },
      };
      expect(() => ReportExportPayloadSchema.parse(badMetadata)).toThrow();

      // Infiltrate property into target
      const badTarget = {
        ...basePayload,
        target: { ...basePayload.target, injectedSession: 'sess_123' },
      };
      expect(() => ReportExportPayloadSchema.parse(badTarget)).toThrow();

      // Infiltrate property into finding
      const badFinding = {
        ...basePayload,
        findings: [{ ...basePayload.findings[0], rawDomHandle: 'leak' }],
      };
      expect(() => ReportExportPayloadSchema.parse(badFinding)).toThrow();

      // Infiltrate property into finding node
      const badNode = {
        ...basePayload,
        findings: [
          {
            ...basePayload.findings[0],
            nodes: [
              { ...basePayload.findings[0].nodes[0], unescapedOuterHtml: '<div/>' },
            ],
          },
        ],
      };
      expect(() => ReportExportPayloadSchema.parse(badNode)).toThrow();

      // Infiltrate property into optionsApplied
      const badOptions = {
        ...basePayload,
        reportMetadata: {
          ...basePayload.reportMetadata,
          optionsApplied: {
            format: 'json' as const,
            includeHtmlExcerpts: true,
            urlRedactionLevel: 'full' as const,
            maliciousFlag: true,
          },
        },
      };
      expect(() => ReportExportPayloadSchema.parse(badOptions)).toThrow();
    });

    it('DEF-802: target.url enforces defense-in-depth sanitization purging credentials and sensitive query tokens', () => {
      const dirtyScan = createMockScan({
        tabUrl:
          'https://admin:supersecret@haunted-manor.example.com/ballroom?token=oauth_token_12345&auth_key=secret99&page=1#access_token=jwt_leak',
      });

      const payload = buildReportPayload(dirtyScan);
      // Assert userinfo credentials removed
      expect(payload.target.url).not.toContain('admin:supersecret@');
      // Assert sensitive query tokens removed
      expect(payload.target.url).not.toContain('oauth_token_12345');
      expect(payload.target.url).not.toContain('secret99');
      // Assert sensitive OAuth hash fragment removed
      expect(payload.target.url).not.toContain('jwt_leak');
      // Assert functional parameter preserved
      expect(payload.target.url).toContain('page=1');
      expect(payload.target.url).toBe(
        'https://haunted-manor.example.com/ballroom?page=1'
      );
    });

    it('DEF-803: supports controlled timestamp and reportId injection directly via ExportReportOptions', () => {
      const scan = createMockScan();
      const payload = buildReportPayload(scan, {
        format: 'json',
        includeHtmlExcerpts: true,
        urlRedactionLevel: 'full',
        reportId: 'opt-controlled-id-999',
        exportedAt: '2026-11-01T12:34:56.000Z',
      });

      expect(payload.reportMetadata.reportId).toBe('opt-controlled-id-999');
      expect(payload.reportMetadata.exportedAt).toBe('2026-11-01T12:34:56.000Z');
      expect(payload.reportMetadata.optionsApplied?.reportId).toBe(
        'opt-controlled-id-999'
      );
      expect(payload.reportMetadata.optionsApplied?.exportedAt).toBe(
        '2026-11-01T12:34:56.000Z'
      );
    });

    it('DEF-804: verifies distinct contract validation for schemaVersion: 1 and version: 1.0.0', () => {
      const scan = createMockScan();
      const payload = buildReportPayload(scan);

      expect(payload.reportMetadata.schemaVersion).toBe(1);
      expect(payload.reportMetadata.version).toBe('1.0.0');

      // Validates schema rejects numeric string for schemaVersion
      const badSchemaVer = {
        ...payload,
        reportMetadata: { ...payload.reportMetadata, schemaVersion: '1' },
      };
      expect(() => ReportExportPayloadSchema.parse(badSchemaVer)).toThrow();
    });

    it('DEF-805: finding nodes are stably sorted by primary target selector', () => {
      const scan = createMockScan({
        findings: [
          createMockFinding({
            nodes: [
              { target: ['p.z-last'], failureSummary: 'Issue in last paragraph' },
              { target: ['a.a-first'], failureSummary: 'Issue in first link' },
              { target: ['button.m-middle'], failureSummary: 'Issue in middle button' },
            ],
          }),
        ],
      });

      const payload = buildReportPayload(scan);
      expect(payload.findings[0].nodes[0].target[0]).toBe('a.a-first');
      expect(payload.findings[0].nodes[1].target[0]).toBe('button.m-middle');
      expect(payload.findings[0].nodes[2].target[0]).toBe('p.z-last');
    });
  });
});
