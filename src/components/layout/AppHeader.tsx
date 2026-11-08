import { Ghost, Sliders, History, Download } from 'lucide-react';
import { Button } from '@/components/shared';
import type { UserPreferences } from '@/lib/storage';

interface AppHeaderProps {
  preferences: UserPreferences;
  onToggleReducedMotion: () => void;
  viewMode: 'mansion' | 'list';
  onSetViewMode: (mode: 'mansion' | 'list') => void;
  onOpenHistory?: () => void;
  historyTriggerRef?: React.RefObject<HTMLButtonElement | null>;
  onOpenExport?: () => void;
  canExport?: boolean;
  exportTriggerRef?: React.RefObject<HTMLButtonElement | null>;
}

export function AppHeader({
  preferences,
  onToggleReducedMotion,
  viewMode,
  onSetViewMode,
  onOpenHistory,
  historyTriggerRef,
  onOpenExport,
  canExport = false,
  exportTriggerRef,
}: AppHeaderProps) {
  return (
    <header
      role="banner"
      className="border-b border-border-subtle bg-surface px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-mansion"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-purple-950/60 border border-purple-700/50 text-purple-300">
          <Ghost className="w-7 h-7 text-spectral-accent" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 font-display">
            Phantom Audit
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/50 border border-purple-500/30 text-purple-200 font-sans font-normal">
              Haunted Mansion
            </span>
          </h1>
          <p className="text-xs text-gray-400">
            Haunted Mansion Accessibility Auditor • Kiroween 2026
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {onOpenHistory && (
          <button
            ref={historyTriggerRef}
            type="button"
            onClick={onOpenHistory}
            aria-label="The Archive: Browse past scan hauntings"
            className="px-3 py-1.5 text-xs rounded-md bg-purple-950/60 border border-purple-700/50 text-purple-200 hover:text-white hover:bg-purple-900/60 flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            <History className="w-3.5 h-3.5 text-purple-400" aria-hidden="true" />
            <span>The Archive</span>
          </button>
        )}

        {onOpenExport && (
          <button
            ref={exportTriggerRef}
            type="button"
            onClick={onOpenExport}
            disabled={!canExport}
            aria-label={
              canExport
                ? 'Export Report: Download JSON or HTML report'
                : 'Export Report: No completed scan available'
            }
            title={
              canExport
                ? 'Export Accessibility Report (JSON or HTML)'
                : 'Run or inspect a completed scan to export a report'
            }
            className={`px-3 py-1.5 text-xs rounded-md flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-purple-400 ${
              canExport
                ? 'bg-purple-900/60 border border-purple-600/50 text-purple-100 hover:bg-purple-800/70 hover:text-white shadow-sm'
                : 'bg-surface-raised border border-border-subtle text-gray-500 cursor-not-allowed opacity-60'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
            <span>Export Report</span>
          </button>
        )}

        <Button
          variant="secondary"
          size="sm"
          onClick={onToggleReducedMotion}
          aria-pressed={preferences.reducedMotion}
        >
          <Sliders className="w-3.5 h-3.5 text-purple-300" aria-hidden="true" />
          <span>
            Reduced Motion: {preferences.reducedMotion ? 'Enabled' : 'Disabled'}
          </span>
        </Button>

        <div
          role="group"
          aria-label="View representation"
          className="flex items-center rounded-md border border-border-default bg-surface-raised p-0.5"
        >
          <button
            type="button"
            onClick={() => onSetViewMode('mansion')}
            aria-pressed={viewMode === 'mansion'}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              viewMode === 'mansion'
                ? 'bg-purple-700 text-white font-medium shadow'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Mansion Map
          </button>
          <button
            type="button"
            onClick={() => onSetViewMode('list')}
            aria-pressed={viewMode === 'list'}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              viewMode === 'list'
                ? 'bg-purple-700 text-white font-medium shadow'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            List View
          </button>
        </div>
      </div>
    </header>
  );
}
