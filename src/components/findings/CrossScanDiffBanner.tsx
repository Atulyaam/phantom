import { useState } from 'react';
import {
  TrendingUp,
  CheckCircle,
  AlertOctagon,
  RefreshCw,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  Info,
  EyeOff,
} from 'lucide-react';
import type { ScanComparison } from '@/domain/report';
import type { RescanVerificationSummary } from '@/domain/remediation';

interface CrossScanDiffBannerProps {
  comparison: ScanComparison;
  verificationSummary?: RescanVerificationSummary | null;
  onDismiss?: () => void;
}

export function CrossScanDiffBanner({
  comparison,
  verificationSummary,
  onDismiss,
}: CrossScanDiffBannerProps) {
  const [showUncertainDetails, setShowUncertainDetails] = useState(false);
  const metrics = comparison.metrics;

  if (!metrics) return null;

  const verifiedCount =
    metrics.verifiedResolvedCount !== undefined
      ? metrics.verifiedResolvedCount
      : verificationSummary?.newlyVerified?.length || 0;
  const disappearedCount = metrics.disappearedCount ?? 0;

  const effectiveNetProgress =
    metrics.verifiedNetProgress !== undefined
      ? metrics.verifiedNetProgress
      : metrics.netProgress;

  const isNetPositive = effectiveNetProgress > 0;
  const isNetNegative = effectiveNetProgress < 0;

  const newlyVerifiedCount = verificationSummary?.newlyVerified?.length || 0;
  const regressionsCount = verificationSummary?.regressions?.length || 0;

  return (
    <aside
      aria-label="Cross-Scan Comparison & Remediation Progress"
      className="p-4 rounded-xl bg-surface border border-purple-500/40 shadow-glow space-y-3"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded bg-purple-950/70 text-purple-300 border border-purple-600/50 font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-purple-400" aria-hidden="true" />
            <span>Cross-Scan Audit Diff</span>
          </span>
          <span className="text-xs text-gray-300 font-medium">
            Remediation Progress Comparison
          </span>
          <span className="text-xs font-mono text-cyan-300 font-bold px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-700/50">
            {metrics.verifiedImprovementScore !== undefined
              ? `${metrics.verifiedImprovementScore}% Verified Score`
              : `${metrics.improvementScore}% Score`}
          </span>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss comparison banner"
            className="text-gray-400 hover:text-gray-200 p-1 rounded focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Regression Alert Callout */}
      {regressionsCount > 0 && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-rose-950/40 border border-rose-600/70 text-xs text-rose-200 flex items-start gap-2.5"
        >
          <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-semibold text-rose-300">
              Regression Alert: {regressionsCount} Verified Issue
              {regressionsCount !== 1 ? 's' : ''} Reappeared
            </div>
            <p className="text-[11px] text-gray-300">
              Previously certified fixes failed upon rescan and their status was revoked
              to Unresolved.
            </p>
          </div>
        </div>
      )}

      {/* Verified Certification Notice */}
      {newlyVerifiedCount > 0 && regressionsCount === 0 && (
        <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-600/50 text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>
              {newlyVerifiedCount} fix{newlyVerifiedCount !== 1 ? 'es' : ''}
            </strong>{' '}
            certified Verified on this rescan.
          </span>
        </div>
      )}

      {/* Disappeared Findings Warning Callout */}
      {disappearedCount > 0 && (
        <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/40 text-xs text-amber-200 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            <strong>
              {disappearedCount} finding{disappearedCount !== 1 ? 's' : ''} disappeared
            </strong>{' '}
            from the page DOM but {disappearedCount !== 1 ? 'have' : 'has'} not been
            certified as fixed. Disappearance is not proof of accessibility compliance.
          </span>
        </div>
      )}

      {/* Incomparable / Skipped Verification Notice */}
      {verificationSummary?.skippedVerification && (
        <div className="p-2.5 rounded-lg bg-blue-950/30 border border-blue-600/40 text-xs text-blue-200 flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-400 shrink-0" />
          <span>Verification Note: {verificationSummary.skippedVerification.reason}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
        {/* Verified Fixes */}
        <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-800/40 flex flex-col">
          <span className="text-gray-400 font-medium flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-emerald-400" />
            <span>Verified</span>
          </span>
          <span className="text-xl font-bold text-emerald-400 font-mono">
            {verifiedCount}
          </span>
          <span className="text-[10px] text-gray-400">
            {verifiedCount > 0 ? (
              <span className="text-emerald-400 font-semibold">
                {verifiedCount} verified
              </span>
            ) : (
              '0 verified fixes'
            )}
          </span>
        </div>

        {/* Disappeared (Unverified) */}
        <div className="p-2.5 rounded-lg bg-surface-raised border border-border-default flex flex-col">
          <span className="text-gray-400 font-medium flex items-center gap-1">
            <EyeOff className="w-3 h-3 text-amber-400" />
            <span>Disappeared</span>
          </span>
          <span
            className={`text-xl font-bold font-mono ${
              disappearedCount > 0 ? 'text-amber-400' : 'text-gray-400'
            }`}
          >
            {disappearedCount}
          </span>
          <span className="text-[10px] text-gray-400">Absent (unverified)</span>
        </div>

        {/* Unchanged */}
        <div className="p-2.5 rounded-lg bg-surface-raised border border-border-default flex flex-col">
          <span className="text-gray-400 font-medium">Unchanged</span>
          <span className="text-xl font-bold text-gray-300 font-mono">
            {metrics.unchangedCount}
          </span>
          <span className="text-[10px] text-gray-400">Persistent issues</span>
        </div>

        {/* New / Regressions */}
        <div className="p-2.5 rounded-lg bg-red-950/20 border border-red-800/40 flex flex-col">
          <span className="text-gray-400 font-medium flex items-center gap-1">
            <AlertOctagon className="w-3 h-3 text-red-400" />
            <span>New Issues</span>
          </span>
          <span className="text-xl font-bold text-red-400 font-mono">
            {metrics.newCount}
          </span>
          <span className="text-[10px] text-gray-400">Regressions</span>
        </div>

        {/* Uncertain Matches */}
        <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/40 flex flex-col">
          <span className="text-gray-400 font-medium flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-amber-400" />
            <span>Uncertain</span>
          </span>
          <span className="text-xl font-bold text-amber-400 font-mono">
            {metrics.uncertainCount}
          </span>
          <span className="text-[10px] text-gray-400">Shifted selectors</span>
        </div>

        {/* Net Progress */}
        <div className="p-2.5 rounded-lg bg-purple-950/30 border border-purple-800/40 flex flex-col">
          <span className="text-gray-400 font-medium flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-purple-400" />
            <span>Net Progress</span>
          </span>
          <span
            className={`text-xl font-bold font-mono ${
              isNetPositive
                ? 'text-emerald-400'
                : isNetNegative
                  ? 'text-red-400'
                  : 'text-gray-300'
            }`}
          >
            {effectiveNetProgress > 0 ? `+${effectiveNetProgress}` : effectiveNetProgress}
          </span>
          <span className="text-[10px] text-gray-500">
            {metrics.verifiedNetProgress !== undefined
              ? 'Verified minus new'
              : 'Resolved minus new'}
          </span>
        </div>
      </div>

      {/* Uncertain Matches Accordion / Explainer */}
      {metrics.uncertainCount > 0 && comparison.uncertainMatches && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowUncertainDetails(!showUncertainDetails)}
            aria-expanded={showUncertainDetails}
            className="text-xs text-amber-300 hover:text-amber-200 flex items-center gap-1 font-medium transition-colors"
          >
            {showUncertainDetails ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Hide Shifted Selector Explanations</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>
                  Why {metrics.uncertainCount} issue
                  {metrics.uncertainCount !== 1 ? 's are' : ' is'} marked uncertain
                  (preventing false positives)
                </span>
              </>
            )}
          </button>

          {showUncertainDetails && (
            <div className="mt-2.5 p-3 rounded-lg bg-surface-raised border border-amber-900/40 space-y-2 text-xs">
              <p className="text-[11px] text-gray-300 leading-relaxed">
                Phantom Audit detected elements with altered DOM selectors that exhibit
                the exact same failure criteria. To prevent misleading improvement claims,
                these are flagged as <strong>Uncertain Matches</strong> rather than
                falsely reporting them as resolved:
              </p>
              <div className="space-y-2 pt-1">
                {comparison.uncertainMatches.map((match, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded bg-base border border-border-subtle space-y-1 font-mono text-[11px]"
                  >
                    <div className="flex items-center justify-between text-purple-300 font-bold">
                      <span>Rule: {match.baselineFinding.ruleId}</span>
                      <span className="text-amber-400 uppercase text-[10px]">
                        {match.confidence} Confidence
                      </span>
                    </div>
                    <p className="text-gray-300 font-sans text-xs">{match.reason}</p>
                    <div className="text-gray-400 text-[10px] space-y-0.5">
                      <div>
                        Original: {match.baselineFinding.nodes[0]?.target?.join(' ')}
                      </div>
                      <div>
                        Current:{' '}
                        {match.candidateRescanFinding.nodes[0]?.target?.join(' ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
