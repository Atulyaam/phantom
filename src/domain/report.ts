import type {
  ComparisonCategory,
  FindingRecord,
  Impact,
  UncertainFindingMatch,
} from './finding';
import type { RoomId } from './room';
import type { RemediationStatus, RuleClassification } from './remediation';

export interface ScanComparisonMetrics {
  baselineTotal: number;
  rescanTotal: number;
  resolvedCount: number; // total absent: verifiedResolvedCount + disappearedCount
  verifiedResolvedCount?: number;
  disappearedCount?: number;
  unchangedCount: number;
  newCount: number;
  uncertainCount: number;
  netProgress: number; // resolvedCount - newCount (backward-compatible)
  verifiedNetProgress?: number; // verifiedResolvedCount - newCount (strict verification progress)
  improvementScore: number; // 0 to 100 percentage based on resolvedCount
  verifiedImprovementScore?: number; // 0 to 100 percentage based strictly on verifiedResolvedCount
}

export interface ScanComparison {
  fromScanId: string;
  toScanId: string;
  generatedAt: string;
  isComparable: boolean;
  incomparableReason?: string;
  verifiedResolved: FindingRecord[]; // Confirmed resolved with authoritative Phase 6 verification evidence
  disappeared: FindingRecord[]; // Absent from target scan without formal verification evidence
  resolved: FindingRecord[]; // Backward-compatible alias: [...verifiedResolved, ...disappeared]
  unchanged: FindingRecord[];
  newFindings: FindingRecord[];
  uncertainMatches?: UncertainFindingMatch[];
  metrics?: ScanComparisonMetrics;
}

export type UrlRedactionLevel = 'full' | 'path-only' | 'hostname-only';

export interface ExportReportOptions {
  format: 'json' | 'html';
  includeHtmlExcerpts: boolean;
  urlRedactionLevel: UrlRedactionLevel;
  includeRemediationGuidance?: boolean;
  redactUrlQueryParameters?: boolean; // Backward-compatible alias for urlRedactionLevel !== 'full'
  reportId?: string; // Optional controlled report ID for deterministic/testing workflows
  exportedAt?: string; // Optional controlled ISO-8601 timestamp for deterministic/testing workflows
}

export interface ReportMetadata {
  reportId: string;
  tool: 'Phantom Audit';
  toolVersion: string;
  /**
   * Numeric schema version for automated migration and schema evolution pipelines.
   * Increments monotonically (1, 2, 3...) upon breaking structural changes.
   */
  schemaVersion: 1;
  /**
   * Published Semantic Version of the Phantom Audit export specification (MAJOR.MINOR.PATCH).
   */
  version: '1.0.0';
  exportedAt: string; // ISO-8601 UTC timestamp
  environment: {
    browserName: 'chrome' | 'edge' | 'unknown';
    axeVersion: string;
  };
  optionsApplied?: ExportReportOptions;
}

export interface ReportTarget {
  scanId: string;
  url: string; // Guaranteed sanitized (credentials/tokens purged)
  hostname: string;
  pageTitle: string;
  scannedAt: string;
  completedAt?: string;
}

export interface RoomSummary {
  totalFindings: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
}

export interface ReportSummary {
  totalFindings: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  passesCount: number;
  incompleteChecksCount: number;
  inapplicableCount: number;
  roomsSummary: Record<RoomId, RoomSummary>;
}

export interface ExportedFindingNode {
  target: string[];
  htmlExcerpt?: string;
  failureSummary: string;
}

export interface ExportedFindingRemediation {
  summary: string;
  suggestedSnippet?: string;
  verificationMethod?: string;
  status?: RemediationStatus;
  notes?: string;
}

export interface ExportedFinding {
  fingerprint: string;
  ruleId: string;
  impact: Impact;
  roomId: RoomId;
  roomName: string;
  description: string;
  help: string;
  helpUrl?: string;
  wcagTags: string[];
  ruleClassification: RuleClassification;
  affectedNodeCount: number;
  nodes: ExportedFindingNode[];
  reviewed: boolean;
  comparisonCategory?: ComparisonCategory;
  uncertainReason?: string;
  remediationRecommendation?: ExportedFindingRemediation;
}

export interface ReportExportPayload {
  reportMetadata: ReportMetadata;
  target: ReportTarget;
  summary: ReportSummary;
  findings: ExportedFinding[];
  limitations: string;
  manualReviewChecklist: string[];
}
