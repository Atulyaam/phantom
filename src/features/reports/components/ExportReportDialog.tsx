/**
 * Phantom Audit — Privacy Export Options Modal Dialog
 *
 * Implements Phase 8 Workstream 4:
 * - Format selection: HTML (Standalone Document) vs JSON (Machine-Readable).
 * - URL scope configuration: Full Sanitized vs Path Only vs Hostname Only.
 * - HTML excerpt inclusion toggle (privacy-safe default: false).
 * - Remediation code guidance toggle (default: true).
 * - Live URL and summary preview before export.
 * - Full WCAG 2.2 AA modal accessibility: focus trap, Escape key, screen-reader announcements.
 * - Zero-permission browser-native download dispatch.
 */

import { useState, useEffect, useRef, useId, useMemo } from 'react';
import {
  Download,
  X,
  FileCode,
  FileText,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import type { ScanRecord } from '@/domain/scan';
import type { ExportReportOptions, UrlRedactionLevel } from '@/domain/report';
import type { RemediationStoragePayload } from '@/domain/remediation';
import { Button } from '@/components/shared';
import { exportReportToHtml } from '../html-generator';
import { exportReportToJson, redactUrl } from '../report-redactor';
import { downloadReportBlob, generateReportFilename } from '../download-report';
import { sanitizeUrlForStorage } from '@/lib/storage';
import { logSafeError } from '@/lib/logger';

export interface ExportReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  scan: ScanRecord | null;
  triggerRef?: React.RefObject<HTMLElement | null>;
  remediationRecords?: RemediationStoragePayload;
}

