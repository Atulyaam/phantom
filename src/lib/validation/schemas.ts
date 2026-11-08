import { z } from 'zod';

export const ImpactSchema = z.enum([
  'critical',
  'serious',
  'moderate',
  'minor',
  'unknown',
]);

export const RoomIdSchema = z.enum([
  'name-chamber',
  'contrast-crypt',
  'portrait-gallery',
  'form-cellar',
  'structure-hall',
  'focus-corridor',
  'other',
]);

export const FindingNodeSchema = z.object({
  target: z.array(z.string()),
  htmlExcerpt: z.string().max(1000),
  failureSummary: z.string(),
});

export const WcagPrincipleSchema = z.enum([
  'perceivable',
  'operable',
  'understandable',
  'robust',
  'best-practice',
]);

export const ComparisonCategorySchema = z.enum([
  'verified-fix',
  'disappeared',
  'unchanged',
  'new',
  'uncertain',
]);

export const FindingRecordSchema = z.object({
  fingerprint: z.string().min(1),
  ruleId: z.string().min(1),
  impact: ImpactSchema,
  description: z.string(),
  help: z.string(),
  helpUrl: z.string().url().optional(),
  wcagTags: z.array(z.string()),
  roomId: RoomIdSchema,
  affectedNodeCount: z.number().int().nonnegative(),
  nodes: z.array(FindingNodeSchema),
  firstSeenAt: z.string().datetime(),
  reviewed: z.boolean().default(false),
  comparisonCategory: ComparisonCategorySchema.optional(),
  uncertainReason: z.string().optional(),
});

export const UncertainFindingMatchSchema = z.object({
  baselineFinding: FindingRecordSchema,
  candidateRescanFinding: FindingRecordSchema,
  confidence: z.enum(['high', 'medium']),
  reason: z.string(),
});

export const ScanComparisonMetricsSchema = z.object({
  baselineTotal: z.number().int().nonnegative(),
  rescanTotal: z.number().int().nonnegative(),
  resolvedCount: z.number().int().nonnegative(),
  verifiedResolvedCount: z.number().int().nonnegative().optional(),
  disappearedCount: z.number().int().nonnegative().optional(),
  unchangedCount: z.number().int().nonnegative(),
  newCount: z.number().int().nonnegative(),
  uncertainCount: z.number().int().nonnegative(),
  netProgress: z.number().int(),
  verifiedNetProgress: z.number().int().optional(),
  improvementScore: z.number().min(0).max(100),
  verifiedImprovementScore: z.number().min(0).max(100).optional(),
});

export const ScanComparisonSchema = z.object({
  fromScanId: z.string(),
  toScanId: z.string(),
  generatedAt: z.string().datetime(),
  isComparable: z.boolean().default(true),
  incomparableReason: z.string().optional(),
  verifiedResolved: z.array(FindingRecordSchema).default([]),
  disappeared: z.array(FindingRecordSchema).default([]),
  resolved: z.array(FindingRecordSchema),
  unchanged: z.array(FindingRecordSchema),
  newFindings: z.array(FindingRecordSchema),
  uncertainMatches: z.array(UncertainFindingMatchSchema).optional(),
  metrics: ScanComparisonMetricsSchema.optional(),
});

export const ScanStatusSchema = z.enum([
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
]);

export const ScanRecordSchema = z.object({
  id: z.string().uuid(),
  schemaVersion: z.literal(1),
  tabUrl: z.string().url(),
  pageTitle: z.string(),
  hostname: z.string(),
  scannedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  axeVersion: z.string(),
  extensionVersion: z.string(),
  browserName: z.enum(['chrome', 'edge', 'unknown']),
  status: ScanStatusSchema,
  findings: z.array(FindingRecordSchema),
  incompleteChecksCount: z.number().int().nonnegative(),
  passesCount: z.number().int().nonnegative(),
  inapplicableCount: z.number().int().nonnegative(),
  errorCode: z.string().optional(),
});

