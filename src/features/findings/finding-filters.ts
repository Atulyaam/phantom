/**
 * Phantom Audit — Finding Filters & Multi-Dimensional Sorter
 *
 * Provides pure, non-destructive filtering and sorting over FindingRecord arrays.
 */

import type { FindingRecord, Impact } from '@/domain/finding';
import type { RoomId } from '@/domain/room';

export type ConformanceFilter = 'all' | 'wcag' | 'advisory';
export type ReviewStatusFilter = 'all' | 'reviewed' | 'unreviewed';
export type FindingSortBy = 'severity-desc' | 'severity-asc' | 'rule-asc' | 'nodes-desc';

export interface FindingFilterOptions {
  query?: string;
  impacts?: Impact[];
  room?: RoomId | 'all';
  conformance?: ConformanceFilter;
  reviewStatus?: ReviewStatusFilter;
  sortBy?: FindingSortBy;
}

const IMPACT_SEVERITY_WEIGHT: Record<Impact, number> = {
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1,
  unknown: 0,
};

/**
 * Evaluates whether a finding is strictly advisory best practice vs. WCAG conformance requirement.
 */
export function isAdvisoryFinding(finding: FindingRecord): boolean {
  const tags = finding.wcagTags || [];
  const hasWcagTag = tags.some((t) => t.toLowerCase().startsWith('wcag'));
  const isBestPractice = tags.some((t) => t.toLowerCase() === 'best-practice');
  return isBestPractice && !hasWcagTag;
}

/**
 * Checks whether a finding matches a case-insensitive search query across its metadata and nodes.
 */
export function matchesSearchQuery(finding: FindingRecord, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;

  if (finding.ruleId.toLowerCase().includes(query)) return true;
  if (finding.help.toLowerCase().includes(query)) return true;
  if (finding.description.toLowerCase().includes(query)) return true;
  if (finding.fingerprint.toLowerCase().includes(query)) return true;

  // Search inside nodes (targets and failure summaries)
  for (const node of finding.nodes || []) {
    if (node.failureSummary && node.failureSummary.toLowerCase().includes(query)) {
      return true;
    }
    for (const target of node.target || []) {
      if (target.toLowerCase().includes(query)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Filters and sorts finding records non-destructively according to provided options.
 */
export function filterAndSortFindings(
  findings: FindingRecord[],
  options: FindingFilterOptions = {}
): FindingRecord[] {
  const {
    query = '',
    impacts,
    room = 'all',
    conformance = 'all',
    reviewStatus = 'all',
    sortBy = 'severity-desc',
  } = options;

  const impactSet = impacts && impacts.length > 0 ? new Set(impacts) : null;

  // 1. Filter
  const filtered = (findings || []).filter((finding) => {
    // Room filter
    if (room !== 'all' && finding.roomId !== room) {
      return false;
    }

    // Impact filter
    if (impactSet && !impactSet.has(finding.impact)) {
      return false;
    }

    // Conformance filter
    if (conformance !== 'all') {
      const isAdvisory = isAdvisoryFinding(finding);
      if (conformance === 'advisory' && !isAdvisory) return false;
      if (conformance === 'wcag' && isAdvisory) return false;
    }

    // Review status filter
    if (reviewStatus !== 'all') {
      if (reviewStatus === 'reviewed' && !finding.reviewed) return false;
      if (reviewStatus === 'unreviewed' && finding.reviewed) return false;
    }

    // Text query search
    if (query && !matchesSearchQuery(finding, query)) {
      return false;
    }

    return true;
  });

  // 2. Sort (create a shallow copy so original array is untouched)
  return [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'severity-desc': {
        const diff =
          (IMPACT_SEVERITY_WEIGHT[b.impact] ?? 0) -
          (IMPACT_SEVERITY_WEIGHT[a.impact] ?? 0);
        if (diff !== 0) return diff;
        return a.ruleId.localeCompare(b.ruleId);
      }
      case 'severity-asc': {
        const diff =
          (IMPACT_SEVERITY_WEIGHT[a.impact] ?? 0) -
          (IMPACT_SEVERITY_WEIGHT[b.impact] ?? 0);
        if (diff !== 0) return diff;
        return a.ruleId.localeCompare(b.ruleId);
      }
      case 'rule-asc': {
        const diff = a.ruleId.localeCompare(b.ruleId);
        if (diff !== 0) return diff;
        return (
          (IMPACT_SEVERITY_WEIGHT[b.impact] ?? 0) -
          (IMPACT_SEVERITY_WEIGHT[a.impact] ?? 0)
        );
      }
      case 'nodes-desc': {
        const aNodes = a.affectedNodeCount || a.nodes?.length || 0;
        const bNodes = b.affectedNodeCount || b.nodes?.length || 0;
        const diff = bNodes - aNodes;
        if (diff !== 0) return diff;
        return (
          (IMPACT_SEVERITY_WEIGHT[b.impact] ?? 0) -
          (IMPACT_SEVERITY_WEIGHT[a.impact] ?? 0)
        );
      }
      default:
        return 0;
    }
  });
}
