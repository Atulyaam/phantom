/**
 * Phantom Audit — In-Page axe-core Scan Runner
 *
 * This function is serialized and executed inside the target tab's
 * ISOLATED execution world via chrome.scripting.executeScript.
 * It MUST remain completely self-contained with zero outside closure references.
 */

export interface InPageScanOptions {
  tags: string[];
  maxNodesPerRule: number;
  maxHtmlExcerptLength: number;
}

export interface InPageNodeResult {
  target: string[];
  html: string;
  failureSummary: string;
}

export interface InPageRuleResult {
  id: string;
  description: string;
  help: string;
  helpUrl?: string;
  impact?: 'minor' | 'moderate' | 'serious' | 'critical' | null;
  tags: string[];
  nodes: InPageNodeResult[];
  totalNodeCount: number;
}

export interface InPageScanOutput {
  violations: InPageRuleResult[];
  incomplete: InPageRuleResult[];
  passesCount: number;
  incompleteCount: number;
  inapplicableCount: number;
  pageTitle: string;
  url: string;
  axeVersion: string;
}

interface AxeRawRule {
  id?: string;
  description?: string;
  help?: string;
  helpUrl?: string;
  impact?: 'minor' | 'moderate' | 'serious' | 'critical' | null;
  tags?: string[];
  nodes?: Array<{
    target?: unknown;
    html?: string;
    failureSummary?: string;
  }>;
}

interface AxeRawRunResult {
  violations?: AxeRawRule[];
  incomplete?: AxeRawRule[];
  passes?: unknown[];
  inapplicable?: unknown[];
}

/**
 * Self-contained in-page execution function injected by chrome.scripting.
 */
export async function runInPageAxeScan(
  options: InPageScanOptions
): Promise<InPageScanOutput> {
  // 1. Verify axe-core availability in the isolated world
  const axeObj = (
    window as unknown as {
      axe?: {
        run: (element: Document, opts: unknown) => Promise<AxeRawRunResult>;
        version: string;
      };
    }
  ).axe;
  if (!axeObj || typeof axeObj.run !== 'function') {
    throw new Error('axe-core is not loaded in the target tab execution context.');
  }

  // 2. Execute axe.run against current page DOM
  const rawResults = await axeObj.run(document, {
    runOnly: {
      type: 'tag',
      values: options.tags,
    },
    resultTypes: ['violations', 'incomplete', 'passes', 'inapplicable'],
  });

  // Helper to safely truncate and sanitize excerpts
  const sanitizeExcerpt = (rawHtml: string): string => {
    if (!rawHtml) return '';
    let cleaned = rawHtml.trim();

    // Redact form input value attributes
    cleaned = cleaned.replace(/\s+value=(["']).*?\1/gi, ' value="[REDACTED]"');
    cleaned = cleaned.replace(/\s+value=([^\s>]+)/gi, ' value="[REDACTED]"');

    // Redact sensitive data attributes
    cleaned = cleaned.replace(
      /\s+data-(?:token|secret|auth|key|password)=(["']).*?\1/gi,
      ' data-token="[REDACTED]"'
    );

    // If input type is password, ensure value is removed
    if (/type=(["'])password\1/i.test(cleaned)) {
      cleaned = cleaned.replace(/value="\[REDACTED\]"/gi, 'value="[PASSWORD_REDACTED]"');
    }

    if (cleaned.length <= options.maxHtmlExcerptLength) {
      return cleaned;
    }
    return cleaned.slice(0, options.maxHtmlExcerptLength) + '...';
  };

  // Helper to map and prune node results
  const mapNodes = (nodes?: AxeRawRule['nodes']): InPageNodeResult[] => {
    return (nodes || []).slice(0, options.maxNodesPerRule).map((node) => {
      // Normalize target selector array
      let targetList: string[] = [];
      if (Array.isArray(node.target)) {
        targetList = node.target.map((t) => (Array.isArray(t) ? t.join(' ') : String(t)));
      } else if (typeof node.target === 'string') {
        targetList = [node.target];
      }

      return {
        target: targetList,
        html: sanitizeExcerpt(node.html || ''),
        failureSummary: node.failureSummary || '',
      };
    });
  };

  // Map violations
  const violations: InPageRuleResult[] = (rawResults.violations || []).map(
    (v: AxeRawRule) => ({
      id: String(v.id || 'unknown'),
      description: String(v.description || ''),
      help: String(v.help || ''),
      helpUrl: typeof v.helpUrl === 'string' ? v.helpUrl : undefined,
      impact: v.impact || 'minor',
      tags: Array.isArray(v.tags) ? v.tags.map(String) : [],
      nodes: mapNodes(v.nodes),
      totalNodeCount: Array.isArray(v.nodes) ? v.nodes.length : 0,
    })
  );

  // Map incomplete items (manual reviews)
  const incomplete: InPageRuleResult[] = (rawResults.incomplete || []).map(
    (v: AxeRawRule) => ({
      id: String(v.id || 'unknown'),
      description: String(v.description || ''),
      help: String(v.help || ''),
      helpUrl: typeof v.helpUrl === 'string' ? v.helpUrl : undefined,
      impact: v.impact || 'minor',
      tags: Array.isArray(v.tags) ? v.tags.map(String) : [],
      nodes: mapNodes(v.nodes),
      totalNodeCount: Array.isArray(v.nodes) ? v.nodes.length : 0,
    })
  );

  return {
    violations,
    incomplete,
    passesCount: Array.isArray(rawResults.passes) ? rawResults.passes.length : 0,
    incompleteCount: Array.isArray(rawResults.incomplete)
      ? rawResults.incomplete.length
      : 0,
    inapplicableCount: Array.isArray(rawResults.inapplicable)
      ? rawResults.inapplicable.length
      : 0,
    pageTitle: document.title || 'Untitled Page',
    url: window.location.href,
    axeVersion: axeObj.version || '4.14.0',
  };
}
