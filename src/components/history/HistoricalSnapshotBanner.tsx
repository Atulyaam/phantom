import { History, RotateCcw, AlertTriangle, ExternalLink, Download } from 'lucide-react';
import type { ScanRecord } from '@/domain/scan';
import { Button } from '@/components/shared';

export interface HistoricalSnapshotBannerProps {
  snapshot: ScanRecord;
  onReturnToLive: () => void;
  onOpenHistory?: () => void;
  onExportSnapshot?: () => void;
}

export function HistoricalSnapshotBanner({
  snapshot,
  onReturnToLive,
  onOpenHistory,
  onExportSnapshot,
}: HistoricalSnapshotBannerProps) {
  const formattedDate = new Date(snapshot.scannedAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <aside
      aria-label="Historical Snapshot Inspection Mode"
      className="p-4 rounded-xl bg-amber-950/25 border border-amber-600/50 shadow-glow space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Header Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded bg-amber-950/70 text-amber-300 border border-amber-600/50 font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            <span>Historical Snapshot</span>
          </span>
          <span className="text-xs font-mono text-gray-300">
            Recorded {formattedDate}
          </span>
          <span className="text-xs font-mono text-amber-400/90 px-2 py-0.5 rounded bg-amber-900/40 border border-amber-700/40">
            ID: {snapshot.id.slice(0, 8)}
          </span>
          <span className="text-xs text-amber-200/90 font-medium">
            {snapshot.findings.length} finding
            {snapshot.findings.length !== 1 ? 's' : ''} in archive
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {onExportSnapshot && (
            <Button variant="secondary" size="sm" onClick={onExportSnapshot}>
              <Download className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
              <span>Export Snapshot</span>
            </Button>
          )}

          {onOpenHistory && (
            <Button variant="secondary" size="sm" onClick={onOpenHistory}>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Browse Archive</span>
            </Button>
          )}

          <Button variant="primary" size="sm" onClick={onReturnToLive}>
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Return to Live Scan</span>
          </Button>
        </div>
      </div>

      {/* Target Details & Advisory */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 border-t border-amber-800/30 text-xs">
        <div className="space-y-0.5 max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-medium">Snapshot Target:</span>
            <span className="text-white font-semibold">{snapshot.pageTitle}</span>
          </div>
          <p className="text-gray-400 font-mono text-[11px] truncate">
            {snapshot.tabUrl}
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-amber-300/80 text-[11px] bg-amber-950/40 px-2.5 py-1 rounded border border-amber-800/40">
          <AlertTriangle
            className="w-3.5 h-3.5 shrink-0 text-amber-400"
            aria-hidden="true"
          />
          <span>Real-time live auditing paused while inspecting historical data</span>
        </div>
      </div>
    </aside>
  );
}