export const ScanSummarySchema = z.object({
  id: z.string().uuid(),
  schemaVersion: z.literal(1),
  tabUrl: z.string().url(),
  pageTitle: z.string(),
  hostname: z.string(),
  scannedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  status: ScanStatusSchema,
  totalFindings: z.number().int().nonnegative(),
  criticalCount: z.number().int().nonnegative(),
  seriousCount: z.number().int().nonnegative(),
  moderateCount: z.number().int().nonnegative(),
  minorCount: z.number().int().nonnegative(),
  passesCount: z.number().int().nonnegative(),
  incompleteChecksCount: z.number().int().nonnegative(),
});

export const StartScanMessageSchema = z.object({
  type: z.literal('START_SCAN'),
  tabId: z.number().int().positive(),
});

export const TabContextSchema = z.object({
  tabId: z.number().int().positive(),
  url: z.string().url(),
  title: z.string().optional(),
  favIconUrl: z.string().optional(),
});

// Phase 6: Remediation Domain Schemas
export const RemediationStatusSchema = z.enum([
  'suggested',
  'attempted',
  'verified',
  'unresolved',
]);

export const RuleClassificationSchema = z.enum(['normative-wcag', 'best-practice']);

export const WcagLevelSchema = z.enum(['A', 'AA', 'AAA', 'Advisory']);

export const SnippetLanguageSchema = z.enum(['html', 'react', 'css']);

export const CodeSnippetSchema = z.object({
  language: SnippetLanguageSchema,
  title: z.string().min(1).max(100),
  code: z.string().min(1).max(5000),
  explanation: z.string().min(1).max(1000),
  isPrimary: z.boolean().optional(),
});

export const HumanImpactSchema = z.object({
  userGroup: z.string().min(1).max(100),
  consequence: z.string().min(1).max(500),
  severityNote: z.string().max(200).optional(),
});

export const VerificationStepSchema = z.object({
  method: z.enum(['keyboard', 'screen-reader', 'visual', 'rescan']),
  instruction: z.string().min(1).max(500),
  expectedResult: z.string().min(1).max(500),
});

export const RemediationGuidanceSchema = z.object({
  ruleId: z.string().min(1),
  title: z.string().min(1).max(200),
  classification: RuleClassificationSchema,
  wcagCriterion: z.string().max(100).optional(),
  wcagLevel: WcagLevelSchema.optional(),
  whyItMatters: z.string().min(1).max(1500),
  humanImpacts: z.array(HumanImpactSchema),
  rootCauseAnalysis: z.string().min(1).max(1500),
  badExample: z.object({
    snippet: z.string().min(1).max(2000),
    reason: z.string().min(1).max(1000),
  }),
  goodExamples: z.array(CodeSnippetSchema).min(1),
  potentialPitfalls: z.array(z.string().max(500)),
  verificationSteps: z.array(VerificationStepSchema).min(1),
  officialDocUrl: z.string().url().optional(),
  isCustomFallback: z.boolean().optional(),
});

export const StoredRemediationRecordSchema = z.object({
  fingerprint: z.string().min(1).max(500),
  status: RemediationStatusSchema,
  updatedAt: z.string().datetime(),
  attemptedAt: z.string().datetime().optional(),
  verifiedAtScanId: z.string().uuid().optional(),
  previouslyVerifiedAtScanId: z.string().uuid().optional(),
  regressionDetectedAt: z.string().datetime().optional(),
  isRegression: z.boolean().optional(),
  notes: z.string().max(500).optional(),
});

export const RemediationStoragePayloadSchema = z.record(
  z.string(),
  StoredRemediationRecordSchema
);

export const ScanVerificationOutcomeTypeSchema = z.enum([
  'confirmed-resolved',
  'still-present',
  'newly-introduced',
  'uncertain-match',
  'failed-scan',
  'cancelled-scan',
  'incomplete-scan',
  'incomparable-scan',
]);

export const ScanVerificationResultSchema = z.object({
  fingerprint: z.string().min(1).max(500),
  outcome: ScanVerificationOutcomeTypeSchema,
  scanId: z.string().uuid().optional(),
  reason: z.string().max(500).optional(),
});

