/**
 * Phantom Audit — Privacy Redaction Pipeline & Export Safety Engine
 *
 * Implements Workstream 2 of Phase 8:
 * - Pure functional privacy redaction engine (`redactReportPayload`).
 * - Enforces mandatory credential, token, and session ID purging regardless of options.
 * - Applies configurable URL scopes ('full' | 'path-only' | 'hostname-only').
 * - Strictly omits HTML excerpts when includeHtmlExcerpts === false (no empty strings).
 * - Sanitizes HTML excerpts and remediation notes when present.
 * - Enforces schema validation (.strict()) before returning safe payloads.
 * - Guarantees idempotency and input immutability.
 */

import { z } from 'zod';
import type { ScanRecord } from '@/domain/scan';
import type {
  ExportReportOptions,
  ExportedFinding,
  ExportedFindingNode,
  ExportedFindingRemediation,
  ReportExportPayload,
  UrlRedactionLevel,
} from '@/domain/report';
import type { RemediationStoragePayload } from '@/domain/remediation';
import {
  ExportReportOptionsSchema,
  ReportExportPayloadSchema,
} from '@/lib/validation/schemas';
import { sanitizeUrlForStorage } from '@/lib/storage';
import {
  buildReportPayload,
  serializeReportToJson,
  sortFindingsDeterministically,
} from './json-serializer';

/**
 * Custom error thrown when a redacted report payload fails runtime schema validation.
 */
export class RedactionValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: z.ZodIssue[]
  ) {
    super(message);
    this.name = 'RedactionValidationError';
  }
}

/**
 * Result wrapper for safe redaction without throwing.
 */
export type RedactReportResult =
  | { success: true; payload: ReportExportPayload }
  | { success: false; error: RedactionValidationError };

/**
 * Redacts a URL based on the requested redaction level, while ALWAYS enforcing
 * mandatory credential and token purging.
 *
 * Scopes:
 * - 'full': Preserves safe path, safe query params, and safe hash routes.
 *           Purges credentials (user:pass@) and sensitive tokens.
 * - 'path-only': Preserves scheme, host, and pathname. Completely strips query and hash.
 * - 'hostname-only': Preserves only scheme and host (origin). Completely strips path, query, and hash.
 *
 * Guaranteed idempotent and fails safely on malformed inputs without leaking credentials.
 */
export function redactUrl(rawUrl: string, level: UrlRedactionLevel): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();

  // 1. Mandatory baseline credential & sensitive parameter sanitization
  const sanitized = sanitizeUrlForStorage(trimmed);

  // 2. Apply URL scoping rules
  try {
    const url = new URL(sanitized);

    switch (level) {
      case 'full':
        return url.toString();

      case 'path-only': {
        if (url.protocol === 'file:') {
          return `file://${url.pathname}`;
        }
        const hostPart = url.host ? `${url.protocol}//${url.host}` : url.origin;
        return `${hostPart}${url.pathname}`;
      }

      case 'hostname-only': {
        if (url.protocol === 'file:') {
          return 'file://localhost';
        }
        const hostPart = url.host ? `${url.protocol}//${url.host}` : url.origin;
        if (hostPart === 'null' || !hostPart) {
          return `${url.protocol}//`;
        }
        return hostPart;
      }

      default:
        return url.toString();
    }
  } catch {
    // Malformed or non-standard URL: fail safely without exposing sensitive tokens
    const noQueryOrHash = sanitized.split('?')[0]?.split('#')[0] ?? '';
    if (level === 'hostname-only') {
      return '[REDACTED_URL]';
    }
    if (level === 'path-only') {
      return noQueryOrHash || '[REDACTED_URL]';
    }
    return sanitized || '[REDACTED_URL]';
  }
}

/**
 * Sanitizes and safely bounds an HTML excerpt:
 * - Disarms active/executable elements (<script>, <style>, <iframe>, <object>, <embed>, <svg>, <math>).
 * - Disarms unclosed script tags and HTML comments.
 * - Disarms dangerous URI schemes (javascript:, vbscript:, data:text/html) in attributes.
 * - Neutralizes all inline event handlers (on\w+) across quoted, unquoted, space, and slash delimiters.
 * - Redacts textarea element contents ([REDACTED]).
 * - Redacts form input/select/textarea value="..." attributes ([REDACTED] or [PASSWORD_REDACTED]).
 * - Redacts sensitive data-* attributes (data-token, data-auth-token, data-secret, etc.).
 * - Redacts inline bearer tokens and API keys.
 * - Enforces safe length limits (default 200 chars, ceiling 1000).
 *
 * NOTE: htmlExcerpt is strictly UNTRUSTED diagnostic text, not safe HTML. Consumers must
 * always render excerpts using text nodes or HTML entity escaping (never unescaped innerHTML).
 */
