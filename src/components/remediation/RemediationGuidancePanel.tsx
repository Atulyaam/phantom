import { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  BookOpen,
  Info,
  Users,
  Wrench,
  RotateCcw,
  AlertOctagon,
} from 'lucide-react';
import type { FindingRecord } from '@/domain/finding';
import type { RemediationStatus } from '@/domain/remediation';
import { generateRemediationGuidance } from '@/features/remediation/guidance-engine';
import { CodeSnippetViewer } from './CodeSnippetViewer';
import { RemediationStatusBadge } from './RemediationStatusBadge';
import { VerificationChecklist } from './VerificationChecklist';

export interface RemediationGuidancePanelProps {
  finding: FindingRecord;
  remediationStatus: RemediationStatus;
  isRegression?: boolean;
  notes?: string;
  onStatusChange?: (newStatus: RemediationStatus, notes?: string) => Promise<void> | void;
  className?: string;
}

/**
 * RemediationGuidancePanel presents comprehensive remediation intelligence:
 * 1. Problem explanation
 * 2. Why the issue matters (human impacts)
 * 3. Rule classification & WCAG criterion
 * 4. Root cause analysis
 * 5. Bad example anti-pattern
 * 6. Accessible good code patterns (HTML, React, CSS)
 * 7. Potential pitfalls & side effects
 * 8. Verification checklist
 * 9. Official documentation links
 * 10. Lifecycle status controls (Mark Attempted / Reset Suggested)
 */
