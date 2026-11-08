/**
 * Phantom Audit — Standalone Offline Accessible HTML Report Generator
 *
 * Implements Phase 8 Workstream 3:
 * - Generates a standalone, fully offline-compatible HTML report document.
 * - Accepts only a validated, already-redacted ReportExportPayload.
 * - Applies strict HTML entity escaping to every dynamic value (XSS-immune).
 * - Self-contained: embeds inlined CSS, zero external fonts/scripts/CDNs.
 * - Adheres to WCAG 2.2 AA accessibility, responsive layout, and print media.
 * - Strictly deterministic and pure functional string generation.
 */

import type {
  ReportExportPayload,
  ExportedFinding,
  ExportedFindingNode,
  RoomSummary,
  ExportReportOptions,
} from '@/domain/report';
import type { ScanRecord } from '@/domain/scan';
import type { RemediationStoragePayload } from '@/domain/remediation';
import { MANSION_ROOMS, type RoomId } from '@/domain/room';
import { ReportExportPayloadSchema } from '@/lib/validation/schemas';
import { sanitizeUrlForStorage } from '@/lib/storage';
import { redactUrl, prepareReportExport } from './report-redactor';
import { MANSION_REPORT_STYLES } from './html-templates/mansion-report-styles';
import {
  AUTOMATED_TESTING_LIMITATIONS,
  MANUAL_REVIEW_CHECKLIST_PROMPTS,
} from './disclaimers';

const ORDERED_ROOM_IDS: readonly RoomId[] = [
  'name-chamber',
  'contrast-crypt',
  'portrait-gallery',
  'form-cellar',
  'structure-hall',
  'focus-corridor',
  'other',
];

/**
 * Escapes characters with special meaning in HTML text and attributes.
 * Immune to XSS injection across tags, attributes, and script contexts.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validates whether a URL begins with http:// or https://.
 * Prevents javascript:, data:, or other dangerous schemes in active links.
 */
export function isSafeHttpUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Formats a duration in milliseconds into human-readable seconds or milliseconds.
 */
function formatDuration(startTime: string, endTime?: string): string {
  if (!endTime) return 'N/A';
  try {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
      return 'N/A';
    }
    const diffMs = end - start;
    if (diffMs < 1000) {
      return `${diffMs} ms`;
    }
    return `${(diffMs / 1000).toFixed(2)} s`;
  } catch {
    return 'N/A';
  }
}

/**
 * Static inline SVG brand crest for Phantom Audit (Victorian Gothic keyhole lantern).
 */