// ============================================================================
// Phase 8: Report Domain & Export Schemas
// ============================================================================

export const UrlRedactionLevelSchema = z.enum(['full', 'path-only', 'hostname-only']);

export const ExportReportOptionsSchema = z
  .object({
    format: z.enum(['json', 'html']),
    includeHtmlExcerpts: z.boolean(),
    urlRedactionLevel: UrlRedactionLevelSchema,
    includeRemediationGuidance: z.boolean().optional(),
    redactUrlQueryParameters: z.boolean().optional(),
    reportId: z.string().optional(),
    exportedAt: z.string().datetime().optional(),
  })
  .strict();

export const ReportMetadataSchema = z
  .object({
    reportId: z.string().min(1),
    tool: z.literal('Phantom Audit'),
    toolVersion: z.string().min(1),
    schemaVersion: z.literal(1),
    version: z.literal('1.0.0'),
    exportedAt: z.string().datetime(),
    environment: z
      .object({
        browserName: z.enum(['chrome', 'edge', 'unknown']),
        axeVersion: z.string().min(1),
      })
      .strict(),
    optionsApplied: ExportReportOptionsSchema.optional(),
  })
  .strict();

export const ReportTargetSchema = z
  .object({
    scanId: z.string().min(1),
    url: z.string(),
    hostname: z.string(),
    pageTitle: z.string(),
    scannedAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
  })
  .strict();

export const RoomSummarySchema = z
  .object({
    totalFindings: z.number().int().nonnegative(),
    criticalCount: z.number().int().nonnegative(),
    seriousCount: z.number().int().nonnegative(),
    moderateCount: z.number().int().nonnegative(),
    minorCount: z.number().int().nonnegative(),
  })
  .strict();

export const ReportSummarySchema = z
  .object({
    totalFindings: z.number().int().nonnegative(),
    criticalCount: z.number().int().nonnegative(),
    seriousCount: z.number().int().nonnegative(),
    moderateCount: z.number().int().nonnegative(),
    minorCount: z.number().int().nonnegative(),
    passesCount: z.number().int().nonnegative(),
    incompleteChecksCount: z.number().int().nonnegative(),
    inapplicableCount: z.number().int().nonnegative(),
    roomsSummary: z.record(RoomIdSchema, RoomSummarySchema),
  })
  .strict();

export const ExportedFindingNodeSchema = z
  .object({
    target: z.array(z.string()),
    htmlExcerpt: z.string().max(1000).optional(),
    failureSummary: z.string(),
  })
  .strict();

export const ExportedFindingRemediationSchema = z
  .object({
    summary: z.string(),
    suggestedSnippet: z.string().optional(),
    verificationMethod: z.string().optional(),
    status: RemediationStatusSchema.optional(),
    notes: z.string().max(500).optional(),
  })
  .strict();

export const ExportedFindingSchema = z
  .object({
    fingerprint: z.string().min(1),
    ruleId: z.string().min(1),
    impact: ImpactSchema,
    roomId: RoomIdSchema,
    roomName: z.string().min(1),
    description: z.string(),
    help: z.string(),
    helpUrl: z.string().url().optional().or(z.literal('')),
    wcagTags: z.array(z.string()),
    ruleClassification: RuleClassificationSchema,
    affectedNodeCount: z.number().int().nonnegative(),
    nodes: z.array(ExportedFindingNodeSchema),
    reviewed: z.boolean().default(false),
    comparisonCategory: ComparisonCategorySchema.optional(),
    uncertainReason: z.string().optional(),
    remediationRecommendation: ExportedFindingRemediationSchema.optional(),
  })
  .strict();

export const ReportExportPayloadSchema = z
  .object({
    reportMetadata: ReportMetadataSchema,
    target: ReportTargetSchema,
    summary: ReportSummarySchema,
    findings: z.array(ExportedFindingSchema),
    limitations: z.string().min(1),
    manualReviewChecklist: z.array(z.string()),
  })
  .strict();
