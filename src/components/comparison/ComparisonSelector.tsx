import { useState, useId, useMemo, useEffect } from 'react';
import { GitCompare, ArrowRightLeft, AlertCircle, Play, Info } from 'lucide-react';
import type { ScanSummary } from '@/domain/scan';
import { normalizeUrlForComparison } from '@/features/comparison/scan-comparator';

export interface ComparisonSelectorProps {
  summaries: ScanSummary[];
  initialBaselineId?: string | null;
  initialTargetId?: string | null;
  onCompare: (baselineId: string, targetId: string) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

/**
 * Format a scan summary into a concise, readable string for dropdown options.
 */
function formatScanLabel(summary: ScanSummary): string {
  const title = summary.pageTitle || 'Untitled Page';
  const dateStr = !Number.isNaN(Date.parse(summary.scannedAt))
    ? new Date(summary.scannedAt).toLocaleString(undefined, {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : summary.scannedAt;
  const issues = `${summary.totalFindings} issue${summary.totalFindings !== 1 ? 's' : ''}`;
  const status =
    summary.status !== 'completed' ? ` [${summary.status.toUpperCase()}]` : '';

  return `${title} (${summary.hostname}) — ${dateStr} — ${issues}${status}`;
}

/**
 * ComparisonSelector allows users to select a baseline (before) and target (after)
 * scan snapshot from local history to perform an arbitrary cross-scan comparison.
 */
export function ComparisonSelector({
  summaries,
  initialBaselineId,
  initialTargetId,
  onCompare,
  onCancel,
  isLoading = false,
}: ComparisonSelectorProps) {
  const baselineSelectId = useId();
  const targetSelectId = useId();

  // Pick initial default selections
  const defaultBaseline = useMemo(() => {
    if (initialBaselineId && summaries.some((s) => s.id === initialBaselineId)) {
      return initialBaselineId;
    }
    // If at least 2 summaries, pick the second newest as baseline (before)
    if (summaries.length >= 2 && summaries[1]) {
      return summaries[1].id;
    }
    return summaries[0]?.id || '';
  }, [initialBaselineId, summaries]);

  const defaultTarget = useMemo(() => {
    if (initialTargetId && summaries.some((s) => s.id === initialTargetId)) {
      return initialTargetId;
    }
    // Pick the newest summary as target (after)
    if (summaries.length >= 2 && summaries[0] && summaries[1]) {
      // If defaultBaseline is already summaries[0].id, pick summaries[1].id
      return defaultBaseline === summaries[0].id ? summaries[1].id : summaries[0].id;
    }
    return summaries[0]?.id || '';
  }, [initialTargetId, summaries, defaultBaseline]);

  const [baselineId, setBaselineId] = useState<string>(defaultBaseline);
  const [targetId, setTargetId] = useState<string>(defaultTarget);

  // Sync baselineId when initialBaselineId prop changes and exists
  useEffect(() => {
    if (initialBaselineId && summaries.some((s) => s.id === initialBaselineId)) {
      setBaselineId(initialBaselineId);
    }
  }, [initialBaselineId, summaries]);

  // Sync targetId when initialTargetId prop changes and exists
  useEffect(() => {
    if (initialTargetId && summaries.some((s) => s.id === initialTargetId)) {
      setTargetId(initialTargetId);
    }
  }, [initialTargetId, summaries]);

  // Defensive recovery if selected snapshots are deleted from storage/summaries
  useEffect(() => {
    if (summaries.length >= 2) {
      if (!summaries.some((s) => s.id === baselineId)) {
        setBaselineId(defaultBaseline);
      }
      if (!summaries.some((s) => s.id === targetId)) {
        setTargetId(defaultTarget);
      }
    }
  }, [summaries, baselineId, targetId, defaultBaseline, defaultTarget]);

  const baselineSummary = summaries.find((s) => s.id === baselineId);
  const targetSummary = summaries.find((s) => s.id === targetId);

  const isSameSnapshot = Boolean(baselineId && targetId && baselineId === targetId);
  const isSelectionIncomplete =
    !baselineId ||
    !targetId ||
    !summaries.some((s) => s.id === baselineId) ||
    !summaries.some((s) => s.id === targetId);
  const isDifferentUrl = Boolean(
    baselineSummary &&
    targetSummary &&
    normalizeUrlForComparison(baselineSummary.tabUrl) !==
      normalizeUrlForComparison(targetSummary.tabUrl)
  );

  const handleSwap = () => {
    setBaselineId(targetId);
    setTargetId(baselineId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSameSnapshot || isSelectionIncomplete || isLoading) return;
    onCompare(baselineId, targetId);
  };

  // If fewer than 2 snapshots exist in archive
  if (summaries.length < 2) {
    return (
      <div
        role="region"
        aria-label="Comparison requirements notice"
        className="py-12 px-6 text-center space-y-4 max-w-md mx-auto"
      >
        <div className="w-12 h-12 rounded-full bg-purple-950/60 border border-purple-800/40 text-purple-300 flex items-center justify-center mx-auto">
          <GitCompare className="w-6 h-6 text-purple-400" aria-hidden="true" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-gray-200 font-display">
            Insufficient Hauntings for Comparison
          </h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            Cross-scan comparison requires at least <strong>two</strong> saved scan
            snapshots. Run additional accessibility audits or preserve snapshots in the
            archive to compare remediation progress across audits.
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-1.5 text-xs rounded-lg bg-surface-raised border border-border-default text-gray-300 hover:text-white hover:bg-surface-overlay transition-colors"
          >
            Back to Archive
          </button>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 space-y-5"
      aria-label="Compare scan snapshots"
    >
      {/* Introduction */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-white font-display flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-purple-400" aria-hidden="true" />
          <span>Cross-Scan Comparison Engine</span>
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          Select any baseline (before) snapshot and target (after) snapshot to compute
          verified fixes, disappeared findings, regressions, and uncertain element
          matches.
        </p>
      </div>

      {/* Selectors Card */}
      <div className="p-4 rounded-xl bg-surface/70 border border-border-default space-y-4">
        {/* Baseline (Before) Selection */}
        <div className="space-y-1.5">
          <label
            htmlFor={baselineSelectId}
            className="block text-xs font-semibold text-gray-200"
          >
            Baseline Haunting (Before)
          </label>
          <select
            id={baselineSelectId}
            value={baselineId}
            onChange={(e) => setBaselineId(e.target.value)}
            className="w-full px-3 py-2 bg-base border border-border-default rounded-lg text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-shadow"
          >
            {summaries.map((s) => (
              <option key={s.id} value={s.id}>
                {formatScanLabel(s)}
              </option>
            ))}
          </select>
          {baselineSummary && (
            <div className="text-[11px] text-gray-400 font-mono truncate px-1">
              URL: {baselineSummary.tabUrl} • {baselineSummary.totalFindings} violations
            </div>
          )}
        </div>

        {/* Swap Button */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={handleSwap}
            aria-label="Swap baseline and target snapshots"
            title="Swap baseline and target"
            className="p-1.5 rounded-full bg-purple-950/60 border border-purple-800/40 text-purple-300 hover:text-white hover:bg-purple-900/60 transition-colors focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            <ArrowRightLeft className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Target (After) Selection */}
        <div className="space-y-1.5">
          <label
            htmlFor={targetSelectId}
            className="block text-xs font-semibold text-gray-200"
          >
            Target Haunting (After / Rescan)
          </label>
          <select
            id={targetSelectId}
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="w-full px-3 py-2 bg-base border border-border-default rounded-lg text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-shadow"
          >
            {summaries.map((s) => (
              <option key={s.id} value={s.id}>
                {formatScanLabel(s)}
              </option>
            ))}
          </select>
          {targetSummary && (
            <div className="text-[11px] text-gray-400 font-mono truncate px-1">
              URL: {targetSummary.tabUrl} • {targetSummary.totalFindings} violations
            </div>
          )}
        </div>
      </div>

      {/* Validation: Same Snapshot Alert */}
      {isSameSnapshot && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-rose-950/40 border border-rose-700/60 text-xs text-rose-200 flex items-start gap-2"
        >
          <AlertCircle
            className="w-4 h-4 text-rose-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <strong className="font-semibold text-rose-100">
              Identical Snapshots Selected:
            </strong>{' '}
            Baseline and Target hauntings must be different snapshots. Please choose two
            distinct scans to compare.
          </div>
        </div>
      )}

      {/* Advisory: Different URLs Warning */}
      {!isSameSnapshot && isDifferentUrl && (
        <div
          role="note"
          className="p-3 rounded-lg bg-amber-950/30 border border-amber-700/50 text-xs text-amber-200 flex items-start gap-2"
        >
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5">
            <strong className="font-semibold text-amber-100">
              Cross-Page Target Notice:
            </strong>
            <p className="text-[11px] text-amber-300/90 leading-relaxed">
              These snapshots evaluate different URLs. The comparison engine enforces
              strict URL comparability and will mark this comparison as{' '}
              <em>incomparable</em> with 0% verified score.
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-border-subtle">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 rounded-lg bg-surface border border-border-default text-xs text-gray-300 hover:text-white hover:bg-surface-raised transition-colors"
          >
            Cancel
          </button>
        )}

        <button
          type="submit"
          disabled={isSameSnapshot || isSelectionIncomplete || isLoading}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
            isSameSnapshot || isSelectionIncomplete || isLoading
              ? 'bg-purple-950/40 text-gray-500 border border-purple-950 cursor-not-allowed'
              : 'bg-purple-700 hover:bg-purple-600 text-white shadow-glow'
          }`}
        >
          <Play className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{isLoading ? 'Loading Snapshots...' : 'Run Comparison'}</span>
        </button>
      </div>
    </form>
  );
}
