import type { RoomId } from './room';

export type Impact = 'critical' | 'serious' | 'moderate' | 'minor' | 'unknown';

export type WcagPrinciple =
  'perceivable' | 'operable' | 'understandable' | 'robust' | 'best-practice';

export interface FindingNode {
  target: string[];
  htmlExcerpt: string; // sanitized and length-limited
  failureSummary: string;
}

export interface FindingRecord {
  fingerprint: string;
  ruleId: string;
  impact: Impact;
  description: string;
  help: string;
  helpUrl?: string;
  wcagTags: string[];
  roomId: RoomId;
  affectedNodeCount: number;
  nodes: FindingNode[];
  firstSeenAt: string; // ISO-8601
  reviewed: boolean;
  comparisonCategory?: ComparisonCategory;
  uncertainReason?: string;
}

export type ComparisonCategory =
  'verified-fix' | 'disappeared' | 'unchanged' | 'new' | 'uncertain';

export interface UncertainFindingMatch {
  baselineFinding: FindingRecord;
  candidateRescanFinding: FindingRecord;
  confidence: 'high' | 'medium';
  reason: string;
}
