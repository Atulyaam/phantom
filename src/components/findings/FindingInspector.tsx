import { useState, useEffect } from 'react';
import {
  X,
  Code,
  Tag,
  Clock,
  Copy,
  Check,
  CheckCircle2,
  Circle,
  Compass,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';
import type { FindingRecord, WcagPrinciple } from '@/domain/finding';
import type { RemediationStatus } from '@/domain/remediation';
import { SeverityBadge, Badge, Button } from '@/components/shared';
import {
  RemediationGuidancePanel,
  RemediationStatusBadge,
} from '@/components/remediation';
import { remediationTracker } from '@/features/remediation';
import { mapRuleToPrinciple } from '@/features/findings/finding-aggregation';
import { isAdvisoryFinding } from '@/features/findings/finding-filters';

interface FindingInspectorProps {
  finding: FindingRecord;
  onClose: () => void;
  onToggleReviewed?: (finding: FindingRecord) => void;
  isDemo?: boolean;
  isHistorical?: boolean;
  isComparison?: boolean;
  onRemediationStatusChange?: (fingerprint: string, status: RemediationStatus) => void;
}

const PRINCIPLE_LABELS: Record<
  WcagPrinciple,
  { name: string; description: string; color: string }
> = {
  perceivable: {
    name: 'Principle 1: Perceivable',
    description:
      'Information and user interface components must be presentable to users in ways they can perceive.',
    color: 'text-sky-300 border-sky-800/50 bg-sky-950/30',
  },
  operable: {
    name: 'Principle 2: Operable',
    description:
      'User interface components and navigation must be operable via keyboard and accessible mechanisms.',
    color: 'text-amber-300 border-amber-800/50 bg-amber-950/30',
  },
  understandable: {
    name: 'Principle 3: Understandable',
    description:
      'Information and the operation of user interface must be understandable and predictable.',
    color: 'text-emerald-300 border-emerald-800/50 bg-emerald-950/30',
  },
  robust: {
    name: 'Principle 4: Robust',
    description:
      'Content must be robust enough that it can be interpreted reliably by a wide variety of user agents, including assistive technologies.',
    color: 'text-purple-300 border-purple-800/50 bg-purple-950/30',
  },
  'best-practice': {
    name: 'Advisory Best Practice',
    description:
      'Recommended accessibility practice that exceeds or supplements formal WCAG 2.2 A/AA success criteria.',
    color: 'text-blue-300 border-blue-800/50 bg-blue-950/30',
  },
};

/**
 * FindingInspector provides a detailed view of a selected finding.
 * Shows title, WCAG reference, impact, full explanation, affected element targets,
 * safe escaped HTML snippet, and remediation guidance.
 *
 * SECURITY: All HTML snippets are rendered strictly as escaped text via <pre><code>.
 * Never uses dangerouslySetInnerHTML.
 */
export function FindingInspector({
  finding,
  onClose,
  onToggleReviewed,
  isDemo = false,
  isHistorical = false,
  isComparison = false,
  onRemediationStatusChange,
}: FindingInspectorProps) {
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);
  const [remediationStatus, setRemediationStatus] =
    useState<RemediationStatus>('suggested');
  const [remediationNotes, setRemediationNotes] = useState<string>('');
  const [isRegression, setIsRegression] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    remediationTracker.getFindingRecord(finding.fingerprint).then((record) => {
      if (isMounted) {
        setRemediationStatus(record?.status || 'suggested');
        setRemediationNotes(record?.notes || '');
        setIsRegression(Boolean(record?.isRegression));
      }
    });
    return () => {
      isMounted = false;
    };
  }, [finding.fingerprint]);

  const handleStatusChange = async (newStatus: RemediationStatus, notes?: string) => {
    try {
      if (newStatus === 'attempted') {
        const updated = await remediationTracker.markAttempted(
          finding.fingerprint,
          notes
        );
        setRemediationStatus(updated.status);
        setRemediationNotes(updated.notes || '');
        onRemediationStatusChange?.(finding.fingerprint, updated.status);
      } else if (newStatus === 'suggested') {
        const updated = await remediationTracker.resetToSuggested(
          finding.fingerprint,
          notes
        );
        setRemediationStatus(updated.status);
        setRemediationNotes(updated.notes || '');
        onRemediationStatusChange?.(finding.fingerprint, updated.status);
      }
    } catch {
      // Graceful error handling
    }
  };

  const principleKey = mapRuleToPrinciple(finding.ruleId, finding.wcagTags);
  const principleMeta =
    PRINCIPLE_LABELS[principleKey] || PRINCIPLE_LABELS['understandable'];
  const isAdvisory = isAdvisoryFinding(finding);

  const handleCopy = async (text: string, key: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // Ignore clipboard error
    }
    setCopiedTarget(key);
    setTimeout(() => setCopiedTarget(null), 2000);
  };

  return (
    <aside
      aria-labelledby="inspector-heading"
      className="p-6 rounded-xl bg-surface-raised border border-purple-500/40 shadow-glow space-y-5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-purple-300">
              {finding.ruleId}
            </span>
            <SeverityBadge impact={finding.impact} />
            <RemediationStatusBadge
              status={remediationStatus}
              isRegression={isRegression}
            />
            {isDemo && <Badge variant="warning">DEMO DATA</Badge>}
            {isAdvisory ? (
              <Badge variant="info">ADVISORY</Badge>
            ) : (
              <span className="px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-700/50 text-[10px] font-mono text-purple-200">
                WCAG
              </span>
            )}
            {finding.reviewed && (
              <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/50 text-[10px] font-medium text-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                <span>Reviewed</span>
              </span>
            )}
            {isHistorical && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/70 text-amber-300 border border-amber-600/50 uppercase tracking-wider flex items-center gap-1">
                Historical Snapshot
              </span>
            )}
            {isComparison && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950/70 text-purple-300 border border-purple-600/50 uppercase tracking-wider flex items-center gap-1">
                Comparison Diff
              </span>
            )}
            {finding.comparisonCategory && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-surface-raised border border-border-default text-gray-200">
                {finding.comparisonCategory.replace('-', ' ')}
              </span>
            )}
          </div>
          <h3
            id="inspector-heading"
            className="text-base font-bold text-white font-display"
          >
            {finding.help}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {onToggleReviewed && (
            <Button
              variant={finding.reviewed ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => onToggleReviewed(finding)}
              aria-pressed={finding.reviewed}
              className="text-xs"
            >
              {finding.reviewed ? (
                <>
                  <CheckCircle2
                    className="w-3.5 h-3.5 mr-1 text-emerald-400"
                    aria-hidden="true"
                  />
                  <span>Mark Unreviewed</span>
                </>
              ) : (
                <>
                  <Circle className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                  <span>Mark as Reviewed</span>
                </>
              )}
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close Finding Inspector"
          >
            <X className="w-4 h-4" aria-hidden="true" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </div>

      {/* WCAG Principle Banner */}
      <div
        className={`p-3 rounded-lg border flex items-start gap-3 ${principleMeta.color}`}
      >
        <Compass className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="space-y-0.5 text-xs">
          <span className="font-semibold">{principleMeta.name}</span>
          <p className="text-[11px] opacity-90 leading-relaxed">
            {principleMeta.description}
          </p>
        </div>
      </div>

      {/* Description & Impact Summary */}
      <div className="p-3.5 rounded-lg bg-surface border border-border-subtle space-y-2">
        <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
          Problem Summary
        </h4>
        <p className="text-xs text-gray-300 leading-relaxed">{finding.description}</p>
      </div>

      {/* Uncertain Match Notice (Selector Drift / Heuristic Match) */}
      {finding.uncertainReason && (
        <div
          role="note"
          aria-label="Uncertain match explanation"
          className="p-3.5 rounded-lg bg-purple-950/40 border border-purple-600/50 text-xs text-purple-200 space-y-1"
        >
          <div className="flex items-center gap-2 text-purple-300 font-semibold">
            <HelpCircle className="w-4 h-4 text-purple-400 shrink-0" aria-hidden="true" />
            <span>Uncertain Match (Selector Drift Detected)</span>
          </div>
          <p className="text-[11px] text-purple-200/90 leading-relaxed pl-6">
            {finding.uncertainReason}
          </p>
        </div>
      )}

      {/* Interactive Remediation Guidance Intelligence */}
      <section aria-labelledby="remediation-guidance-heading" className="space-y-3">
        <h4
          id="remediation-guidance-heading"
          className="text-xs font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-1.5"
        >
          <ShieldCheck className="w-4 h-4 text-purple-400" aria-hidden="true" />
          Remediation Guidance
        </h4>
        <RemediationGuidancePanel
          finding={finding}
          remediationStatus={remediationStatus}
          isRegression={isRegression}
          notes={remediationNotes}
          onStatusChange={isHistorical || isComparison ? undefined : handleStatusChange}
        />
      </section>

      {/* Affected Elements List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
            <Code className="w-4 h-4 text-cyan-400" aria-hidden="true" />
            Affected Elements ({finding.nodes.length}
            {finding.affectedNodeCount > finding.nodes.length
              ? ` of ${finding.affectedNodeCount}`
              : ''}
            )
          </h4>
          {finding.affectedNodeCount > finding.nodes.length && (
            <span className="text-[10px] text-amber-300 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded">
              Truncated to first {finding.nodes.length} nodes for performance
            </span>
          )}
        </div>

        {finding.nodes.map((node, idx) => {
          const selectorStr = node.target.join(' ');
          const isSelectorCopied = copiedTarget === `target-${idx}`;
          const isExcerptCopied = copiedTarget === `excerpt-${idx}`;

          return (
            <div
              key={idx}
              className="p-3.5 rounded-lg bg-surface border border-border-subtle space-y-2.5 text-xs"
            >
              {/* Target Selector + Copy Action */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-gray-400 font-mono text-[11px] truncate">
                  <span className="text-purple-400 font-bold">#{idx + 1}</span>
                  <span className="truncate">{selectorStr}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCopy(selectorStr, `target-${idx}`)}
                    aria-label={`Copy selector for element ${idx + 1}`}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-raised border border-border-subtle text-gray-300 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    {isSelectorCopied ? (
                      <>
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-2.5 h-2.5 text-purple-400" />
                        <span>Copy Selector</span>
                      </>
                    )}
                  </button>

                  {node.htmlExcerpt && (
                    <button
                      type="button"
                      onClick={() => handleCopy(node.htmlExcerpt, `excerpt-${idx}`)}
                      aria-label={`Copy HTML snippet for element ${idx + 1}`}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-raised border border-border-subtle text-gray-300 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      {isExcerptCopied ? (
                        <>
                          <Check className="w-2.5 h-2.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Code className="w-2.5 h-2.5 text-cyan-400" />
                          <span>Copy HTML</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Escaped HTML Excerpt */}
              <div className="space-y-1">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                  Source HTML Excerpt:
                </span>
                <pre className="p-2.5 rounded bg-base border border-border-subtle text-[11px] font-mono text-gray-200 overflow-x-auto whitespace-pre-wrap break-all">
                  <code>{node.htmlExcerpt}</code>
                </pre>
              </div>

              {/* Failure Summary */}
              <div className="space-y-1">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                  Failure Reason:
                </span>
                <p className="text-[11px] text-red-300/90 leading-relaxed">
                  {node.failureSummary}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Metadata Footer */}
      <div className="pt-3 border-t border-border-subtle flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-400">
        <div className="flex items-center gap-2 flex-wrap">
          <Tag className="w-3 h-3 text-gray-500" aria-hidden="true" />
          {finding.wcagTags.some((t) => t.startsWith('wcag')) && (
            <span>
              WCAG: {finding.wcagTags.filter((t) => t.startsWith('wcag')).join(', ')}
            </span>
          )}
          {isAdvisory && (
            <span className="px-1.5 py-0.5 rounded bg-blue-950/40 border border-blue-800/40 text-[10px] text-blue-300 font-semibold uppercase">
              Advisory Best Practice
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-gray-500" aria-hidden="true" />
          <span>First seen: {new Date(finding.firstSeenAt).toLocaleDateString()}</span>
        </div>
      </div>
    </aside>
  );
}
