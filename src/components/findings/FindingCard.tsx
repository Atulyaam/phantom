import { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Code,
  Copy,
  Check,
  CheckCircle2,
  Circle,
  EyeOff,
  AlertTriangle,
  HelpCircle,
  MinusCircle,
} from 'lucide-react';
import type { FindingRecord, ComparisonCategory } from '@/domain/finding';
import type { RemediationStatus } from '@/domain/remediation';
import { SeverityBadge, Badge } from '@/components/shared';
import { RemediationStatusBadge } from '@/components/remediation';
import { remediationTracker } from '@/features/remediation';
import { isAdvisoryFinding } from '@/features/findings/finding-filters';

interface FindingCardProps {
  finding: FindingRecord;
  remediationStatus?: RemediationStatus;
  isRegression?: boolean;
  comparisonCategory?: ComparisonCategory;
  uncertainReason?: string;
  onSelectForInspection?: (finding: FindingRecord) => void;
  onToggleReviewed?: (finding: FindingRecord) => void;
  isDemo?: boolean;
}

/**
 * FindingCard component representing an individual accessibility issue.
 * Supports title, ruleId, severity badge, affected node count,
 * expandable failure summary, copy selector button, review toggle,
 * remediation status badge, regression indicator, and link to full inspector.
 *
 * All HTML snippets are rendered as escaped text — NEVER dangerouslySetInnerHTML.
 */
