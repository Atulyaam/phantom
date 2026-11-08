/**
 * Phantom Audit — Remediation Domain Models
 *
 * Defines strongly typed models for accessibility remediation guidance,
 * code snippets, human impact assessments, verification steps,
 * and persisted remediation lifecycle records.
 */

export type RemediationStatus = 'suggested' | 'attempted' | 'verified' | 'unresolved';

export type RuleClassification = 'normative-wcag' | 'best-practice';

export type WcagLevel = 'A' | 'AA' | 'AAA' | 'Advisory';

export type SnippetLanguage = 'html' | 'react' | 'css';

export interface CodeSnippet {
  language: SnippetLanguage;
  title: string;
  code: string;
  explanation: string;
  isPrimary?: boolean;
}

export interface HumanImpact {
  userGroup: string;
  consequence: string;
  severityNote?: string;
}

export interface VerificationStep {
  method: 'keyboard' | 'screen-reader' | 'visual' | 'rescan';
  instruction: string;
  expectedResult: string;
}

export interface RemediationGuidance {
  ruleId: string;
  title: string;
  classification: RuleClassification;
  wcagCriterion?: string;
  wcagLevel?: WcagLevel;
  whyItMatters: string;
  humanImpacts: HumanImpact[];
  rootCauseAnalysis: string;
  badExample: {
    snippet: string;
    reason: string;
  };
  goodExamples: CodeSnippet[];
  potentialPitfalls: string[];
  verificationSteps: VerificationStep[];
  officialDocUrl?: string;
  isCustomFallback?: boolean;
}

export interface ExtractedElementContext {
  tagName: string;
  id?: string;
  className?: string;
  type?: string;
  placeholder?: string;
  ariaLabel?: string;
  textContent?: string;
  src?: string;
  href?: string;
}

export interface StoredRemediationRecord {
  fingerprint: string;
  status: RemediationStatus;
  updatedAt: string; // ISO-8601
  attemptedAt?: string; // ISO-8601
  verifiedAtScanId?: string;
  previouslyVerifiedAtScanId?: string;
  regressionDetectedAt?: string; // ISO-8601
  isRegression?: boolean;
  notes?: string;
}

export type RemediationStoragePayload = Record<string, StoredRemediationRecord>;

export type ScanVerificationOutcomeType =
  | 'confirmed-resolved'
  | 'still-present'
  | 'newly-introduced'
  | 'uncertain-match'
  | 'failed-scan'
  | 'cancelled-scan'
  | 'incomplete-scan'
  | 'incomparable-scan';

export interface ScanVerificationResult {
  fingerprint: string;
  outcome: ScanVerificationOutcomeType;
  scanId?: string;
  reason?: string;
}

export interface VerificationTransitionResult {
  fingerprint: string;
  previousStatus: RemediationStatus;
  newStatus: RemediationStatus;
  action: 'verified' | 'unresolved' | 'retained' | 'suggested';
  reason: string;
  updatedRecord?: StoredRemediationRecord;
}

export interface RescanVerificationSummary {
  comparable: boolean;
  incomparableReason?: string;
  scanId: string;
  baselineScanId?: string;
  totalEvaluated: number;
  newlyVerified: VerificationTransitionResult[];
  stillPresent: VerificationTransitionResult[];
  regressions: VerificationTransitionResult[];
  uncertainMatches: VerificationTransitionResult[];
  retained: VerificationTransitionResult[];
  skippedVerification?: {
    count: number;
    reason: string;
  };
  timestamp: string;
}