export function sanitizeHtmlExcerpt(rawHtml: string, maxLength = 200): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';
  let cleaned = rawHtml.trim();

  // 1. Disarm active/dangerous tags (both paired and unclosed/self-closing)
  cleaned = cleaned.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '[SCRIPT_REDACTED]');
  cleaned = cleaned.replace(/<script\b[^>]*>/gi, '[SCRIPT_REDACTED]');
  cleaned = cleaned.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '[STYLE_REDACTED]');
  cleaned = cleaned.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '[IFRAME_REDACTED]');
  cleaned = cleaned.replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '[OBJECT_REDACTED]');
  cleaned = cleaned.replace(/<embed\b[^>]*>/gi, '[EMBED_REDACTED]');
  cleaned = cleaned.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '[SVG_REDACTED]');
  cleaned = cleaned.replace(/<svg\b[^>]*>/gi, '[SVG_REDACTED]');
  cleaned = cleaned.replace(/<math\b[^>]*>[\s\S]*?<\/math>/gi, '[MATH_REDACTED]');

  // 2. Disarm HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/gi, '<!-- [COMMENT_REDACTED] -->');

  // 3. Disarm dangerous URI schemes (javascript:, vbscript:, data:text/html)
  cleaned = cleaned.replace(
    /(?:[\s/])(?:href|src|action|formaction|data)\s*=\s*(['"])\s*(?:javascript|vbscript|data\s*:\s*text\/html)[\s\S]*?\1/gi,
    ' href="[BLOCKED_URI]"'
  );
  cleaned = cleaned.replace(
    /(?:[\s/])(?:href|src|action|formaction|data)\s*=\s*(?:javascript|vbscript|data\s*:\s*text\/html)[^\s>]*/gi,
    ' href="[BLOCKED_URI]"'
  );

  // 4. Disarm all inline DOM event handlers (onload, onerror, onclick, onfocus, etc.)
  cleaned = cleaned.replace(
    /(?:[\s/])on[a-zA-Z0-9_-]+\s*=\s*(['"]).*?\1/gi,
    ' on-event="[REDACTED]"'
  );
  cleaned = cleaned.replace(
    /(?:[\s/])on[a-zA-Z0-9_-]+\s*=\s*[^\s>]+/gi,
    ' on-event="[REDACTED]"'
  );

  // 5. Redact textarea content
  cleaned = cleaned.replace(
    /<textarea\b([^>]*)>[\s\S]*?<\/textarea>/gi,
    '<textarea$1>[REDACTED]</textarea>'
  );

  // 6. Redact password inputs
  if (/type=(['"])?password\1?/i.test(cleaned)) {
    cleaned = cleaned.replace(
      /(?:[\s/])value\s*=\s*(['"]).*?\1/gi,
      ' value="[PASSWORD_REDACTED]"'
    );
    cleaned = cleaned.replace(
      /(?:[\s/])value\s*=\s*[^\s>]+/gi,
      ' value="[PASSWORD_REDACTED]"'
    );
  } else {
    // 7. Redact generic form input values (input, button, option)
    cleaned = cleaned.replace(
      /(?:[\s/])value\s*=\s*(['"]).*?\1/gi,
      ' value="[REDACTED]"'
    );
    cleaned = cleaned.replace(/(?:[\s/])value\s*=\s*[^\s>]+/gi, ' value="[REDACTED]"');
  }

  // 8. Redact sensitive data-* attributes (broad pattern matching any data attribute containing sensitive keywords)
  cleaned = cleaned.replace(
    /(?:[\s/])data-[a-zA-Z0-9_-]*(?:token|secret|auth|key|pass|cred|session|jwt|code|hash|sig|csrf)[a-zA-Z0-9_-]*\s*=\s*(['"]).*?\1/gi,
    ' data-token="[REDACTED]"'
  );
  cleaned = cleaned.replace(
    /(?:[\s/])data-[a-zA-Z0-9_-]*(?:token|secret|auth|key|pass|cred|session|jwt|code|hash|sig|csrf)[a-zA-Z0-9_-]*\s*=\s*[^\s>]+/gi,
    ' data-token="[REDACTED]"'
  );

  // 9. Redact sensitive credentials in text content
  cleaned = cleaned.replace(/\b(?:bearer)\s+[a-zA-Z0-9_.-]+/gi, 'bearer [REDACTED]');
  cleaned = cleaned.replace(
    /\b(?:api[_-]?key|secret|password|token)\s*[:=]\s*(['"]?)[a-zA-Z0-9_.-]+\1/gi,
    '[REDACTED_SECRET]'
  );

  // 10. Safe length bounding (schema upper bound is 1000)
  const effectiveMax = Math.min(Math.max(maxLength, 10), 1000);
  if (cleaned.length <= effectiveMax) {
    return cleaned;
  }
  return cleaned.slice(0, effectiveMax - 3) + '...';
}

/**
 * Sanitizes user-provided remediation notes to avoid leaking tokens or secrets.
 * Bounded to schema maximum of 500 characters.
 */
export function sanitizeRemediationNotes(notes?: string): string | undefined {
  if (!notes || typeof notes !== 'string') return undefined;
  const trimmed = notes.trim();
  if (!trimmed) return undefined;

  let sanitized = trimmed;
  sanitized = sanitized.replace(/\b(?:bearer)\s+[a-zA-Z0-9_.-]+/gi, 'bearer [REDACTED]');
  sanitized = sanitized.replace(
    /\b(?:(?:access_|refresh_|id_)?token|api[_-]?key|secret|password|auth|pwd)\s*[:=]\s*(["']?)[a-zA-Z0-9_.-]+\1/gi,
    '[REDACTED_SECRET]'
  );

  if (sanitized.length > 500) {
    sanitized = sanitized.slice(0, 497) + '...';
  }

  return sanitized;
}

/**
 * Pure functional Privacy Redaction Pipeline.
 *
 * Receives a report payload and validated export options, applies mandatory privacy
 * sanitization and configured scoping, validates against ReportExportPayloadSchema,
 * and returns the clean payload.
 *
 * Invariants:
 * - Does NOT mutate the input payload.
 * - Explicit allowlisting prevents arbitrary or secret object spreading.
 * - If includeHtmlExcerpts === false, htmlExcerpt is omitted completely from every node.
 * - Idempotency guaranteed: redactReportPayload(redactReportPayload(p, o), o) deep equals redactReportPayload(p, o).
 */
export function redactReportPayload(
  payload: Readonly<ReportExportPayload>,
  options: ExportReportOptions
): ReportExportPayload {
  // 1. Validate options
  let validatedOptions: ExportReportOptions;
  try {
    validatedOptions = ExportReportOptionsSchema.parse(options);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new RedactionValidationError(
        `Invalid export options: ${err.message}`,
        err.issues
      );
    }
    throw err;
  }

  // 2. Redact target URL based on level and mandatory rules
  const redactedUrl = redactUrl(payload.target.url, validatedOptions.urlRedactionLevel);

  // 3. Map and sanitize findings
  const redactedFindings: ExportedFinding[] = payload.findings.map((finding) => {
    // Map nodes: enforce htmlExcerpt policy
    const redactedNodes: ExportedFindingNode[] = finding.nodes.map((node) => {
      const cleanNode: ExportedFindingNode = {
        target: [...node.target],
        failureSummary: node.failureSummary,
      };

      // Only attach htmlExcerpt if explicitly enabled AND excerpt exists.
      // When false, omit property completely.
      if (validatedOptions.includeHtmlExcerpts && node.htmlExcerpt !== undefined) {
        cleanNode.htmlExcerpt = sanitizeHtmlExcerpt(node.htmlExcerpt);
      }

      return cleanNode;
    });

    // Sanitize helpUrl if present
    const sanitizedHelpUrl = finding.helpUrl
      ? sanitizeUrlForStorage(finding.helpUrl)
      : undefined;

    // Handle remediation recommendation
    let remediationRecommendation: ExportedFindingRemediation | undefined;
    if (
      validatedOptions.includeRemediationGuidance !== false &&
      finding.remediationRecommendation
    ) {
      remediationRecommendation = {
        summary: finding.remediationRecommendation.summary,
        ...(finding.remediationRecommendation.suggestedSnippet
          ? { suggestedSnippet: finding.remediationRecommendation.suggestedSnippet }
          : {}),
        ...(finding.remediationRecommendation.verificationMethod
          ? { verificationMethod: finding.remediationRecommendation.verificationMethod }
          : {}),
        ...(finding.remediationRecommendation.status
          ? { status: finding.remediationRecommendation.status }
          : {}),
        ...(finding.remediationRecommendation.notes
          ? { notes: sanitizeRemediationNotes(finding.remediationRecommendation.notes) }
          : {}),
      };
    }

    const cleanFinding: ExportedFinding = {
      fingerprint: finding.fingerprint,
      ruleId: finding.ruleId,
      impact: finding.impact,
      roomId: finding.roomId,
      roomName: finding.roomName,
      description: finding.description,
      help: finding.help,
      ...(sanitizedHelpUrl ? { helpUrl: sanitizedHelpUrl } : {}),
      wcagTags: [...finding.wcagTags],
      ruleClassification: finding.ruleClassification,
      affectedNodeCount: finding.affectedNodeCount,
      nodes: redactedNodes,
      reviewed: finding.reviewed,
      ...(finding.comparisonCategory
        ? { comparisonCategory: finding.comparisonCategory }
        : {}),
      ...(finding.uncertainReason ? { uncertainReason: finding.uncertainReason } : {}),
      ...(remediationRecommendation ? { remediationRecommendation } : {}),
    };

    return cleanFinding;
  });

  // 4. Stably re-sort findings for determinism
  const sortedFindings = sortFindingsDeterministically(redactedFindings);

  // 5. Construct payload using explicit allowlist (no object spreading of payload)
  const candidatePayload: ReportExportPayload = {
    reportMetadata: {
      reportId: payload.reportMetadata.reportId,
      tool: 'Phantom Audit',
      toolVersion: payload.reportMetadata.toolVersion,
      schemaVersion: 1,
      version: '1.0.0',
      exportedAt: payload.reportMetadata.exportedAt,
      environment: {
        browserName: payload.reportMetadata.environment.browserName,
        axeVersion: payload.reportMetadata.environment.axeVersion,
      },
      optionsApplied: {
        format: validatedOptions.format,
        includeHtmlExcerpts: validatedOptions.includeHtmlExcerpts,
        urlRedactionLevel: validatedOptions.urlRedactionLevel,
        ...(validatedOptions.includeRemediationGuidance !== undefined
          ? { includeRemediationGuidance: validatedOptions.includeRemediationGuidance }
          : {}),
        ...(validatedOptions.redactUrlQueryParameters !== undefined
          ? { redactUrlQueryParameters: validatedOptions.redactUrlQueryParameters }
          : {}),
        ...(validatedOptions.reportId ? { reportId: validatedOptions.reportId } : {}),
        ...(validatedOptions.exportedAt
          ? { exportedAt: validatedOptions.exportedAt }
          : {}),
      },
    },
    target: {
      scanId: payload.target.scanId,
      url: redactedUrl,
      hostname: payload.target.hostname,
      pageTitle: payload.target.pageTitle,
      scannedAt: payload.target.scannedAt,
      ...(payload.target.completedAt ? { completedAt: payload.target.completedAt } : {}),
    },
    summary: {
      totalFindings: payload.summary.totalFindings,
      criticalCount: payload.summary.criticalCount,
      seriousCount: payload.summary.seriousCount,
      moderateCount: payload.summary.moderateCount,
      minorCount: payload.summary.minorCount,
      passesCount: payload.summary.passesCount,
      incompleteChecksCount: payload.summary.incompleteChecksCount,
      inapplicableCount: payload.summary.inapplicableCount,
      roomsSummary: { ...payload.summary.roomsSummary },
    },
    findings: sortedFindings,
    limitations: payload.limitations,
    manualReviewChecklist: [...payload.manualReviewChecklist],
  };

  // 6. Strict validation against ReportExportPayloadSchema
  const parseResult = ReportExportPayloadSchema.safeParse(candidatePayload);
  if (!parseResult.success) {
    throw new RedactionValidationError(
      `Report redaction failed schema validation: ${parseResult.error.message}`,
      parseResult.error.issues
    );
  }

  return parseResult.data as ReportExportPayload;
}

/**
 * Safe wrapper around redactReportPayload that catches validation errors
 * and returns a typed RedactReportResult.
 */
export function safeRedactReportPayload(
  payload: Readonly<ReportExportPayload>,
  options: ExportReportOptions
): RedactReportResult {
  try {
    const redacted = redactReportPayload(payload, options);
    return { success: true, payload: redacted };
  } catch (err) {
    if (err instanceof RedactionValidationError) {
      return { success: false, error: err };
    }
    if (err instanceof z.ZodError) {
      return {
        success: false,
        error: new RedactionValidationError(err.message, err.issues),
      };
    }
    return {
      success: false,
      error: new RedactionValidationError(
        err instanceof Error ? err.message : String(err),
        []
      ),
    };
  }
}

/**
 * Prepares a fully redacted, schema-validated report export payload from a scan record.
 * Integrates report building and the privacy redaction pipeline.
 *
 * Guarantees that unredacted data cannot pass into downstream serialization.
 */
export function prepareReportExport(
  scan: Readonly<ScanRecord>,
  options: ExportReportOptions,
  remediationRecords?: Readonly<RemediationStoragePayload>
): ReportExportPayload {
  const rawPayload = buildReportPayload(scan, options, remediationRecords);
  return redactReportPayload(rawPayload, options);
}

/**
 * Deterministically serializes a scan record to JSON by passing it through
 * the privacy redaction pipeline prior to formatting.
 */
export function exportReportToJson(
  scan: Readonly<ScanRecord>,
  options: ExportReportOptions,
  remediationRecords?: Readonly<RemediationStoragePayload>
): string {
  const safePayload = prepareReportExport(scan, options, remediationRecords);
  return serializeReportToJson(safePayload);
}
