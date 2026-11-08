import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  History,
  Search,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Eye,
  Clock,
  ShieldAlert,
  GitCompare,
} from 'lucide-react';
import type { ScanSummary, ScanRecord } from '@/domain/scan';
import { storageService } from '@/lib/storage';
import { ComparisonSelector } from '@/components/comparison';

export interface ScanHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentSnapshotId?: string | null;
  onSelectSnapshot: (scan: ScanRecord) => void;
  onStartComparison?: (baselineScan: ScanRecord, targetScan: ScanRecord) => void;
  onSnapshotDeleted?: (deletedScanId: string) => void;
  onHistoryCleared?: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  initialTab?: 'archive' | 'compare';
  initialCompareBaselineId?: string | null;
}

export function ScanHistoryDrawer({
  isOpen,
  onClose,
  currentSnapshotId,
  onSelectSnapshot,
  onStartComparison,
  onSnapshotDeleted,
  onHistoryCleared,
  triggerRef,
  initialTab = 'archive',
  initialCompareBaselineId = null,
}: ScanHistoryDrawerProps) {
  const [activeTab, setActiveTab] = useState<'archive' | 'compare'>(initialTab);
  const [compareBaselineId, setCompareBaselineId] = useState<string | null>(
    initialCompareBaselineId
  );
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [summaries, setSummaries] = useState<ScanSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'failed'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isConfirmingClearAll, setIsConfirmingClearAll] = useState<boolean>(false);
  const [announcement, setAnnouncement] = useState<string>('');

  const drawerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Load summaries from storage
  const loadSummaries = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setAnnouncement('Loading historical hauntings...');

    try {
      const raw = await storageService.getScanSummaries();
      // Ensure newest scans first, handling malformed timestamps and stable tie-breaking
      const sorted = [...raw].sort((a, b) => {
        const timeA = Number.isNaN(Date.parse(a.scannedAt)) ? 0 : Date.parse(a.scannedAt);
        const timeB = Number.isNaN(Date.parse(b.scannedAt)) ? 0 : Date.parse(b.scannedAt);
        const diff = timeB - timeA;
        if (diff !== 0) return diff;
        return (b.id || '').localeCompare(a.id || '');
      });
      setSummaries(sorted);
      setAnnouncement(`Loaded ${sorted.length} historical scans.`);
    } catch {
      setErrorMessage('Failed to load scan history from local storage.');
      setAnnouncement('Failed to load scan history from local storage.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Reload whenever drawer opens
  useEffect(() => {
    if (isOpen) {
      loadSummaries();
      setSearchQuery('');
      setConfirmDeleteId(null);
      setIsConfirmingClearAll(false);
      setActiveTab(initialTab);
      setCompareBaselineId(initialCompareBaselineId);
    }
  }, [isOpen, loadSummaries, initialTab, initialCompareBaselineId]);

  // Focus management and keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    // Focus search input or close button on open
    const timer = setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      } else if (closeButtonRef.current) {
        closeButtonRef.current.focus();
      }
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        if (triggerRef?.current) {
          triggerRef.current.focus();
        }
        return;
      }

      // Trap Tab inside drawer (excluding disabled elements)
      if (e.key === 'Tab' && drawerRef.current) {
        const focusableElements = drawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
        );
        if (focusableElements.length === 0) return;
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, triggerRef]);

  // Restore focus to trigger button upon close
  const handleDrawerClose = useCallback(() => {
    onClose();
    if (triggerRef?.current) {
      triggerRef.current.focus();
    }
  }, [onClose, triggerRef]);

  // Filtered summaries
  const filteredSummaries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return summaries.filter((item) => {
      const matchesQuery =
        !query ||
        item.pageTitle.toLowerCase().includes(query) ||
        item.tabUrl.toLowerCase().includes(query) ||
        item.hostname.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'completed'
            ? item.status === 'completed'
            : item.status === 'failed' || item.status === 'cancelled';

      return matchesQuery && matchesStatus;
    });
  }, [summaries, searchQuery, statusFilter]);

  // Reopen snapshot
  const handleReopen = async (summary: ScanSummary) => {
    setErrorMessage(null);
    try {
      const fullScan = await storageService.getScanById(summary.id);
      if (!fullScan) {
        setErrorMessage(
          'Snapshot record is missing or corrupted in storage. It may have been evicted or cleared.'
        );
        setAnnouncement('Snapshot record is missing or corrupted in storage.');
        return;
      }
      setAnnouncement(`Opened historical snapshot for ${fullScan.pageTitle}.`);
      onSelectSnapshot(fullScan);
      handleDrawerClose();
    } catch {
      setErrorMessage('Failed to retrieve full snapshot record from storage.');
      setAnnouncement('Failed to retrieve full snapshot record from storage.');
    }
  };

  // Run comparison between baseline and target snapshots
  const handleExecuteComparison = async (baselineId: string, targetId: string) => {
    setIsComparing(true);
    setErrorMessage(null);
    setAnnouncement('Retrieving snapshots for comparison...');

    try {
      const [baselineScan, targetScan] = await Promise.all([
        storageService.getScanById(baselineId),
        storageService.getScanById(targetId),
      ]);

      if (!baselineScan || !targetScan) {
        setErrorMessage('Failed to load one or both scan snapshots from storage.');
        setAnnouncement('Failed to load scan snapshots for comparison.');
        setIsComparing(false);
        return;
      }

      setAnnouncement(
        `Starting comparison between ${baselineScan.pageTitle} and ${targetScan.pageTitle}.`
      );
      onStartComparison?.(baselineScan, targetScan);
      handleDrawerClose();
    } catch {
      setErrorMessage('Failed to prepare cross-scan comparison from storage.');
      setAnnouncement('Failed to prepare cross-scan comparison from storage.');
    } finally {
      setIsComparing(false);
    }
  };

  // Delete individual snapshot
  const handleDelete = async (scanId: string) => {
    setErrorMessage(null);
    try {
      await storageService.deleteScan(scanId);
      setConfirmDeleteId(null);
      setAnnouncement('Historical scan deleted from archive.');
      onSnapshotDeleted?.(scanId);
      await loadSummaries();
    } catch {
      setErrorMessage('Failed to delete scan snapshot from storage.');
      setAnnouncement('Failed to delete scan snapshot from storage.');
    }
  };

  // Clear all scan history
  const handleClearAll = async () => {
    setErrorMessage(null);
    try {
      await storageService.clearScanHistory();
      setIsConfirmingClearAll(false);
      setSummaries([]);
      setAnnouncement('All scan history cleared from archive.');
      onHistoryCleared?.();
    } catch {
      setErrorMessage('Failed to clear scan history from storage.');
      setAnnouncement('Failed to clear scan history from storage.');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDrawerClose();
      }}
    >
      {/* Live Region for Screen Reader Announcements */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {/* Drawer Panel */}
      <section
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-drawer-title"
        className="w-full max-w-xl h-full bg-[#0a0612] border-l border-purple-800/40 shadow-2xl flex flex-col overflow-hidden text-gray-200"
      >
        {/* Header */}
        <header className="p-5 border-b border-purple-900/40 bg-surface/80 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-950/60 border border-purple-700/50 text-purple-300">
                <History className="w-5 h-5 text-purple-400" aria-hidden="true" />
              </div>
              <h2
                id="archive-drawer-title"
                className="text-lg font-bold text-white font-display flex items-center gap-2"
              >
                The Archive of Past Hauntings
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/50 border border-purple-500/30 text-purple-200 font-sans font-normal">
                  {summaries.length} saved
                </span>
              </h2>
            </div>
            <p className="text-xs text-gray-400">
              Browse, inspect, and manage preserved local accessibility scan snapshots.
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleDrawerClose}
            aria-label="Close archive drawer"
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface-raised transition-colors focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </header>

        {/* Navigation Tabs (Archive vs Compare) */}
        <div
          role="tablist"
          aria-label="Archive view modes"
          className="flex border-b border-purple-900/40 bg-surface/50 px-5 pt-2 gap-2"
        >
          <button
            type="button"
            role="tab"
            id="tab-archive"
            aria-selected={activeTab === 'archive'}
            aria-controls="panel-archive"
            onClick={() => setActiveTab('archive')}
            className={`px-3 py-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'archive'
                ? 'border-purple-400 text-purple-200 bg-purple-950/30 rounded-t'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <History className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Preserved Snapshots</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-900/60 text-purple-200">
              {summaries.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-compare"
            aria-selected={activeTab === 'compare'}
            aria-controls="panel-compare"
            onClick={() => setActiveTab('compare')}
            className={`px-3 py-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'compare'
                ? 'border-purple-400 text-purple-200 bg-purple-950/30 rounded-t'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Compare Hauntings</span>
          </button>
        </div>

        {/* Clear History Confirmation Banner */}
        {isConfirmingClearAll && (
          <div
            role="alert"
            className="p-4 bg-rose-950/40 border-b border-rose-600/50 space-y-2 text-xs text-rose-200"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-100">
                  Purge all past hauntings from local storage?
                </p>
                <p className="text-[11px] text-rose-300/80 mt-0.5">
                  This will permanently delete all {summaries.length} saved snapshots.
                  Phase 6 remediation records and preferences will not be affected.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1 justify-end">
              <button
                type="button"
                onClick={() => setIsConfirmingClearAll(false)}
                className="px-3 py-1 text-xs rounded bg-surface border border-border-default text-gray-300 hover:bg-surface-raised"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="px-3 py-1 text-xs rounded bg-rose-700 text-white font-semibold hover:bg-rose-600 transition-colors"
              >
                Confirm Purge
              </button>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="p-3 bg-red-950/40 border-b border-red-700/60 text-xs text-red-200 flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-200 p-1"
              aria-label="Dismiss error message"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Archive Tab Panel */}
        {activeTab === 'archive' && (
          <div
            id="panel-archive"
            role="tabpanel"
            aria-labelledby="tab-archive"
            className="flex-1 flex flex-col min-h-0 overflow-hidden"
          >
            {/* Controls: Search, Filter & Clear All Action */}
            <div className="p-4 border-b border-border-subtle bg-surface/40 space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search
                    className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
                    aria-hidden="true"
                  />
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search past hauntings by title, URL or host..."
                    aria-label="Search scan history"
                    className="w-full pl-9 pr-3 py-1.5 bg-base border border-border-default rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-shadow"
                  />
                </div>

                {summaries.length > 0 && !isConfirmingClearAll && (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingClearAll(true)}
                    className="px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded border border-rose-800/40 flex items-center gap-1 transition-colors shrink-0"
                    title="Purge all saved scan history"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Archive</span>
                  </button>
                )}
              </div>

              {/* Filter Pills */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400 text-[11px]">Filter:</span>
                  {(['all', 'completed', 'failed'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setStatusFilter(filter)}
                      className={`px-2.5 py-0.5 rounded-full text-[11px] capitalize transition-colors ${
                        statusFilter === filter
                          ? 'bg-purple-800 text-white font-medium border border-purple-500/50'
                          : 'text-gray-400 hover:text-gray-200 bg-surface-raised border border-border-subtle'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>

                <span className="text-gray-400 text-[11px]">
                  Showing {filteredSummaries.length} of {summaries.length}
                </span>
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoading ? (
                <div className="py-16 text-center space-y-3">
                  <Clock className="w-8 h-8 text-purple-400 mx-auto animate-spin" />
                  <p className="text-xs text-gray-400 font-mono">
                    Consulting the spectral archives...
                  </p>
                </div>
              ) : summaries.length === 0 ? (
                <div className="py-16 text-center space-y-3 px-6">
                  <History className="w-12 h-12 text-purple-400/50 mx-auto" />
                  <h3 className="text-sm font-semibold text-gray-200 font-display">
                    The Archive is Silent
                  </h3>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                    No past hauntings have been recorded yet. Run an accessibility audit
                    on any target tab to capture the first historical snapshot.
                  </p>
                </div>
              ) : filteredSummaries.length === 0 ? (
                <div className="py-12 text-center space-y-2 px-6">
                  <Search className="w-8 h-8 text-gray-500 mx-auto" />
                  <p className="text-xs text-gray-300 font-medium">
                    No historical scans match &ldquo;{searchQuery}&rdquo;
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                    }}
                    className="text-xs text-purple-400 hover:text-purple-300 underline"
                  >
                    Reset search and filters
                  </button>
                </div>
              ) : (
                filteredSummaries.map((summary) => {
                  const isCurrent = summary.id === currentSnapshotId;
                  const formattedDate = new Date(summary.scannedAt).toLocaleString(
                    undefined,
                    {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }
                  );
                  const isDeleting = confirmDeleteId === summary.id;

                  return (
                    <article
                      key={summary.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isCurrent
                          ? 'bg-cyan-950/20 border-cyan-500/60 shadow-glow'
                          : 'bg-surface/90 border-border-default hover:border-purple-600/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0 flex-1">
                          {/* Top Badges & Target Title */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950/70 text-cyan-300 border border-cyan-600/50 uppercase tracking-wider">
                                Currently Viewing
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${
                                summary.status === 'completed'
                                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/50'
                                  : 'bg-rose-950/60 text-rose-300 border border-rose-700/50'
                              }`}
                            >
                              {summary.status}
                            </span>
                            <span className="text-[11px] text-gray-400 font-mono">
                              {formattedDate}
                            </span>
                          </div>

                          <h3 className="text-sm font-semibold text-white truncate font-display">
                            {summary.pageTitle || 'Untitled Page'}
                          </h3>

                          <p className="text-[11px] text-gray-400 font-mono truncate">
                            {summary.tabUrl}
                          </p>
                        </div>

                        {/* Snapshot ID Pill */}
                        <span className="text-[10px] font-mono text-purple-300 bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-800/40 shrink-0">
                          #{summary.id.slice(0, 6)}
                        </span>
                      </div>

                      {/* Findings Severity Breakdown */}
                      <div className="mt-3 pt-2.5 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {summary.totalFindings === 0 ? (
                            <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-950/50 text-emerald-300 border border-emerald-800/40 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-emerald-400" />
                              <span>0 Violations (Clean)</span>
                            </span>
                          ) : (
                            <>
                              <span className="text-[11px] text-gray-400 font-medium">
                                {summary.totalFindings} issue
                                {summary.totalFindings !== 1 ? 's' : ''}:
                              </span>
                              {summary.criticalCount > 0 && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-950/60 text-rose-300 border border-rose-700/50">
                                  {summary.criticalCount} Critical
                                </span>
                              )}
                              {summary.seriousCount > 0 && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-700/50">
                                  {summary.seriousCount} Serious
                                </span>
                              )}
                              {summary.moderateCount > 0 && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-yellow-950/60 text-yellow-300 border border-yellow-700/50">
                                  {summary.moderateCount} Moderate
                                </span>
                              )}
                              {summary.minorCount > 0 && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-blue-950/60 text-blue-300 border border-blue-700/50">
                                  {summary.minorCount} Minor
                                </span>
                              )}
                            </>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                          {isDeleting ? (
                            <div
                              role="group"
                              aria-label="Confirm snapshot deletion"
                              className="flex items-center gap-1.5 bg-rose-950/50 p-1 rounded border border-rose-800/50 text-[11px]"
                            >
                              <span
                                id={`del-prompt-${summary.id}`}
                                className="text-rose-200 pl-1 font-medium"
                              >
                                Delete?
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDelete(summary.id)}
                                aria-describedby={`del-prompt-${summary.id}`}
                                className="px-2 py-0.5 rounded bg-rose-700 text-white font-bold hover:bg-rose-600 focus-visible:ring-2 focus-visible:ring-rose-400"
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                aria-describedby={`del-prompt-${summary.id}`}
                                className="px-2 py-0.5 rounded bg-surface text-gray-300 hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-purple-400"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <>
                              {onStartComparison && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCompareBaselineId(summary.id);
                                    setActiveTab('compare');
                                  }}
                                  aria-label={`Compare scan snapshot ${summary.pageTitle} ${formattedDate}`}
                                  className="p-1.5 rounded text-gray-400 hover:text-purple-300 hover:bg-purple-950/30 transition-colors"
                                  title="Compare this snapshot"
                                >
                                  <GitCompare className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(summary.id)}
                                aria-label={`Delete scan snapshot ${summary.pageTitle} ${formattedDate}`}
                                className="p-1.5 rounded text-gray-400 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
                                title="Delete this snapshot"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleReopen(summary)}
                                disabled={isCurrent}
                                aria-label={
                                  isCurrent
                                    ? `Currently viewing snapshot for ${summary.pageTitle || 'Untitled Page'}`
                                    : `Inspect snapshot for ${summary.pageTitle || 'Untitled Page'} (${formattedDate})`
                                }
                                className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
                                  isCurrent
                                    ? 'bg-cyan-900/40 text-cyan-300 border border-cyan-700/40 cursor-default'
                                    : 'bg-purple-800/80 hover:bg-purple-700 text-white border border-purple-600/50'
                                }`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>{isCurrent ? 'Viewing' : 'Inspect'}</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Compare Tab Panel */}
        {activeTab === 'compare' && (
          <div
            id="panel-compare"
            role="tabpanel"
            aria-labelledby="tab-compare"
            className="flex-1 overflow-y-auto"
          >
            <ComparisonSelector
              summaries={summaries}
              initialBaselineId={compareBaselineId}
              onCompare={handleExecuteComparison}
              onCancel={() => setActiveTab('archive')}
              isLoading={isComparing}
            />
          </div>
        )}

        {/* Footer */}
        <footer className="p-4 border-t border-purple-900/40 bg-surface/50 text-xs text-gray-400 flex items-center justify-between">
          <span>Max capacity: 50 snapshots</span>
          <span className="font-mono text-[11px] text-gray-500">
            Storage: chrome.storage.local
          </span>
        </footer>
      </section>
    </div>
  );
}