export function FindingCard({
  finding,
  remediationStatus,
  isRegression = false,
  comparisonCategory,
  uncertainReason,
  onSelectForInspection,
  onToggleReviewed,
  isDemo = false,
}: FindingCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);
  const [status, setStatus] = useState<RemediationStatus>(
    remediationStatus || 'suggested'
  );
  const [isRegressionState, setIsRegressionState] = useState<boolean>(isRegression);

  const effectiveCategory = comparisonCategory || finding.comparisonCategory;
  const effectiveUncertainReason = uncertainReason || finding.uncertainReason;

  useEffect(() => {
    if (remediationStatus !== undefined) {
      setStatus(remediationStatus);
      setIsRegressionState(Boolean(isRegression));
      return;
    }
    let isMounted = true;
    remediationTracker.getFindingRecord(finding.fingerprint).then((rec) => {
      if (isMounted) {
        setStatus(rec?.status || 'suggested');
        setIsRegressionState(Boolean(rec?.isRegression));
      }
    });
    return () => {
      isMounted = false;
    };
  }, [finding.fingerprint, remediationStatus, isRegression]);

  const isAdvisory = isAdvisoryFinding(finding);

  const handleCopySelector = async (selector: string, key = 'primary') => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(selector);
      }
    } catch {
      // Fallback or ignore clipboard failure
    }
    setCopiedTarget(key);
    setTimeout(() => setCopiedTarget(null), 2000);
  };

  const primarySelector = finding.nodes?.[0]?.target?.join(' ') || '';

  return (
    <article
      className={`p-4 rounded-xl bg-surface border transition-colors shadow-sm space-y-3 ${
        finding.reviewed
          ? 'border-emerald-800/40 opacity-90'
          : 'border-border-default hover:border-purple-800/60'
      }`}
      data-rule-id={finding.ruleId}
      data-fingerprint={finding.fingerprint}
    >
      {/* Header: Rule + Severity + Affected count + Review Toggle */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-semibold text-purple-300">
              {finding.ruleId}
            </span>
            <SeverityBadge impact={finding.impact} />
            {isDemo && <Badge variant="warning">DEMO</Badge>}
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
            <RemediationStatusBadge
              status={status}
              isRegression={isRegressionState}
              size="sm"
            />
            {effectiveCategory === 'verified-fix' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-950/70 text-emerald-300 border border-emerald-600/50 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                <span>Verified Fix</span>
              </span>
            )}
            {effectiveCategory === 'disappeared' && (
              <span
                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-950/70 text-amber-300 border border-amber-600/50 flex items-center gap-1"
                title="Absent from target scan without authoritative verification record"
              >
                <EyeOff className="w-3 h-3 text-amber-400" aria-hidden="true" />
                <span>Disappeared (Unverified)</span>
              </span>
            )}
            {effectiveCategory === 'unchanged' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-gray-900/80 text-gray-300 border border-gray-700/60 flex items-center gap-1">
                <MinusCircle className="w-3 h-3 text-gray-400" aria-hidden="true" />
                <span>Unchanged</span>
              </span>
            )}
            {effectiveCategory === 'new' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-950/70 text-rose-300 border border-rose-600/50 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-400" aria-hidden="true" />
                <span>New Issue</span>
              </span>
            )}
            {effectiveCategory === 'uncertain' && (
              <span
                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-950/70 text-purple-300 border border-purple-600/50 flex items-center gap-1"
                title={effectiveUncertainReason || 'Selector path shifted'}
              >
                <HelpCircle className="w-3 h-3 text-purple-400" aria-hidden="true" />
                <span>Uncertain Match</span>
              </span>
            )}
          </div>
          <h4 className="text-sm font-semibold text-white leading-snug">
            {finding.help}
          </h4>
          {effectiveUncertainReason && (
            <div className="p-2 rounded bg-purple-950/30 border border-purple-800/40 text-[11px] text-purple-200/90 flex items-start gap-1.5 mt-1">
              <HelpCircle
                className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{effectiveUncertainReason}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onToggleReviewed && (
            <button
              type="button"
              onClick={() => onToggleReviewed(finding)}
              aria-label={
                finding.reviewed
                  ? `Mark ${finding.ruleId} as unreviewed`
                  : `Mark ${finding.ruleId} as reviewed`
              }
              aria-pressed={finding.reviewed}
              className={`p-1.5 rounded border text-xs transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                finding.reviewed
                  ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/40'
                  : 'bg-surface-raised border-border-default text-gray-400 hover:text-gray-200'
              }`}
              title={finding.reviewed ? 'Mark as unreviewed' : 'Mark as reviewed'}
            >
              {finding.reviewed ? (
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Circle className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          )}

          <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-raised border border-border-subtle text-gray-300">
            {finding.affectedNodeCount} node{finding.affectedNodeCount !== 1 ? 's' : ''}
            {finding.affectedNodeCount > finding.nodes.length ? ' (first 20)' : ''}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-400 leading-relaxed">{finding.description}</p>

      {/* WCAG Tags & Copy Selector Action */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
        <div className="flex flex-wrap gap-1">
          {finding.wcagTags.map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded bg-surface-raised border border-border-subtle text-[10px] font-mono text-gray-400"
            >
              {tag}
            </span>
          ))}
        </div>

        {primarySelector && (
          <button
            type="button"
            onClick={() => handleCopySelector(primarySelector, 'primary')}
            aria-label={
              copiedTarget === 'primary'
                ? 'Selector copied'
                : 'Copy Selector: CSS element selector'
            }
            className="text-[11px] text-gray-300 hover:text-white flex items-center gap-1 font-mono px-2 py-0.5 rounded bg-surface-raised border border-border-subtle hover:border-purple-600 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            {copiedTarget === 'primary' ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-purple-400" aria-hidden="true" />
                <span>Copy Selector</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Expand/Collapse Toggle for Failure Details */}
      <div className="pt-2 border-t border-border-subtle flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          className="text-xs text-purple-300 hover:text-purple-200 flex items-center gap-1 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 rounded px-1"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Hide Details</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Show Details ({finding.nodes.length} targets)</span>
            </>
          )}
        </button>

        {onSelectForInspection && (
          <button
            type="button"
            onClick={() => onSelectForInspection(finding)}
            aria-label={`Inspect finding details for ${finding.ruleId}`}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 rounded px-1.5 py-0.5 bg-cyan-950/40 border border-cyan-800/40"
          >
            <span>Inspect</span>
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Expanded Node Details */}
      {isExpanded && (
        <div className="space-y-3 pt-2">
          {finding.nodes.map((node, idx) => {
            const selectorStr = node.target.join(' ');
            const isNodeCopied = copiedTarget === `node-${idx}`;

            return (
              <div
                key={idx}
                className="p-3 rounded-lg bg-surface-raised border border-border-subtle space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-gray-400 font-mono text-[11px] truncate">
                    <Code
                      className="w-3.5 h-3.5 text-purple-400 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="truncate">{selectorStr}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopySelector(selectorStr, `node-${idx}`)}
                    aria-label={`Copy selector for element ${idx + 1}`}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border-subtle text-gray-300 hover:text-white shrink-0 flex items-center gap-1"
                  >
                    {isNodeCopied ? (
                      <>
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-2.5 h-2.5 text-purple-400" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Escaped HTML snippet — NEVER dangerouslySetInnerHTML */}
                <pre className="p-2 rounded bg-base border border-border-subtle text-[11px] font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap break-all">
                  <code>{node.htmlExcerpt}</code>
                </pre>

                <p className="text-[11px] text-red-300/90 leading-relaxed">
                  {node.failureSummary}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
