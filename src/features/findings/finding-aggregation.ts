/**
 * Phantom Audit — Finding Aggregation Engine
 *
 * Provides non-destructive, multi-dimensional aggregation, grouping,
 * and statistical summaries across findings without mutating source data.
 */

import type { FindingRecord, Impact, WcagPrinciple } from '@/domain/finding';
import type { RoomId } from '@/domain/room';

export const ALL_ROOM_IDS: RoomId[] = [
  'name-chamber',
  'contrast-crypt',
  'portrait-gallery',
  'form-cellar',
  'structure-hall',
  'focus-corridor',
  'other',
];

export const ALL_IMPACTS: Impact[] = [
  'critical',
  'serious',
  'moderate',
  'minor',
  'unknown',
];

export const ALL_PRINCIPLES: WcagPrinciple[] = [
  'perceivable',
  'operable',
  'understandable',
  'robust',
  'best-practice',
];

/**
 * Maps an axe-core rule and its tags to one of the four WCAG principles (POUR)
 * or classifies it as an Advisory Best Practice.
 */
export function mapRuleToPrinciple(ruleId: string, wcagTags: string[]): WcagPrinciple {
  const cleanRule = (ruleId || '').trim().toLowerCase();

  // 1. If rule has only best-practice tag and no wcag conformance tags, categorize as best-practice
  const hasWcagTag = (wcagTags || []).some((t) => t.startsWith('wcag'));
  const isBestPractice = (wcagTags || []).includes('best-practice');

  if (isBestPractice && !hasWcagTag) {
    return 'best-practice';
  }

  // 2. Specific rule-to-principle mapping based on WCAG 2.2 criteria
  // Principle 1: Perceivable (Sensory information, alternatives, contrast)
  const perceivableRules = new Set([
    'color-contrast',
    'image-alt',
    'image-redundant-alt',
    'svg-img-alt',
    'input-image-alt',
    'link-in-text-block',
    'video-caption',
    'audio-caption',
    'meta-viewport',
  ]);
  if (perceivableRules.has(cleanRule)) return 'perceivable';

  // Principle 2: Operable (Keyboard, navigation, headings, focus)
  const operableRules = new Set([
    'tabindex',
    'focus-order-semantics',
    'bypass',
    'skip-link',
    'region',
    'heading-order',
    'landmark-one-main',
    'page-has-heading-one',
    'scrollable-region-focusable',
    'accesskeys',
    'target-size',
    'nested-interactive',
  ]);
  if (operableRules.has(cleanRule)) return 'operable';

  // Principle 3: Understandable (Accessible names, forms, labels, language)
  const understandableRules = new Set([
    'button-name',
    'link-name',
    'label',
    'select-name',
    'autocomplete-valid',
    'html-has-lang',
    'html-lang-valid',
    'input-button-name',
    'form-field-multiple-labels',
  ]);
  if (understandableRules.has(cleanRule)) return 'understandable';

  // Principle 4: Robust (ARIA specifications, markup, parsing)
  const robustRules = new Set([
    'aria-hidden-body',
    'aria-hidden-focus',
    'aria-roles',
    'aria-valid-attr',
    'aria-valid-attr-value',
    'aria-required-attr',
    'aria-required-children',
    'aria-required-parent',
    'duplicate-id-active',
    'duplicate-id',
  ]);
  if (robustRules.has(cleanRule)) return 'robust';

  // Fallback by WCAG tag prefix if present (e.g. wcag1xx -> Perceivable, wcag2xx -> Operable, etc.)
  for (const tag of wcagTags || []) {
    if (tag.startsWith('wcag1')) return 'perceivable';
    if (tag.startsWith('wcag2')) return 'operable';
    if (tag.startsWith('wcag3')) return 'understandable';
    if (tag.startsWith('wcag4')) return 'robust';
  }

  return isBestPractice ? 'best-practice' : 'understandable';
}

/**
 * Groups findings non-destructively by Mansion Room ID.
 */
export function groupByRoom(findings: FindingRecord[]): Record<RoomId, FindingRecord[]> {
  const groups: Record<RoomId, FindingRecord[]> = {
    'name-chamber': [],
    'contrast-crypt': [],
    'portrait-gallery': [],
    'form-cellar': [],
    'structure-hall': [],
    'focus-corridor': [],
    other: [],
  };

  for (const finding of findings || []) {
    const room = groups[finding.roomId] ? finding.roomId : 'other';
    groups[room].push(finding);
  }

  return groups;
}

