/**
 * Deterministic Finding Fingerprint Generator (v1)
 *
 * Produces stable, normalized, versioned identifiers for accessibility findings
 * across rescans of dynamic and mutating DOM trees.
 */

/**
 * Canonicalizes a single CSS element segment by sorting intra-element class chains
 * and standardizing attribute selector quoting.
 *
 * Example: 'button.btn-primary.btn' -> 'button.btn.btn-primary'
 * Example: '[data-role=\'tab\']' -> '[data-role="tab"]'
 */
export function canonicalizeSelectorSegment(segment: string): string {
  let cleaned = segment.trim();

  // Normalize attribute quotes to double quotes: [attr='val'] or [attr=val] -> [attr="val"]
  cleaned = cleaned.replace(
    /\[\s*([\w-]+)\s*=\s*['"]?([^'"\]]+)['"]?\s*\]/g,
    '[$1="$2"]'
  );

  // Canonicalize intra-element class order: e.g., 'button.btn-primary.btn' -> 'button.btn.btn-primary'
  // We only reorder simple class sequences without pseudo-classes or attributes
  if (cleaned.includes('.') && !cleaned.includes('[') && !cleaned.includes(':')) {
    const parts = cleaned.split('.');
    const element = parts[0]; // e.g. 'button' or ''
    const classes = parts.slice(1).filter(Boolean).sort();
    return element ? `${element}.${classes.join('.')}` : `.${classes.join('.')}`;
  }

  return cleaned;
}

/**
 * Normalizes CSS selector strings or tuple arrays into a canonical selector format.
 * - Collapses redundant whitespace
 * - Standardizes combinators: ' > ', ' + ', ' ~ '
 * - Canonicalizes intra-element class ordering
 * - Standardizes attribute quoting
 * - Joins iframe / shadow-root tuples with ' >>> '
 */
export function normalizeSelector(selector: string | string[]): string {
  if (Array.isArray(selector)) {
    return selector
      .map((part) => normalizeSelector(String(part)))
      .filter(Boolean)
      .join(' >>> ');
  }

  if (typeof selector !== 'string') {
    return '';
  }

  const shadowPlaceholder = '___SHADOW_PIERCE___';
  const withShadowPreserved = selector
    .trim()
    .replace(/\s*>>>\s*/g, ` ${shadowPlaceholder} `);

  const trimmed = withShadowPreserved
    .replace(/\s+/g, ' ')
    .replace(/\s*>\s*/g, ' > ')
    .replace(/\s*\+\s*/g, ' + ')
    .replace(/\s*~\s*/g, ' ~ ');

  // Split by whitespace combinator and canonicalize each segment
  const segments = trimmed.split(' ');
  const normalizedSegments = segments.map((seg) => {
    if (seg === '>' || seg === '+' || seg === '~') {
      return seg;
    }
    if (seg === shadowPlaceholder) {
      return '>>>';
    }
    return canonicalizeSelectorSegment(seg);
  });

  return normalizedSegments.join(' ');
}

/**
 * Generates a stable canonical fingerprint string for a finding.
 * Format: v1:{cleanRuleId}:{sortedUniqueNormalizedTargets}
 */
export function generateFindingFingerprint(
  ruleId: string,
  targets: Array<string | string[]>
): string {
  const cleanRule = (ruleId || 'unknown').trim().toLowerCase();

  // Normalize, filter empty strings, and deduplicate targets
  const uniqueNormalizedTargets = Array.from(
    new Set(
      (targets || []).map(normalizeSelector).filter((t) => Boolean(t) && t.length > 0)
    )
  ).sort();

  const targetPayload =
    uniqueNormalizedTargets.length > 0 ? uniqueNormalizedTargets.join('|') : cleanRule;

  return `v1:${cleanRule}:${targetPayload}`;
}

export interface ParsedFingerprint {
  version: string;
  ruleId: string;
  targets: string[];
}

/**
 * Parses a canonical fingerprint into its constituent components.
 */
export function parseFingerprint(fingerprint: string): ParsedFingerprint | null {
  if (!fingerprint || typeof fingerprint !== 'string') return null;

  const parts = fingerprint.split(':');
  if (parts.length < 3 || parts[0] !== 'v1') return null;

  const version = parts[0];
  const ruleId = parts[1];
  if (!version || !ruleId) return null;
  const targetsRaw = parts.slice(2).join(':'); // In case a target contained a colon
  const targets = targetsRaw ? targetsRaw.split('|') : [];

  return {
    version,
    ruleId,
    targets,
  };
}

/**
 * Compares two fingerprints for canonical equality.
 */
export function areFingerprintsEqual(fpA: string, fpB: string): boolean {
  if (fpA === fpB) return true;
  const parsedA = parseFingerprint(fpA);
  const parsedB = parseFingerprint(fpB);
  if (!parsedA || !parsedB) return false;
  if (parsedA.version !== parsedB.version || parsedA.ruleId !== parsedB.ruleId) {
    return false;
  }
  if (parsedA.targets.length !== parsedB.targets.length) return false;
  return parsedA.targets.every((t, i) => t === parsedB.targets[i]);
}