export function ExportReportDialog({
  isOpen,
  onClose,
  scan,
  triggerRef,
  remediationRecords,
}: ExportReportDialogProps) {
  const titleId = useId();
  const descId = useId();

  // Dialog State
  const [format, setFormat] = useState<'html' | 'json'>('html');
  const [urlRedactionLevel, setUrlRedactionLevel] = useState<UrlRedactionLevel>('full');
  const [includeHtmlExcerpts, setIncludeHtmlExcerpts] = useState<boolean>(false);
  const [includeRemediationGuidance, setIncludeRemediationGuidance] =
    useState<boolean>(true);

  // Export progress & announcement state
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string>('');

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const downloadButtonRef = useRef<HTMLButtonElement>(null);
  const isExportingRef = useRef<boolean>(false);

  // Compute live URL preview
  const liveUrlPreview = useMemo(() => {
    if (!scan) return '';
    try {
      const sanitized = sanitizeUrlForStorage(scan.tabUrl);
      return redactUrl(sanitized, urlRedactionLevel);
    } catch {
      return scan.hostname || 'unknown';
    }
  }, [scan, urlRedactionLevel]);

  // Focus management, reset on open, and Escape key handling
  useEffect(() => {
    if (!isOpen) {
      setIsExporting(false);
      setExportSuccess(false);
      setErrorMessage(null);
      isExportingRef.current = false;
      return;
    }

    // Reset options to canonical privacy-safe defaults upon open (DEF-844)
    setFormat('html');
    setUrlRedactionLevel('full');
    setIncludeHtmlExcerpts(false);
    setIncludeRemediationGuidance(true);
    setIsExporting(false);
    setExportSuccess(false);
    setErrorMessage(null);
    setAnnouncement('');
    isExportingRef.current = false;

    // Auto-focus download button or close button on open
    const focusTimer = setTimeout(() => {
      downloadButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Focus trapping inside modal (DEF-847)
      if (e.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const focusable = Array.from(focusableElements).filter(
          (el) =>
            !el.hasAttribute('disabled') &&
            (el.offsetParent !== null || el.style.display !== 'none')
        );

        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (!dialogRef.current.contains(document.activeElement)) {
          e.preventDefault();
          firstElement?.focus();
          return;
        }

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    const triggerEl = triggerRef?.current;

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to triggering button upon modal close
      triggerEl?.focus();
    };
  }, [isOpen, onClose, triggerRef, scan?.id]);

  if (!isOpen || !scan) return null;

  const handleExport = async () => {
    if (!scan || isExportingRef.current || isExporting) return;

    // Defense-in-depth: only successfully completed scans can be exported
    if (scan.status !== 'completed') {
      setErrorMessage('Only completed accessibility audits can be exported.');
      setAnnouncement('Export error: Scan is incomplete or failed.');
      return;
    }

    try {
      isExportingRef.current = true;
      setIsExporting(true);
      setErrorMessage(null);
      setAnnouncement('Preparing report with privacy redaction...');

      const options: ExportReportOptions = {
        format,
        urlRedactionLevel,
        includeHtmlExcerpts,
        includeRemediationGuidance,
      };

      const filename = generateReportFilename(scan, format);

      // Brief tick to allow UI to announce state to assistive technology
      await new Promise((resolve) => setTimeout(resolve, 60));

      if (format === 'html') {
        const html = exportReportToHtml(scan, options, remediationRecords);
        downloadReportBlob(html, filename, 'html');
      } else {
        const json = exportReportToJson(scan, options, remediationRecords);
        downloadReportBlob(json, filename, 'json');
      }

      setExportSuccess(true);
      setAnnouncement(`Report download initiated in browser: ${filename}`);

      // Auto close dialog cleanly after feedback
      setTimeout(() => {
        isExportingRef.current = false;
        onClose();
      }, 1000);
    } catch (err) {
      logSafeError('Report export', err);
      const msg = err instanceof Error ? err.message : 'Report generation failed';
      setErrorMessage(msg);
      setAnnouncement(`Export error: ${msg}`);
      setIsExporting(false);
      isExportingRef.current = false;
    }
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-surface-raised border border-purple-500/50 shadow-2xl p-6 space-y-6 text-sm text-gray-200"
      >
        {/* Screen Reader Live Region */}
        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border-subtle pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-900/40 text-purple-300 border border-purple-600/40 shadow-inner">
              <Download className="w-6 h-6 text-spectral-accent" aria-hidden="true" />
            </div>
            <div>
              <h2 id={titleId} className="text-lg font-bold text-white font-display">
                Export Accessibility Report
              </h2>
              <p id={descId} className="text-xs text-gray-400">
                Configure privacy redaction and download an offline report for{' '}
                <span className="font-semibold text-gray-300">{scan.hostname}</span>.
              </p>
            </div>
          </div>
          <Button
            ref={closeButtonRef}
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close Export Dialog"
            disabled={isExporting}
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </Button>
        </div>

        {/* Format Selection */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-bold uppercase tracking-wider text-purple-300">
            1. Report Format
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                format === 'html'
                  ? 'bg-purple-950/60 border-purple-500 text-white shadow-md'
                  : 'bg-surface border-border-default text-gray-300 hover:border-gray-500'
              }`}
            >
              <input
                type="radio"
                name="export-format"
                value="html"
                checked={format === 'html'}
                onChange={() => setFormat('html')}
                className="mt-1 accent-purple-500"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-sm">
                  <FileText className="w-4 h-4 text-cyan-400" aria-hidden="true" />
                  <span>HTML Document</span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Standalone, 100% offline document with Gothic mansion theme, executive
                  summaries, and print styling.
                </p>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                format === 'json'
                  ? 'bg-purple-950/60 border-purple-500 text-white shadow-md'
                  : 'bg-surface border-border-default text-gray-300 hover:border-gray-500'
              }`}
            >
              <input
                type="radio"
                name="export-format"
                value="json"
                checked={format === 'json'}
                onChange={() => setFormat('json')}
                className="mt-1 accent-purple-500"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-sm">
                  <FileCode className="w-4 h-4 text-purple-400" aria-hidden="true" />
                  <span>JSON Payload</span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Deterministic, schema-versioned v1.0.0 JSON export for CI/CD pipelines
                  and external tooling.
                </p>
              </div>
            </label>
          </div>
        </fieldset>

        {/* URL Scope Configuration */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-bold uppercase tracking-wider text-purple-300">
            2. Target URL Privacy Scope
          </legend>
          <div className="space-y-2">
            {[
              {
                id: 'full' as const,
                title: 'Full Sanitized URL',
                desc: 'Includes path and non-sensitive query parameters. Credentials and auth tokens are always scrubbed.',
              },
              {
                id: 'path-only' as const,
                title: 'Path Only',
                desc: 'Retains domain and path. Completely strips query strings and hash parameters.',
              },
              {
                id: 'hostname-only' as const,
                title: 'Hostname Only',
                desc: 'Maximum privacy: strips all paths and query parameters, exporting only the origin.',
              },
            ].map((scope) => (
              <label
                key={scope.id}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  urlRedactionLevel === scope.id
                    ? 'bg-purple-950/40 border-purple-500 text-white'
                    : 'bg-surface border-border-subtle text-gray-300 hover:border-gray-500'
                }`}
              >
                <input
                  type="radio"
                  name="url-scope"
                  value={scope.id}
                  checked={urlRedactionLevel === scope.id}
                  onChange={() => setUrlRedactionLevel(scope.id)}
                  className="mt-0.5 accent-purple-500"
                />
                <div className="space-y-0.5">
                  <span className="font-semibold text-xs text-gray-200">
                    {scope.title}
                  </span>
                  <p className="text-xs text-gray-400">{scope.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Live URL Preview */}
          <div className="p-2.5 rounded-lg bg-surface border border-border-subtle flex items-center gap-2 text-xs">
            <span className="text-gray-400 font-semibold uppercase text-[10px] shrink-0">
              URL in Report:
            </span>
            <code className="text-cyan-300 font-mono truncate">{liveUrlPreview}</code>
          </div>
        </fieldset>

        {/* Excerpts & Remediation Privacy Checkboxes */}
        <fieldset className="space-y-3">
          <legend className="text-xs font-bold uppercase tracking-wider text-purple-300">
            3. Privacy & Content Options
          </legend>

          <label className="flex items-start gap-3 p-3 rounded-lg bg-surface border border-border-subtle cursor-pointer hover:border-gray-500 transition-colors">
            <input
              type="checkbox"
              checked={includeHtmlExcerpts}
              onChange={(e) => setIncludeHtmlExcerpts(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-purple-500 rounded"
            />
            <div className="space-y-0.5">
              <span className="font-semibold text-xs text-gray-200">
                Include HTML DOM Excerpts
              </span>
              <p className="text-xs text-gray-400">
                Provides code context for developer review. Omitted by default when
                sharing reports with external clients.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-lg bg-surface border border-border-subtle cursor-pointer hover:border-gray-500 transition-colors">
            <input
              type="checkbox"
              checked={includeRemediationGuidance}
              onChange={(e) => setIncludeRemediationGuidance(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-purple-500 rounded"
            />
            <div className="space-y-0.5">
              <span className="font-semibold text-xs text-gray-200">
                Include Remediation Code Guidance & Auditor Notes
              </span>
              <p className="text-xs text-gray-400">
                Includes recommended code snippets, verification techniques, and recorded
                remediation statuses.
              </p>
            </div>
          </label>
        </fieldset>

        {/* Mandatory Security & Disclaimers Banner */}
        <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-800/40 flex items-start gap-3 text-xs text-purple-200">
          <Shield
            className="w-5 h-5 text-spectral-accent shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <span className="font-bold text-white block">
              Automated Redaction Guarantee
            </span>
            <p className="leading-relaxed text-gray-300 text-[11px]">
              Authentication tokens (`token`, `auth`, `api_key`), basic auth credentials
              (`user:pass@`), and OAuth fragments are permanently stripped from all
              exports. Reports represent automated diagnostics and do not constitute legal
              accessibility certification.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-red-950/60 border border-red-600/60 text-red-200 text-xs flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-border-subtle flex-wrap">
          <div className="text-xs text-gray-400">
            {scan.findings.length} finding{scan.findings.length !== 1 ? 's' : ''} in
            report
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isExporting}
            >
              Cancel
            </Button>

            <Button
              ref={downloadButtonRef}
              variant="primary"
              size="sm"
              onClick={handleExport}
              disabled={isExporting}
              className="min-w-[160px]"
            >
              {isExporting ? (
                <>
                  <Loader2
                    className="w-4 h-4 animate-spin text-white"
                    aria-hidden="true"
                  />
                  <span>Preparing...</span>
                </>
              ) : exportSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" aria-hidden="true" />
                  <span>Download Initiated</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" aria-hidden="true" />
                  <span>Download {format.toUpperCase()}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
