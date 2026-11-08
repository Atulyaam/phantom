import { AlertTriangle, X } from 'lucide-react';

interface DemoBannerProps {
  onDismiss?: () => void;
  onClearDemo?: () => void;
}

/**
 * DemoBanner makes it unmistakably clear that mock findings are currently displayed.
 * Never allows mock findings to be mistaken for real scan results.
 */
export function DemoBanner({ onDismiss, onClearDemo }: DemoBannerProps) {
  return (
    <div
      role="alert"
      className="p-4 rounded-xl bg-amber-950/40 border border-amber-600/50 text-amber-200 flex items-start justify-between gap-3 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="w-5 h-5 text-amber-400 mt-0.5 shrink-0"
          aria-hidden="true"
        />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-amber-100">
              Demonstration Mode Active
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-900/60 border border-amber-700/50 text-amber-300 font-bold">
              MOCK DATA
            </span>
          </div>
          <p className="text-xs text-amber-200/90 leading-relaxed">
            The accessibility findings below are synthetic fixtures provided exclusively
            to demonstrate the Phantom Audit user interface (Phase 2). They do{' '}
            <strong>not</strong> represent actual accessibility defects from the active
            tab. Scanning capability will be integrated in Phase 4.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onClearDemo && (
          <button
            type="button"
            onClick={onClearDemo}
            className="text-xs text-amber-300 hover:text-white px-2.5 py-1 rounded bg-amber-900/50 border border-amber-700/50 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            Clear Demo
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss demo notice"
            className="text-amber-400 hover:text-white p-1 rounded transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
