/**
 * Phantom Audit — axe-core Scanner Configuration
 *
 * Defines the standard WCAG 2.2 ruleset, execution timeouts,
 * and payload constraints for local in-page scanning.
 */

export const SCANNER_CONFIG = {
  /** Pinned axe-core release bundled locally */
  AXE_VERSION: '4.14.0',

  /**
   * Pinned WCAG standard rule tags for automated auditing.
   * Covers WCAG 2.0, 2.1, 2.2 Level A/AA plus standard best practices.
   */
  RULE_TAGS: [
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
    'wcag22aa',
    'best-practice',
  ] as const,

  /**
   * Strict scan execution timeout in milliseconds (15 seconds).
   * Prevents runaway execution on massive or malformed DOM trees.
   */
  SCAN_TIMEOUT_MS: 15_000,

  /** Maximum DOM nodes captured per violation to avoid unbounded IPC payloads */
  MAX_NODES_PER_RULE: 20,

  /** Maximum character length of HTML excerpts to prevent memory bloat and XSS */
  MAX_HTML_EXCERPT_LENGTH: 500,

  /** Maximum character length for failure summaries */
  MAX_FAILURE_SUMMARY_LENGTH: 1000,
} as const;

export type ScannerRuleTag = (typeof SCANNER_CONFIG.RULE_TAGS)[number];