const BRAND_CREST_SVG = `<svg class="brand-crest" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M24 4L8 14V34L24 44L40 34V14L24 4Z" stroke="#8b5cf6" stroke-width="2.5" stroke-linejoin="round" fill="#14161f"/>
  <circle cx="24" cy="20" r="5" stroke="#22d3ee" stroke-width="2" fill="#0b0c10"/>
  <path d="M22 24L20 32H28L26 24" stroke="#22d3ee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="#0b0c10"/>
  <path d="M16 16L8 14M32 16L40 14M24 4V10M24 38V44" stroke="#c084fc" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

/**
 * Renders individual DOM node finding information.
 */
function renderFindingNode(
  node: ExportedFindingNode,
  nodeIndex: number,
  excerptsIncluded: boolean
): string {
  const targetSelector = node.target.join(' ');
  const escapedSelector = escapeHtml(targetSelector);
  const escapedFailure = escapeHtml(node.failureSummary);

  let excerptHtml = '';
  if (excerptsIncluded && typeof node.htmlExcerpt === 'string') {
    excerptHtml = `
      <div class="excerpt-box">
        <span class="selector-label">HTML Excerpt:</span>
        <pre class="code-excerpt"><code>${escapeHtml(node.htmlExcerpt)}</code></pre>
      </div>`;
  } else {
    excerptHtml = `
      <span class="excerpt-omitted">HTML excerpt omitted per export privacy settings.</span>`;
  }

  return `
    <div class="node-item">
      <div class="selector-box">
        <span class="selector-label">Element ${nodeIndex + 1}:</span>
        <code class="selector">${escapedSelector}</code>
      </div>
      <div class="failure-summary">${escapedFailure}</div>
      ${excerptHtml}
    </div>`;
}

/**
 * Renders the remediation guidance block for a finding.
 */
function renderRemediationBlock(
  finding: ExportedFinding,
  remediationIncluded: boolean
): string {
  if (!remediationIncluded) return '';

  const rem = finding.remediationRecommendation;
  if (!rem) return '';

  const escapedSummary = escapeHtml(rem.summary);
  const escapedSnippet = rem.suggestedSnippet ? escapeHtml(rem.suggestedSnippet) : '';
  const escapedMethod = rem.verificationMethod ? escapeHtml(rem.verificationMethod) : '';
  const escapedStatus = rem.status ? escapeHtml(rem.status) : '';
  const escapedNotes = rem.notes ? escapeHtml(rem.notes) : '';

  let snippetBlock = '';
  if (escapedSnippet) {
    snippetBlock = `
      <div class="remediation-snippet-box">
        <span class="selector-label">Suggested Code Fix:</span>
        <pre class="remediation-snippet"><code>${escapedSnippet}</code></pre>
      </div>`;
  }

  let metaBlock = '';
  const metaParts: string[] = [];
  if (escapedStatus) {
    metaParts.push(`<strong>Status:</strong> ${escapedStatus}`);
  }
  if (escapedMethod) {
    metaParts.push(`<strong>Verification:</strong> ${escapedMethod}`);
  }
  if (metaParts.length > 0) {
    metaBlock = `<div class="remediation-meta">${metaParts.join(' &bull; ')}</div>`;
  }

  let notesBlock = '';
  if (escapedNotes) {
    notesBlock = `<div class="remediation-meta"><strong>Auditor Notes:</strong> ${escapedNotes}</div>`;
  }

  return `
    <aside class="remediation-box" aria-label="Remediation guidance for rule ${escapeHtml(finding.ruleId)}">
      <h4 class="remediation-heading">Remediation Guidance</h4>
      <div class="remediation-summary">${escapedSummary}</div>
      ${snippetBlock}
      ${metaBlock}
      ${notesBlock}
    </aside>`;
}

/**
 * Renders an individual finding card.
 */
function renderFindingCard(
  finding: ExportedFinding,
  index: number,
  excerptsIncluded: boolean,
  remediationIncluded: boolean
): string {
  const severity = finding.impact || 'unknown';
  const escapedSeverity = escapeHtml(severity);
  const escapedRuleId = escapeHtml(finding.ruleId);
  const escapedRoomName = escapeHtml(finding.roomName);
  const escapedDescription = escapeHtml(finding.description);
  const escapedHelp = escapeHtml(finding.help);
  const classificationText =
    finding.ruleClassification === 'normative-wcag'
      ? 'Normative WCAG Failure'
      : 'Best-Practice Advisory';

  // Help URL safely rendered if valid http/https
  let helpLinkHtml = '';
  if (isSafeHttpUrl(finding.helpUrl)) {
    helpLinkHtml = ` &bull; <a href="${escapeHtml(finding.helpUrl)}" target="_blank" rel="noopener noreferrer">axe-core rule documentation</a>`;
  }

  // WCAG Tags
  const wcagBadges = finding.wcagTags
    .map((tag) => `<span class="badge badge-wcag">${escapeHtml(tag)}</span>`)
    .join(' ');

  // Render nodes
  const nodesHtml = finding.nodes
    .map((node, nodeIdx) => renderFindingNode(node, nodeIdx, excerptsIncluded))
    .join('');

  // Remediation
  const remediationHtml = renderRemediationBlock(finding, remediationIncluded);

  return `
    <article class="finding-card finding-card-${escapeHtml(severity)}" id="finding-${index + 1}" aria-labelledby="finding-title-${index + 1}">
      <header class="finding-header">
        <div class="finding-badges">
          <span class="badge badge-${escapeHtml(severity)}">${escapedSeverity}</span>
          <span class="badge badge-room">${escapedRoomName}</span>
          <span class="badge badge-classification">${escapeHtml(classificationText)}</span>
          ${wcagBadges}
        </div>
      </header>
      
      <h3 class="finding-title" id="finding-title-${index + 1}">${escapedDescription}</h3>
      <p class="finding-help">
        <strong>Rule ID:</strong> <code>${escapedRuleId}</code> &bull; ${escapedHelp}${helpLinkHtml}
      </p>

      <div class="nodes-section">
        <h4 class="nodes-heading">Affected DOM Elements (${finding.affectedNodeCount})</h4>
        ${nodesHtml}
      </div>

      ${remediationHtml}
    </article>`;
}

/**
 * Renders the 7-room Haunted Mansion summary table.
 */
function renderRoomsTable(roomsSummary: Partial<Record<RoomId, RoomSummary>>): string {
  const rows = ORDERED_ROOM_IDS.map((roomId) => {
    const def = MANSION_ROOMS[roomId];
    const summary = roomsSummary[roomId] || {
      totalFindings: 0,
      criticalCount: 0,
      seriousCount: 0,
      moderateCount: 0,
      minorCount: 0,
    };
    const isHaunted = summary.totalFindings > 0;
    const statusBadge = isHaunted
      ? `<span class="badge badge-status-haunted">Haunted</span>`
      : `<span class="badge badge-status-quiet">Quiet</span>`;

    return `
      <tr>
        <th scope="row">${escapeHtml(def.name)}</th>
        <td>${escapeHtml(def.wcagFamily)}</td>
        <td>${statusBadge}</td>
        <td class="numeric">${summary.criticalCount}</td>
        <td class="numeric">${summary.seriousCount}</td>
        <td class="numeric">${summary.moderateCount}</td>
        <td class="numeric">${summary.minorCount}</td>
        <td class="numeric"><strong>${summary.totalFindings}</strong></td>
      </tr>`;
  }).join('');

  return `
    <div class="table-wrapper">
      <table>
        <caption>Haunted Mansion 7-Room Accessibility Breakdown</caption>
        <thead>
          <tr>
            <th scope="col">Mansion Room</th>
            <th scope="col">WCAG Family</th>
            <th scope="col">Status</th>
            <th scope="col" class="numeric">Critical</th>
            <th scope="col" class="numeric">Serious</th>
            <th scope="col" class="numeric">Moderate</th>
            <th scope="col" class="numeric">Minor</th>
            <th scope="col" class="numeric">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`;
}

/**
 * Generates a complete, offline-ready, accessible HTML report from an already-redacted ReportExportPayload.
 *
 * @throws {Error} if payload fails Zod schema validation.
 */
export function generateHtmlReport(redactedPayload: ReportExportPayload): string {
  // 1. Strict schema validation of the incoming redacted payload
  const payload = ReportExportPayloadSchema.parse(redactedPayload);

  const { reportMetadata, target, summary, findings } = payload;

  const escapedReportId = escapeHtml(reportMetadata.reportId);
  const escapedExportedAt = escapeHtml(reportMetadata.exportedAt);
  const formattedExportedDate = new Date(reportMetadata.exportedAt).toUTCString();
  const escapedPageTitle = escapeHtml(target.pageTitle || 'Untitled Document');
  const escapedHostname = escapeHtml(target.hostname);
  const escapedScannedAt = escapeHtml(target.scannedAt);
  const scanDuration = formatDuration(target.scannedAt, target.completedAt);
  const escapedScanDuration = escapeHtml(scanDuration);
  const escapedToolVersion = escapeHtml(reportMetadata.toolVersion);
  const escapedAxeVersion = escapeHtml(reportMetadata.environment.axeVersion);
  const escapedBrowser = escapeHtml(reportMetadata.environment.browserName);

  // Redaction options applied
  const urlRedactionLevel = reportMetadata.optionsApplied?.urlRedactionLevel || 'full';
  const excerptsIncluded = reportMetadata.optionsApplied?.includeHtmlExcerpts ?? false;
  const remediationIncluded =
    reportMetadata.optionsApplied?.includeRemediationGuidance ?? true;

  // Defense-in-depth URL sanitization and privacy scope enforcement (DEF-821)
  const sanitizedUrl = sanitizeUrlForStorage(target.url);
  const effectiveTargetUrl = redactUrl(sanitizedUrl, urlRedactionLevel);
  const escapedTargetUrl = escapeHtml(effectiveTargetUrl);

  // Findings list markup
  let findingsMarkup = '';
  if (findings.length === 0) {
    findingsMarkup = `
      <div class="empty-state">
        <h3 class="empty-title">All Rooms Are Quiet &mdash; Zero Automated Violations Detected</h3>
        <p class="empty-desc">
          No automated accessibility violations were detected for this page under axe-core ${escapedAxeVersion}.
          Please note that automated tools evaluate only a subset of WCAG success criteria. Comprehensive compliance
          requires verifying the manual review checklist below.
        </p>
      </div>`;
  } else {
    findingsMarkup = `
      <div class="finding-list">
        ${findings.map((finding, idx) => renderFindingCard(finding, idx, excerptsIncluded, remediationIncluded)).join('')}
      </div>`;
  }

  // Rooms table markup
  const roomsTableMarkup = renderRoomsTable(summary.roomsSummary);

  // Manual checklist items (DEF-822: accessible label without invalid aria-hidden conflict)
  const checklistItemsMarkup = MANUAL_REVIEW_CHECKLIST_PROMPTS.map(
    (prompt, idx) => `
      <li class="checklist-item">
        <input type="checkbox" id="check-${idx + 1}" class="checklist-checkbox" disabled />
        <label for="check-${idx + 1}" class="checklist-text">${escapeHtml(prompt)}</label>
      </li>`
  ).join('');

  // Target URL anchor if safe http/https, else plain text
  const targetUrlHtml = isSafeHttpUrl(effectiveTargetUrl)
    ? `<a href="${escapedTargetUrl}" target="_blank" rel="noopener noreferrer">${escapedTargetUrl}</a>`
    : escapedTargetUrl;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Phantom Audit standalone accessibility audit report for ${escapedHostname}">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; object-src 'none'; base-uri 'none'; form-action 'none';">
  <title>Phantom Audit Report &mdash; ${escapedPageTitle} (${escapedHostname})</title>
  <style>
${MANSION_REPORT_STYLES}
  </style>
</head>
<body>
  <a href="#main-content" class="skip-link">Skip to main findings</a>

  <div class="report-container">
    <!-- Header & Brand Identity -->
    <header class="report-header" role="banner">
      <div class="brand-row">
        ${BRAND_CREST_SVG}
        <div class="brand-titles">
          <span class="brand-kicker">Kiroween 2026 Hackathon Edition</span>
          <h1>Phantom Audit Report</h1>
        </div>
      </div>
      <p class="report-subtitle">
        Haunted Accessibility Audit &amp; Verification Diagnostics
      </p>

      <div class="metadata-grid" aria-label="Report Generation Metadata">
        <div class="meta-item">
          <span class="meta-label">Report ID</span>
          <span class="meta-value">${escapedReportId}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Generated UTC</span>
          <span class="meta-value"><time datetime="${escapedExportedAt}">${escapeHtml(formattedExportedDate)}</time></span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Tool / Engine</span>
          <span class="meta-value">Phantom v${escapedToolVersion} &bull; axe ${escapedAxeVersion} (${escapedBrowser})</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Privacy Redaction</span>
          <span class="meta-value">URL: ${escapeHtml(urlRedactionLevel)} &bull; Excerpts: ${excerptsIncluded ? 'Included' : 'Omitted'} &bull; Guidance: ${remediationIncluded ? 'Included' : 'Omitted'}</span>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main id="main-content" role="main">
      <!-- Target Summary -->
      <section class="section" aria-labelledby="target-heading">
        <h2 id="target-heading">Audit Target &amp; Scope</h2>
        <div class="metadata-grid">
          <div class="meta-item">
            <span class="meta-label">Page Title</span>
            <span class="meta-value">${escapedPageTitle}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Target URL</span>
            <span class="meta-value">${targetUrlHtml}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Scanned At</span>
            <span class="meta-value">${escapedScannedAt}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Scan Duration</span>
            <span class="meta-value">${escapedScanDuration}</span>
          </div>
        </div>
      </section>

      <!-- Executive Metrics Summary -->
      <section class="section" aria-labelledby="summary-heading">
        <h2 id="summary-heading">Executive Findings Summary</h2>
        <div class="summary-grid" role="region" aria-label="Severity Breakdown Metrics">
          <div class="metric-card metric-card-critical">
            <span class="metric-count">${summary.criticalCount}</span>
            <span class="metric-label">Critical</span>
          </div>
          <div class="metric-card metric-card-serious">
            <span class="metric-count">${summary.seriousCount}</span>
            <span class="metric-label">Serious</span>
          </div>
          <div class="metric-card metric-card-moderate">
            <span class="metric-count">${summary.moderateCount}</span>
            <span class="metric-label">Moderate</span>
          </div>
          <div class="metric-card metric-card-minor">
            <span class="metric-count">${summary.minorCount}</span>
            <span class="metric-label">Minor</span>
          </div>
          <div class="metric-card">
            <span class="metric-count">${summary.totalFindings}</span>
            <span class="metric-label">Total Issues</span>
          </div>
          <div class="metric-card">
            <span class="metric-count">${summary.passesCount}</span>
            <span class="metric-label">Passed Checks</span>
          </div>
          <div class="metric-card">
            <span class="metric-count">${summary.incompleteChecksCount}</span>
            <span class="metric-label">Incomplete</span>
          </div>
          <div class="metric-card">
            <span class="metric-count">${summary.inapplicableCount}</span>
            <span class="metric-label">Inapplicable</span>
          </div>
        </div>
      </section>

      <!-- Mansion Rooms Table -->
      <section class="section" aria-labelledby="rooms-heading">
        <h2 id="rooms-heading">Haunted Mansion Room Breakdown</h2>
        <p>
          Accessibility issues are categorized across seven canonical problem families mapped to the Haunted Mansion architecture.
        </p>
        ${roomsTableMarkup}
      </section>

      <!-- Detailed Findings List -->
      <section class="section" aria-labelledby="findings-heading">
        <h2 id="findings-heading">Detailed Accessibility Findings (${findings.length})</h2>
        ${findingsMarkup}
      </section>

      <!-- Automated Testing Limitations -->
      <section class="section" aria-labelledby="limitations-heading">
        <div class="limitations-box">
          <h2 id="limitations-heading" class="limitations-title">Automated Testing Scope &amp; Legal Disclaimers</h2>
          <p class="limitations-text">
            ${escapeHtml(AUTOMATED_TESTING_LIMITATIONS)}
          </p>
        </div>
      </section>

      <!-- Manual Review Checklist -->
      <section class="section" aria-labelledby="checklist-heading">
        <h2 id="checklist-heading">Essential Manual Review Checklist</h2>
        <p>
          Automated checks verify only a portion of WCAG 2.2 AA success criteria. Human auditors must manually evaluate the following eight criteria:
        </p>
        <ol class="checklist">
          ${checklistItemsMarkup}
        </ol>
      </section>
    </main>

    <!-- Footer -->
    <footer class="report-footer" role="contentinfo">
      <p class="footer-statement">
        <strong>Phantom Audit &mdash; Kiroween 2026 Hackathon Edition</strong> &bull;
        Schema Version: ${reportMetadata.schemaVersion} &bull; Specification: v${reportMetadata.version}
      </p>
      <p class="footer-standards">
        Evaluated against W3C Web Content Accessibility Guidelines (WCAG) 2.2 Level AA &bull; Automated diagnostics via axe-core v${escapedAxeVersion}
      </p>
      <p class="footer-standards">
        This document is an automated engineering diagnostics export and does not constitute a legal certification or guarantee of accessibility conformance.
      </p>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Safe wrapper for generating an HTML report.
 * Catches validation errors and returns a typed result object.
 */
export function safeGenerateHtmlReport(
  redactedPayload: unknown
): { success: true; html: string } | { success: false; error: Error } {
  try {
    const html = generateHtmlReport(redactedPayload as ReportExportPayload);
    return { success: true, html };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Prepares a scan record through the privacy redaction pipeline and generates a
 * standalone, offline-ready HTML report document.
 *
 * Guarantees that unredacted data cannot pass into downstream HTML output.
 */
export function exportReportToHtml(
  scan: Readonly<ScanRecord>,
  options: ExportReportOptions,
  remediationRecords?: Readonly<RemediationStoragePayload>
): string {
  const preparedPayload = prepareReportExport(scan, options, remediationRecords);
  return generateHtmlReport(preparedPayload);
}