export function RemediationGuidancePanel({
  finding,
  remediationStatus,
  isRegression = false,
  notes = '',
  onStatusChange,
  className = '',
}: RemediationGuidancePanelProps) {
  const [userNotes, setUserNotes] = useState(notes);
  const [isUpdating, setIsUpdating] = useState(false);

  // Synthesize context-aware remediation guidance
  const guidance = generateRemediationGuidance(finding);

  const handleMarkAttempted = async () => {
    if (isUpdating || remediationStatus === 'attempted') return;
    setIsUpdating(true);
    try {
      await onStatusChange?.('attempted', userNotes);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetSuggested = async () => {
    if (isUpdating || remediationStatus === 'suggested') return;
    setIsUpdating(true);
    try {
      await onStatusChange?.('suggested', userNotes);
    } finally {
      setIsUpdating(false);
    }
  };

  const isNormative = guidance.classification === 'normative-wcag';

  return (
    <div className={`space-y-5 ${className}`}>
      {/* ── Status & Lifecycle Action Header ── */}
      <div className="p-4 rounded-xl bg-surface-raised border border-border-default shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-medium">
                Remediation Lifecycle:
              </span>
              <RemediationStatusBadge
                status={remediationStatus}
                isRegression={isRegression}
              />
            </div>
            <p className="text-[11px] text-gray-400">
              {remediationStatus === 'suggested' &&
                'Review guidance below and draft fixes in your component codebase.'}
              {remediationStatus === 'attempted' &&
                'Fix drafted. Run rescan to verify resolution.'}
              {remediationStatus === 'verified' &&
                'Resolution certified by automated rescan comparison.'}
              {remediationStatus === 'unresolved' &&
                (isRegression
                  ? 'Regression detected: previously verified finding has reappeared.'
                  : 'Defect persisted upon rescan. Revisit implementation.')}
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {onStatusChange && (
              <>
                {remediationStatus !== 'attempted' && (
                  <button
                    type="button"
                    onClick={handleMarkAttempted}
                    disabled={isUpdating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-amber-600 hover:bg-amber-500 text-white transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50 shadow-sm"
                    aria-label="Mark finding remediation as attempted"
                  >
                    <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Mark as Attempted</span>
                  </button>
                )}

                {remediationStatus !== 'suggested' && (
                  <button
                    type="button"
                    onClick={handleResetSuggested}
                    disabled={isUpdating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-surface border border-border-default hover:bg-surface-overlay text-gray-200 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-50"
                    aria-label="Reset finding remediation status to suggested"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
                    <span>Reset to Suggested</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Regression Warning Callout */}
        {isRegression && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-rose-950/40 border border-rose-700/60 text-xs text-rose-200 flex items-start gap-2.5"
          >
            <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-semibold text-rose-300">Regression Detected</div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                This issue was previously verified resolved, but has resurfaced in the
                latest scan. Verified status was revoked and marked Unresolved.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Rule Classification & Conformance Banner ── */}
      <div
        className={`p-3.5 rounded-lg border flex items-start gap-3 ${
          isNormative
            ? 'bg-purple-950/40 border-purple-800/60 text-purple-200'
            : 'bg-blue-950/40 border-blue-800/60 text-blue-200'
        }`}
      >
        <BookOpen className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <strong className="font-semibold text-white">
              {isNormative ? 'Normative WCAG Failure' : 'Axe Advisory Best Practice'}
            </strong>
            {guidance.wcagLevel && (
              <span className="px-1.5 py-0.2 rounded bg-purple-900/60 border border-purple-700/60 text-[10px] font-mono">
                Level {guidance.wcagLevel}
              </span>
            )}
          </div>
          <p className="text-[11px] opacity-90 leading-relaxed">
            {guidance.wcagCriterion
              ? `Conformance Anchor: ${guidance.wcagCriterion}`
              : 'Conformance Anchor: Advisory Accessibility Heuristic'}
          </p>
        </div>
      </div>

      {/* ── Problem & Human Impact ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {/* Why it Matters */}
        <div className="p-3.5 rounded-lg bg-surface border border-border-subtle space-y-2">
          <h4 className="font-semibold text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
            Why It Matters
          </h4>
          <p className="text-gray-300 leading-relaxed">{guidance.whyItMatters}</p>
        </div>

        {/* Root Cause Analysis */}
        <div className="p-3.5 rounded-lg bg-surface border border-border-subtle space-y-2">
          <h4 className="font-semibold text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
            <AlertOctagon className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            Root Cause Analysis
          </h4>
          <p className="text-gray-300 leading-relaxed">{guidance.rootCauseAnalysis}</p>
        </div>
      </div>

      {/* ── Human Impact Details ── */}
      {guidance.humanImpacts && guidance.humanImpacts.length > 0 && (
        <div className="p-3.5 rounded-lg bg-surface border border-border-subtle space-y-2.5 text-xs">
          <h4 className="font-semibold text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-purple-400" aria-hidden="true" />
            Human User Impact
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {guidance.humanImpacts.map((impact, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded bg-base border border-border-subtle/80 space-y-1"
              >
                <span className="font-semibold text-cyan-300 block">
                  {impact.userGroup}
                </span>
                <p className="text-[11px] text-gray-300 leading-relaxed">
                  {impact.consequence}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Anti-Pattern (Bad Example) ── */}
      {guidance.badExample && (
        <div className="p-3.5 rounded-lg bg-red-950/20 border border-red-900/40 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-red-300 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" aria-hidden="true" />
              Anti-Pattern (Inaccessible Code)
            </h4>
            <span className="text-[10px] font-mono text-red-400 font-bold uppercase">
              Avoid This
            </span>
          </div>

          <pre className="p-2.5 rounded bg-base border border-red-950/80 font-mono text-[11px] text-red-200 overflow-x-auto whitespace-pre-wrap break-all">
            <code>{guidance.badExample.snippet}</code>
          </pre>

          <p className="text-[11px] text-red-300/90 leading-relaxed">
            <strong>Why this fails:</strong> {guidance.badExample.reason}
          </p>
        </div>
      )}

      {/* ── Accessible Good Solutions (Multi-Syntax Tabs) ── */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
          Recommended Accessible Solutions
        </h4>
        <CodeSnippetViewer snippets={guidance.goodExamples} />
      </div>

      {/* ── Potential Pitfalls / Side Effects ── */}
      {guidance.potentialPitfalls && guidance.potentialPitfalls.length > 0 && (
        <div className="p-3.5 rounded-lg bg-amber-950/20 border border-amber-900/40 space-y-2 text-xs">
          <h4 className="font-semibold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            Common Pitfalls & Side Effects
          </h4>
          <ul className="space-y-1.5 list-disc list-inside text-gray-300 leading-relaxed">
            {guidance.potentialPitfalls.map((pitfall, idx) => (
              <li key={idx} className="text-gray-300">
                <span>{pitfall}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Verification Testing Checklist ── */}
      <VerificationChecklist
        steps={guidance.verificationSteps}
        fingerprint={finding.fingerprint}
      />

      {/* ── User Notes Section ── */}
      {onStatusChange && (
        <div className="p-3.5 rounded-lg bg-surface border border-border-subtle space-y-2 text-xs">
          <label
            htmlFor={`notes-${finding.fingerprint}`}
            className="font-semibold text-gray-200 uppercase tracking-wider block"
          >
            Remediation Developer Notes (Optional, max 500 chars)
          </label>
          <textarea
            id={`notes-${finding.fingerprint}`}
            value={userNotes}
            onChange={(e) => setUserNotes(e.target.value.slice(0, 500))}
            placeholder="Add context on the applied fix, PR link, or design decision..."
            rows={2}
            className="w-full p-2 rounded bg-base border border-border-default text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-cyan-400 font-mono resize-none"
          />
          <div className="flex justify-between items-center text-[10px] text-gray-500 font-mono">
            <span>Notes are persisted locally alongside remediation status.</span>
            <span>{userNotes.length}/500</span>
          </div>
        </div>
      )}

      {/* ── Official Documentation Links ── */}
      {guidance.officialDocUrl && (
        <div className="pt-2 flex items-center justify-between text-xs">
          <a
            href={guidance.officialDocUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
          >
            <span>Deque University axe-core Rule Documentation</span>
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        </div>
      )}
    </div>
  );
}
