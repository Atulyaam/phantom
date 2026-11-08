/**
 * Phantom Audit — Context-Aware Remediation Guidance Engine
 *
 * Synthesizes deterministic, safe, context-aware remediation recommendations
 * using bounded DOMParser token extraction and curated catalog templates.
 *
 * SECURITY INVARIANTS:
 * - Never executes parsed HTML
 * - Never inserts parsed HTML into dashboard DOM
 * - Never executes suggested code
 * - Never mutates target websites
 * - Never uses eval or new Function
 * - Never makes remote network requests
 * - Bounded input limits to prevent ReDoS / CPU stalls
 */

import type { FindingRecord } from '@/domain/finding';
import type {
  RemediationGuidance,
  CodeSnippet,
  ExtractedElementContext,
} from '@/domain/remediation';
import { getCatalogGuidance } from './remediation-catalog';

export type { ExtractedElementContext };

/**
 * Safely extracts only allowlisted element properties from a sanitized HTML excerpt.
 * Uses bounded length checking and a detached DOMParser fragment.
 */
export function extractAllowlistedContext(
  htmlExcerpt: string
): ExtractedElementContext | null {
  if (!htmlExcerpt || typeof htmlExcerpt !== 'string') return null;
  const trimmed = htmlExcerpt.trim();
  if (!trimmed) return null;

  // Defensive input-size ceiling: cap at 2000 chars to avoid memory/CPU spikes
  const boundedExcerpt = trimmed.slice(0, 2000);

  // 1. Primary: Use detached browser DOMParser if available
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(boundedExcerpt, 'text/html');
      const el = doc.body.firstElementChild;
      if (el) {
        const tagName = el.tagName.toLowerCase();
        const rawText = el.textContent || '';
        const cleanText = rawText.replace(/\s+/g, ' ').trim().slice(0, 100);

        const rawClass = el.getAttribute('class') || '';
        const cleanClass = rawClass
          .replace(/[^a-zA-Z0-9_\s-]/g, '')
          .trim()
          .slice(0, 100);

        const rawId = el.getAttribute('id') || '';
        const cleanId = rawId
          .replace(/[^a-zA-Z0-9_-]/g, '')
          .trim()
          .slice(0, 50);

        const rawType = el.getAttribute('type') || '';
        const cleanType = rawType
          .replace(/[^a-zA-Z0-9_-]/g, '')
          .trim()
          .slice(0, 30);

        const rawPlaceholder = el.getAttribute('placeholder') || '';
        const cleanPlaceholder = rawPlaceholder
          .replace(/["'<>\\]/g, '')
          .trim()
          .slice(0, 100);

        const rawAriaLabel = el.getAttribute('aria-label') || '';
        const cleanAriaLabel = rawAriaLabel
          .replace(/["'<>\\]/g, '')
          .trim()
          .slice(0, 100);

        const rawSrc = el.getAttribute('src') || '';
        const cleanSrc = rawSrc
          .replace(/["'<>\\]/g, '')
          .trim()
          .slice(0, 150);

        const rawHref = el.getAttribute('href') || '';
        const cleanHref = rawHref
          .replace(/["'<>\\]/g, '')
          .trim()
          .slice(0, 150);

        return {
          tagName,
          id: cleanId || undefined,
          className: cleanClass || undefined,
          type: cleanType || undefined,
          placeholder: cleanPlaceholder || undefined,
          ariaLabel: cleanAriaLabel || undefined,
          textContent: cleanText || undefined,
          src: cleanSrc || undefined,
          href: cleanHref || undefined,
        };
      }
    } catch {
      // Ignore DOMParser error and proceed to fallback
    }
  }

  // 2. Fallback: Lexical extraction if DOMParser is unavailable or throws
  return extractContextLexicalFallback(boundedExcerpt);
}

/**
 * Fallback tokenizer extracting basic tag and attribute tokens without evaluating scripts.
 */
function extractContextLexicalFallback(excerpt: string): ExtractedElementContext | null {
  const tagMatch = excerpt.match(/^<([a-zA-Z0-9-]+)/);
  if (!tagMatch || !tagMatch[1]) return null;
  const tagName = tagMatch[1].toLowerCase();

  const classMatch = excerpt.match(/class=["']([^"']+)["']/i);
  const idMatch = excerpt.match(/id=["']([^"']+)["']/i);
  const typeMatch = excerpt.match(/type=["']([^"']+)["']/i);
  const placeholderMatch = excerpt.match(/placeholder=["']([^"']+)["']/i);

  return {
    tagName,
    className:
      classMatch?.[1]?.replace(/[^a-zA-Z0-9_\s-]/g, '').slice(0, 100) || undefined,
    id: idMatch?.[1]?.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50) || undefined,
    type: typeMatch?.[1]?.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30) || undefined,
    placeholder:
      placeholderMatch?.[1]?.replace(/["'<>\\]/g, '').slice(0, 100) || undefined,
  };
}

/**
 * Generates tailored context-aware code snippets based on the extracted element context.
 */
function tailorCodeSnippets(
  baseExamples: CodeSnippet[],
  ruleId: string,
  context: ExtractedElementContext
): CodeSnippet[] {
  // If no identifiable class or id, return pristine base examples
  if (!context.className && !context.id && !context.type && !context.placeholder) {
    return baseExamples;
  }

  const idAttr = context.id ? ` id="${context.id}"` : '';
  const classAttr = context.className ? ` class="${context.className}"` : '';

  switch (ruleId) {
    case 'button-name': {
      return baseExamples.map((ex) => {
        if (ex.language === 'html' && ex.isPrimary) {
          return {
            ...ex,
            code: `<button type="button"${idAttr}${classAttr}>\n  <svg aria-hidden="true" viewBox="0 0 24 24">...</svg>\n  <span>Action Label</span>\n</button>`,
          };
        }
        return ex;
      });
    }

    case 'label': {
      const fieldId = context.id || 'field-id';
      const fieldType = context.type || 'text';
      const labelText =
        context.placeholder ||
        (context.id ? context.id.replace(/[-_]/g, ' ') : 'Field Label');
      const cleanLabel = labelText.charAt(0).toUpperCase() + labelText.slice(1);

      return baseExamples.map((ex) => {
        if (ex.language === 'html' && ex.isPrimary) {
          return {
            ...ex,
            code: `<div class="form-group">\n  <label for="${fieldId}">${cleanLabel}</label>\n  <input type="${fieldType}" id="${fieldId}" name="${fieldId}" required>\n</div>`,
          };
        }
        return ex;
      });
    }

    case 'image-alt': {
      const srcAttr = context.src
        ? ` src="${context.src}"`
        : ' src="/images/example.jpg"';
      return baseExamples.map((ex) => {
        if (ex.language === 'html' && ex.isPrimary) {
          return {
            ...ex,
            code: `<img${srcAttr}${idAttr}${classAttr} alt="Describe the informative purpose of this image">`,
          };
        }
        return ex;
      });
    }

    case 'link-name': {
      const hrefAttr = context.href ? ` href="${context.href}"` : ' href="/page"';
      return baseExamples.map((ex) => {
        if (ex.language === 'html' && ex.isPrimary) {
          return {
            ...ex,
            code: `<a${hrefAttr}${idAttr}${classAttr}>\n  <span>Descriptive link destination</span>\n</a>`,
          };
        }
        return ex;
      });
    }

    default:
      return baseExamples;
  }
}

/**
 * Synthesizes safe fallback guidance for unmapped or custom accessibility rules.
 */
function createFallbackGuidance(finding: FindingRecord): RemediationGuidance {
  const isBestPractice =
    finding.wcagTags.includes('best-practice') &&
    !finding.wcagTags.some((t) => t.startsWith('wcag'));

  const firstNode = finding.nodes?.[0];
  const nodeExcerpt = firstNode?.htmlExcerpt || '<!-- Affected element -->';
  const failureReason =
    firstNode?.failureSummary ||
    finding.description ||
    'Element does not meet automated accessibility verification criteria.';

  return {
    ruleId: finding.ruleId,
    title: finding.help || `Remediate ${finding.ruleId}`,
    classification: isBestPractice ? 'best-practice' : 'normative-wcag',
    wcagCriterion: isBestPractice
      ? 'Advisory Accessibility Best Practice'
      : finding.wcagTags.find((t) => t.startsWith('wcag')) || 'WCAG 2.2 Conformance',
    wcagLevel: isBestPractice ? 'Advisory' : 'A',
    whyItMatters:
      finding.description ||
      'Ensuring this element meets accessibility standards guarantees reliable interpretation by screen readers, keyboard users, and assistive technologies.',
    humanImpacts: [
      {
        userGroup: 'Assistive Technology Users',
        consequence:
          'May encounter unexpected navigation barriers or missing programmatic information.',
      },
    ],
    rootCauseAnalysis: failureReason,
    badExample: {
      snippet: nodeExcerpt,
      reason: failureReason,
    },
    goodExamples: [
      {
        language: 'html',
        title: 'Recommended Remediation Pattern',
        code: `<!-- Review the failure reason above and ensure the element satisfies accessibility criteria -->\n${nodeExcerpt}`,
        explanation:
          'Consult the official axe-core rule documentation for specific element-level requirements.',
        isPrimary: true,
      },
    ],
    potentialPitfalls: [
      'Always test keyboard navigation (Tab, Shift+Tab, Enter, Space) after modifying interactive markup.',
      'Prefer native HTML elements over custom ARIA widget implementations whenever possible.',
    ],
    verificationSteps: [
      {
        method: 'keyboard',
        instruction: 'Navigate to and interact with the element using only the keyboard.',
        expectedResult:
          'Focus cursor is visible and interactive controls operate reliably.',
      },
      {
        method: 'rescan',
        instruction: 'Run Phantom Audit rescan to confirm resolution.',
        expectedResult: `Finding for rule '${finding.ruleId}' is classified as Resolved.`,
      },
    ],
    officialDocUrl: finding.helpUrl,
    isCustomFallback: true,
  };
}

/**
 * Main Entry Point: Generates context-aware remediation guidance for any FindingRecord.
 */
export function generateRemediationGuidance(finding: FindingRecord): RemediationGuidance {
  const catalogEntry = getCatalogGuidance(finding.ruleId);

  // If no curated catalog entry exists, generate a safe honest fallback
  if (!catalogEntry) {
    return createFallbackGuidance(finding);
  }

  // Attempt to extract allowlisted context from the primary affected node
  const firstNode = finding.nodes?.[0];
  const excerpt = firstNode?.htmlExcerpt || '';
  const context = extractAllowlistedContext(excerpt);

  // If no context available or parsing produced null, return catalog baseline
  if (!context) {
    return catalogEntry;
  }

  // Tailor code snippets using the extracted allowlisted context
  const tailoredExamples = tailorCodeSnippets(
    catalogEntry.goodExamples,
    finding.ruleId,
    context
  );

  return {
    ...catalogEntry,
    goodExamples: tailoredExamples,
  };
}
