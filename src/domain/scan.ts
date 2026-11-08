import type { FindingRecord } from './finding';

export type ScanStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ScanRecord {
  id: string;
  schemaVersion: 1;
  tabUrl: string;
  pageTitle: string;
  hostname: string;
  scannedAt: string; // ISO-8601 timestamp
  completedAt?: string;
  axeVersion: string;
  extensionVersion: string;
  browserName: 'chrome' | 'edge' | 'unknown';
  status: ScanStatus;
  findings: FindingRecord[];
  incompleteChecksCount: number;
  passesCount: number;
  inapplicableCount: number;
  errorCode?: string;
}

/**
 * Lightweight summary of a scan snapshot for efficient history listing.
 * Contains only metadata and aggregate violation counts without full DOM nodes.
 */
export interface ScanSummary {
  id: string;
  schemaVersion: 1;
  tabUrl: string; // sanitized URL
  pageTitle: string;
  hostname: string;
  scannedAt: string; // ISO-8601 timestamp
  completedAt?: string;
  status: ScanStatus;
  totalFindings: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  passesCount: number;
  incompleteChecksCount: number;
}