/**
 * Groups findings non-destructively by Severity Impact.
 */
export function groupBySeverity(
  findings: FindingRecord[]
): Record<Impact, FindingRecord[]> {
  const groups: Record<Impact, FindingRecord[]> = {
    critical: [],
    serious: [],
    moderate: [],
    minor: [],
    unknown: [],
  };

  for (const finding of findings || []) {
    const impact = groups[finding.impact] ? finding.impact : 'unknown';
    groups[impact].push(finding);
  }

  return groups;
}

/**
 * Groups findings non-destructively by WCAG Principle (POUR).
 */
export function groupByPrinciple(
  findings: FindingRecord[]
): Record<WcagPrinciple, FindingRecord[]> {
  const groups: Record<WcagPrinciple, FindingRecord[]> = {
    perceivable: [],
    operable: [],
    understandable: [],
    robust: [],
    'best-practice': [],
  };

  for (const finding of findings || []) {
    const principle = mapRuleToPrinciple(finding.ruleId, finding.wcagTags);
    groups[principle].push(finding);
  }

  return groups;
}

/**
 * Groups findings non-destructively by Review Status.
 */
export function groupByReviewStatus(findings: FindingRecord[]): {
  reviewed: FindingRecord[];
  unreviewed: FindingRecord[];
} {
  const reviewed: FindingRecord[] = [];
  const unreviewed: FindingRecord[] = [];

  for (const finding of findings || []) {
    if (finding.reviewed) {
      reviewed.push(finding);
    } else {
      unreviewed.push(finding);
    }
  }

  return { reviewed, unreviewed };
}

export interface FindingSummaryStats {
  totalFindings: number;
  totalAffectedNodes: number;
  byRoom: Record<RoomId, number>;
  byImpact: Record<Impact, number>;
  byPrinciple: Record<WcagPrinciple, number>;
  reviewedCount: number;
  unreviewedCount: number;
  advisoryCount: number;
  conformanceCount: number;
}

/**
 * Computes comprehensive statistical aggregations across an array of findings.
 */
export function computeFindingSummaryStats(
  findings: FindingRecord[]
): FindingSummaryStats {
  const roomGroups = groupByRoom(findings);
  const impactGroups = groupBySeverity(findings);
  const principleGroups = groupByPrinciple(findings);
  const { reviewed, unreviewed } = groupByReviewStatus(findings);

  let totalNodes = 0;
  let advisoryCount = 0;
  let conformanceCount = 0;

  for (const f of findings || []) {
    totalNodes += f.affectedNodeCount || f.nodes?.length || 0;
    const isAdvisory =
      f.wcagTags.includes('best-practice') &&
      !f.wcagTags.some((t) => t.startsWith('wcag'));
    if (isAdvisory) {
      advisoryCount++;
    } else {
      conformanceCount++;
    }
  }

  const byRoom: Record<RoomId, number> = {
    'name-chamber': roomGroups['name-chamber'].length,
    'contrast-crypt': roomGroups['contrast-crypt'].length,
    'portrait-gallery': roomGroups['portrait-gallery'].length,
    'form-cellar': roomGroups['form-cellar'].length,
    'structure-hall': roomGroups['structure-hall'].length,
    'focus-corridor': roomGroups['focus-corridor'].length,
    other: roomGroups.other.length,
  };

  const byImpact: Record<Impact, number> = {
    critical: impactGroups.critical.length,
    serious: impactGroups.serious.length,
    moderate: impactGroups.moderate.length,
    minor: impactGroups.minor.length,
    unknown: impactGroups.unknown.length,
  };

  const byPrinciple: Record<WcagPrinciple, number> = {
    perceivable: principleGroups.perceivable.length,
    operable: principleGroups.operable.length,
    understandable: principleGroups.understandable.length,
    robust: principleGroups.robust.length,
    'best-practice': principleGroups['best-practice'].length,
  };

  return {
    totalFindings: (findings || []).length,
    totalAffectedNodes: totalNodes,
    byRoom,
    byImpact,
    byPrinciple,
    reviewedCount: reviewed.length,
    unreviewedCount: unreviewed.length,
    advisoryCount,
    conformanceCount,
  };
}
