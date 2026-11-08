import { Sparkles, ShieldAlert } from 'lucide-react';

interface TargetBannerProps {
  tabId: number | null;
  targetUrl: string;
  targetTitle: string;
  isUnsupported: boolean;
  isDemoMode: boolean;
}

export function TargetBanner({
  tabId,
  targetUrl,
  targetTitle,
  isUnsupported,
  isDemoMode,
}: TargetBannerProps) {
  return (
    <>
      {/* Unsupported Page Alert */}
      {isUnsupported && (
        <section
          aria-labelledby="unsupported-alert-title"
          className="p-4 rounded-lg bg-red-950/40 border border-red-700/60 text-red-200 flex items-start gap-3"
        >
          <ShieldAlert
            className="w-5 h-5 text-red-400 mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <div>
            <h2
              id="unsupported-alert-title"
              className="text-sm font-semibold text-red-100"
            >
              Ineligible Inspection Target
            </h2>
            <p className="text-xs text-red-200/90 mt-1 leading-relaxed">
              Phantom Audit cannot inspect browser-internal pages (such as{' '}
              <code className="px-1 py-0.5 bg-red-900/40 rounded">chrome://</code>,{' '}
              <code className="px-1 py-0.5 bg-red-900/40 rounded">edge://</code>, or the
              Chrome Web Store) due to browser security restrictions. Please navigate to a
              standard HTTP or HTTPS webpage and launch Phantom Audit again.
            </p>
          </div>
        </section>
      )}

      {/* Target Page Status Banner */}
      <section
        aria-labelledby="target-page-heading"
        className="p-5 rounded-xl bg-surface border border-border-default shadow-mansion flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2
              id="target-page-heading"
              className="text-xs uppercase tracking-wider font-semibold text-gray-400"
            >
              {isDemoMode ? 'Demo Mode — Illustrative Data' : 'Audited Page Context'}
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-semibold text-white">
              {targetTitle || 'Active Browser Tab'}
            </p>
            {tabId && (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-raised border border-border-subtle text-gray-400">
                Tab #{tabId}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 truncate max-w-2xl font-mono">
            {targetUrl || 'No target URL detected (standalone launch)'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-2 rounded-lg bg-purple-950/40 border border-purple-800/40 text-purple-200 text-xs flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" aria-hidden="true" />
            <span>{isDemoMode ? 'Demo Data Active' : 'Ready for Scan'}</span>
          </div>
        </div>
      </section>
    </>
  );
}
