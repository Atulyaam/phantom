import { useState } from 'react';
import {
  GitCompare,
  CheckCircle,
  EyeOff,
  AlertTriangle,
  HelpCircle,
  X,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import type { ScanRecord } from '@/domain/scan';
import type { ScanComparison } from '@/domain/report';
import type { ComparisonCategory } from '@/domain/finding';

export type ComparisonCategoryFilter = 'all' | ComparisonCategory;

export interface ComparisonBannerProps {
  baselineScan: ScanRecord;
  targetScan: ScanRecord;
  comparison: ScanComparison;
  activeCategory: ComparisonCategoryFilter;
  onSelectCategory: (category: ComparisonCategoryFilter) => void;
  onChangeComparison: () => void;
  onExitComparison: () => void;
}

/**
 * Format timestamp nicely for comparison header
 */
function formatScanTime(isoDate: string): string {
  if (Number.isNaN(Date.parse(isoDate))) return isoDate;
  return new Date(isoDate).toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

/**
 * ComparisonBanner displays the atmospheric cross-scan comparison header,
 * metric counters across the 5 canonical categories, incomparability disclaimers,
 * interactive category filter chips, and uncertain match inspectors.
 */
export function ComparisonBanner({
  baselineScan,
  targetScan,
  comparison,
  activeCategory,
  onSelectCategory,
  onChangeComparison,
  onExitComparison,
}: ComparisonBannerProps) {
  const [showUncertainDetails, setShowUncertainDetails] = useState<boolean>(false);

  const { isComparable, incomparableReason, metrics } = comparison;

  const verifiedCount = metrics?.verifiedResolvedCount ?? 0;
  const disappearedCount = metrics?.disappearedCount ?? 0;
  const unchangedCount = metrics?.unchangedCount ?? 0;
  const newCount = metrics?.newCount ?? 0;
  const uncertainCount = comparison.uncertainMatches?.length ?? 0;
  const verifiedScore = metrics?.verifiedImprovementScore ?? 0;
  const verifiedNetProgress = metrics?.verifiedNetProgress ?? 0;

  const baselineTime = formatScanTime(baselineScan.scannedAt);
  const targetTime = formatScanTime(targetScan.scannedAt);

  return (
    <aside
      aria-label="Cross-Scan Comparison & Diff Intelligence"
      className="p-4 rounded-xl bg-surface border border-purple-500/50 shadow-glow space-y-4"
    >
      {/* Top Header: Comparison Mode Title + Target Comparison Context + Exit */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-purple-900/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded bg-purple-950/80 text-purple-300 border border-purple-600/50 font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <GitCompare className="w-3.5 h-3.5 text-purple-400" aria-hidden="true" />
              <span>Spectral Cross-Scan Comparison</span>
            </span>

            {isComparable ? (
              <span className="text-xs font-mono text-cyan-300 font-bold px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-700/50">
                {verifiedScore}% Verified Score
              </span>
            ) : (
              <span className="text-xs font-mono text-amber-300 font-bold px-2 py-0.5 rounded bg-amber-950/60 border border-amber-700/50">
                Incomparable
              </span>
            )}
          </div>

          {/* Baseline vs Target Details */}
          <div className="text-xs text-gray-300 flex items-center gap-2 flex-wrap font-mono pt-1">
            <span className="text-gray-400">Baseline (Before):</span>
            <span className="text-white font-semibold">
              {baselineScan.pageTitle || 'Untitled'} ({baselineTime})
            </span>
            <ArrowRight
              className="w-3.5 h-3.5 text-purple-400 shrink-0"
              aria-hidden="true"
            />
            <span className="text-gray-400">Target (After):</span>
            <span className="text-white font-semibold">
              {targetScan.pageTitle || 'Untitled'} ({targetTime})
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onChangeComparison}
            className="text-xs text-gray-300 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-raised border border-border-default hover:bg-surface-overlay transition-colors focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            <RefreshCw className="w-3 h-3 text-purple-400" aria-hidden="true" />
            <span>Change Scans</span>
          </button>

          <button
            type="button"
            onClick={onExitComparison}
            aria-label="Exit cross-scan comparison"
            className="text-xs text-rose-300 hover:text-rose-200 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-950/40 border border-rose-800/40 hover:bg-rose-900/50 transition-colors focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Exit Comparison</span>
          </button>
        </div>
      </div>

      {/* Incomparable Warning Notice */}
      {!isComparable ? (
        <div
          role="alert"
          className="p-3.5 rounded-lg bg-amber-950/30 border border-amber-600/50 text-xs text-amber-200 space-y-2"
        >
          <div className="flex items-start gap-2.5">
            <ShieldAlert
              className="w-4 h-4 text-amber-400 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <strong className="font-semibold text-amber-100 text-sm">
                Incomparable Hauntings — Remediation Verification Inapplicable
              </strong>
              <p className="text-amber-200/90 leading-relaxed">
                {incomparableReason ||
                  'The selected scans evaluate different URLs, or one of the scans was cancelled or failed. Cannot claim compliance fixes across disparate documents.'}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-amber-400/80 pl-6 border-t border-amber-800/40 pt-1.5">
            Zero verified progress is claimed. Please select two completed scans of the
            same URL to inspect verified remediation.
          </p>
        </div>
      ) : (
        <>
          {/* Disappeared Findings Callout */}
          {disappearedCount > 0 && (
            <div
              role="note"
              className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/50 text-xs text-amber-200 flex items-start gap-2.5"
            >
              <Info
                className="w-4 h-4 text-amber-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="space-y-0.5">
                <span className="font-semibold text-amber-100">
                  {disappearedCount} Disappeared Finding
                  {disappearedCount !== 1 ? 's' : ''} (Unverified):
                </span>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  These findings are absent in the target DOM, but lack an authoritative
                  Phase 6 verification record. Disappearance alone is never classified as
                  a verified fix.
                </p>
              </div>
            </div>
          )}

          {/* Interactive Metric Cards & Category Filter Chips */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span className="font-medium">Filter by Comparison Category:</span>
              <span className="font-mono text-[11px]">
                Net Progress:{' '}
                {verifiedNetProgress > 0
                  ? `+${verifiedNetProgress}`
                  : verifiedNetProgress}{' '}
                verified
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
              {/* All Issues Filter Card */}
              <button
                type="button"
                onClick={() => onSelectCategory('all')}
                aria-pressed={activeCategory === 'all'}
                aria-label="Filter by All Findings"
                className={`p-2.5 rounded-lg border flex flex-col text-left transition-all ${
                  activeCategory === 'all'
                    ? 'bg-purple-950/60 border-purple-400 shadow-glow text-white'
                    : 'bg-surface-raised border-border-default text-gray-400 hover:text-gray-200 hover:border-purple-800/50'
                }`}
              >
                <span className="text-[11px] font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  <span>All Findings</span>
                </span>
                <span className="text-xl font-bold font-mono text-purple-300">
                  {verifiedCount +
                    disappearedCount +
                    unchangedCount +
                    newCount +
                    uncertainCount}
                </span>
                <span className="text-[10px] text-gray-400">Full comparison set</span>
              </button>

              {/* Verified Fixes Card */}
              <button
                type="button"
                onClick={() => onSelectCategory('verified-fix')}
                aria-pressed={activeCategory === 'verified-fix'}
                aria-label="Filter by Verified Fixes"
                className={`p-2.5 rounded-lg border flex flex-col text-left transition-all ${
                  activeCategory === 'verified-fix'
                    ? 'bg-emerald-950/60 border-emerald-400 shadow-glow text-white'
                    : 'bg-surface-raised border-emerald-900/40 text-gray-400 hover:text-emerald-200 hover:border-emerald-700/50'
                }`}
              >
                <span className="text-[11px] font-medium flex items-center gap-1 text-emerald-400">
                  <CheckCircle className="w-3 h-3" />
                  <span>Verified Fixes</span>
                </span>
                <span className="text-xl font-bold font-mono text-emerald-400">
                  {verifiedCount}
                </span>
                <span className="text-[10px] text-gray-400">Confirmed resolved</span>
              </button>

              {/* Disappeared Findings Card */}
              <button
                type="button"
                onClick={() => onSelectCategory('disappeared')}
                aria-pressed={activeCategory === 'disappeared'}
                aria-label="Filter by Disappeared"
                className={`p-2.5 rounded-lg border flex flex-col text-left transition-all ${
                  activeCategory === 'disappeared'
                    ? 'bg-amber-950/60 border-amber-400 shadow-glow text-white'
                    : 'bg-surface-raised border-amber-900/40 text-gray-400 hover:text-amber-200 hover:border-amber-700/50'
                }`}
              >
                <span className="text-[11px] font-medium flex items-center gap-1 text-amber-400">
                  <EyeOff className="w-3 h-3" />
                  <span>Disappeared</span>
                </span>
                <span className="text-xl font-bold font-mono text-amber-400">
                  {disappearedCount}
                </span>
                <span className="text-[10px] text-gray-400">Unverified absence</span>
              </button>

              {/* Unchanged Issues Card */}
              <button
                type="button"
                onClick={() => onSelectCategory('unchanged')}
                aria-pressed={activeCategory === 'unchanged'}
                aria-label="Filter by Unchanged"
                className={`p-2.5 rounded-lg border flex flex-col text-left transition-all ${
                  activeCategory === 'unchanged'
                    ? 'bg-gray-800/80 border-gray-400 shadow-glow text-white'
                    : 'bg-surface-raised border-border-default text-gray-400 hover:text-gray-200 hover:border-gray-600'
                }`}
              >
                <span className="text-[11px] font-medium flex items-center gap-1 text-gray-300">
                  <AlertTriangle className="w-3 h-3 text-gray-400" />
                  <span>Unchanged</span>
                </span>
                <span className="text-xl font-bold font-mono text-gray-300">
                  {unchangedCount}
                </span>
                <span className="text-[10px] text-gray-400">Persisting defects</span>
              </button>

              {/* New Findings (Regressions) Card */}
              <button
                type="button"
                onClick={() => onSelectCategory('new')}
                aria-pressed={activeCategory === 'new'}
                aria-label="Filter by New Issues"
                className={`p-2.5 rounded-lg border flex flex-col text-left transition-all ${
                  activeCategory === 'new'
                    ? 'bg-rose-950/60 border-rose-400 shadow-glow text-white'
                    : 'bg-surface-raised border-rose-900/40 text-gray-400 hover:text-rose-200 hover:border-rose-700/50'
                }`}
              >
                <span className="text-[11px] font-medium flex items-center gap-1 text-rose-400">
                  <AlertTriangle className="w-3 h-3" />
                  <span>New Issues</span>
                </span>
                <span className="text-xl font-bold font-mono text-rose-400">
                  {newCount}
                </span>
                <span className="text-[10px] text-gray-400">Target regressions</span>
              </button>

              {/* Uncertain Matches Card */}
              <button
                type="button"
                onClick={() => onSelectCategory('uncertain')}
                aria-pressed={activeCategory === 'uncertain'}
                aria-label="Filter by Uncertain matches"
                className={`p-2.5 rounded-lg border flex flex-col text-left transition-all ${
                  activeCategory === 'uncertain'
                    ? 'bg-purple-950/60 border-purple-400 shadow-glow text-white'
                    : 'bg-surface-raised border-purple-900/40 text-gray-400 hover:text-purple-200 hover:border-purple-700/50'
                }`}
              >
                <span className="text-[11px] font-medium flex items-center gap-1 text-purple-300">
                  <HelpCircle className="w-3 h-3" />
                  <span>Uncertain</span>
                </span>
                <span className="text-xl font-bold font-mono text-purple-300">
                  {uncertainCount}
                </span>
                <span className="text-[10px] text-gray-400">Selector path shifts</span>
              </button>
            </div>
          </div>

          {/* Uncertain Matches Accordion (if present) */}
          {uncertainCount > 0 && (
            <div className="pt-2 border-t border-purple-900/30">
              <button
                type="button"
                onClick={() => setShowUncertainDetails((prev) => !prev)}
                className="w-full flex items-center justify-between text-xs font-medium text-purple-300 hover:text-purple-200 py-1"
                aria-expanded={showUncertainDetails}
                aria-controls="uncertain-matches-panel"
              >
                <span className="flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>
                    Inspect {uncertainCount} Uncertain Match
                    {uncertainCount !== 1 ? 'es' : ''} (Selector Drift)
                  </span>
                </span>
                {showUncertainDetails ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showUncertainDetails && (
                <div id="uncertain-matches-panel" className="mt-2 space-y-2 text-xs">
                  {comparison.uncertainMatches?.map((match, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded bg-surface-raised border border-purple-900/40 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold text-purple-300">
                          {match.baselineFinding.ruleId}
                        </span>
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-purple-950/70 border border-purple-800/40 text-purple-300">
                          {match.confidence} confidence
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-300">{match.reason}</p>
                      <div className="text-[10px] font-mono text-gray-400 truncate">
                        Baseline: {match.baselineFinding.nodes[0]?.target.join(' ')}
                      </div>
                      <div className="text-[10px] font-mono text-gray-400 truncate">
                        Candidate:{' '}
                        {match.candidateRescanFinding.nodes[0]?.target.join(' ')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </aside>
  );
}
