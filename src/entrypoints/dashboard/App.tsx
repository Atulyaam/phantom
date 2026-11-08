import { useEffect, useState, useRef, useMemo } from 'react';
import { MANSION_ROOMS, type RoomId, type RoomState } from '@/domain/room';
import type { FindingRecord, Impact } from '@/domain/finding';
import type { ScanRecord } from '@/domain/scan';
import type { ScanComparison } from '@/domain/report';
import type {
  RemediationStoragePayload,
  RescanVerificationSummary,
} from '@/domain/remediation';
import { storageService, type UserPreferences, DEFAULT_PREFERENCES } from '@/lib/storage';
import { logSafeWarn } from '@/lib/logger';
import { MOCK_FINDINGS } from '@/fixtures/mock-findings';
import { AppHeader } from '@/components/layout/AppHeader';
import { TargetBanner } from '@/components/layout/TargetBanner';
import { ScanControlBar } from '@/components/scan';
import { MansionMap, RoomListView } from '@/components/mansion';
import { HistoricalSnapshotBanner, ScanHistoryDrawer } from '@/components/history';
import { ComparisonBanner, type ComparisonCategoryFilter } from '@/components/comparison';
import { compareScans } from '@/features/comparison/scan-comparator';
import { ExportReportDialog } from '@/features/reports';
import {
  RoomDetailPanel,
  FindingInspector,
  FindingFilterBar,
  GroupedFindingList,
  CrossScanDiffBanner,
  type GroupByOption,
} from '@/components/findings';
import { DemoBanner, EmptyState } from '@/components/states';
import { useTargetTab } from '@/features/tab-management/use-target-tab';
import {
  filterAndSortFindings,
  type ConformanceFilter,
  type ReviewStatusFilter,
  type FindingSortBy,
} from '@/features/findings/finding-filters';
import { computeFindingSummaryStats } from '@/features/findings/finding-aggregation';
import { executeRescanVerification, remediationTracker } from '@/features/remediation';
import {
  Sparkles,
  RotateCcw,
  CheckCircle,
  ShieldAlert,
  SlidersHorizontal,
  CheckCircle2,
  BookOpen,
  Info,
  X,
} from 'lucide-react';

export default function App() {
  const {
    tabId,
    targetUrl,
    targetTitle,
    connectionStatus,
    eligibility,
    errorMessage,
    isPreparingScan,
    scanHandshakeMessage,
    checkLiveStatus,
    initiateScanHandshake,
  } = useTargetTab();

  const [viewMode, setViewMode] = useState<'mansion' | 'list'>('mansion');
  const [selectedRoom, setSelectedRoom] = useState<RoomId | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<FindingRecord | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  // Active scan record from real axe-core scan
  const [activeScanRecord, setActiveScanRecord] = useState<ScanRecord | null>(null);

  // Phase 7 Historical Snapshot State (Archive of Past Hauntings)
  const [historicalScanRecord, setHistoricalScanRecord] = useState<ScanRecord | null>(
    null
  );
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [historyInitialTab, setHistoryInitialTab] = useState<'archive' | 'compare'>(
    'archive'
  );
  const [historyCompareBaselineId, setHistoryCompareBaselineId] = useState<string | null>(
    null
  );
  const historyTriggerRef = useRef<HTMLButtonElement | null>(null);

  // Phase 7 Workstream 4: Arbitrary Cross-Scan Comparison State
  const [activeComparison, setActiveComparison] = useState<{
    baselineScan: ScanRecord;
    targetScan: ScanRecord;
    comparison: ScanComparison;
    categoryFilter: ComparisonCategoryFilter;
  } | null>(null);

  // Cross-scan comparison diff between consecutive scans
  const [scanComparison, setScanComparison] = useState<ScanComparison | null>(null);

  // Phase 8 Workstream 4: Export Modal State
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const exportTriggerRef = useRef<HTMLButtonElement | null>(null);

  // Phase 6 Rescan Verification Summary
  const [verificationSummary, setVerificationSummary] =
    useState<RescanVerificationSummary | null>(null);

  // Phase 6 Persisted Remediation Records Map (reactive source of truth)
  const [remediationRecords, setRemediationRecords] = useState<RemediationStoragePayload>(
    {}
  );

  // Demo mode state
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [demoFindings, setDemoFindings] = useState<FindingRecord[]>(MOCK_FINDINGS);
  const [demoBannerDismissed, setDemoBannerDismissed] = useState<boolean>(false);

  // Phase 5 Finding Filtering and Grouping States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedImpact, setSelectedImpact] = useState<Impact | 'all'>('all');
  const [conformanceFilter, setConformanceFilter] = useState<ConformanceFilter>('all');
  const [reviewStatusFilter, setReviewStatusFilter] = useState<ReviewStatusFilter>('all');
  const [groupBy, setGroupBy] = useState<GroupByOption>('none');
  const [sortBy, setSortBy] = useState<FindingSortBy>('severity-desc');

  const refreshRemediationRecords = async () => {
    try {
      const records = await remediationTracker.getAllRecords();
      setRemediationRecords(records);
    } catch (err) {
      logSafeWarn('Remediation refresh', err);
    }
  };

  useEffect(() => {
    // Check if demo query parameter was passed
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === '1') {
      setIsDemoMode(true);
    }

    // Load user preferences
    storageService.getPreferences().then((prefs) => {
      setPreferences(prefs);
    });

    // Load initial remediation records
    refreshRemediationRecords();
  }, []);

  const toggleReducedMotion = async () => {
    const updated: UserPreferences = {
      ...preferences,
      reducedMotion: !preferences.reducedMotion,
    };
    setPreferences(updated);
    await storageService.savePreferences(updated);
  };

  const handleStartAudit = async () => {
    setIsExportOpen(false); // Close export modal when starting a new scan (DEF-845)
    setIsDemoMode(false);
    setHistoricalScanRecord(null); // Return to live tracking mode on new audit
    setActiveComparison(null); // Exit any active comparison
    const previousRecord = activeScanRecord;
    const record = await initiateScanHandshake();
    if (record) {
      setActiveScanRecord(record);
      setSelectedRoom(null);
      setSelectedFinding(null);

      // Execute rescan verification lifecycle if baseline exists
      if (previousRecord) {
        try {
          const { diff, summary } = await executeRescanVerification(
            previousRecord,
            record,
            remediationTracker
          );
          setScanComparison(diff);
          setVerificationSummary(summary);
        } catch (err) {
          logSafeWarn('Rescan verification', err);
          setScanComparison(null);
          setVerificationSummary(null);
        }
      } else {
        setScanComparison(null);
        setVerificationSummary(null);
      }

      await refreshRemediationRecords();

      try {
        await storageService.saveScan(record);
      } catch (err) {
        logSafeWarn('Scan persistence', err);
      }
    }
  };

  const handleClearScan = () => {
    if (activeComparison) {
      setActiveComparison(null);
    } else if (historicalScanRecord) {
      setHistoricalScanRecord(null);
    } else {
      setActiveScanRecord(null);
      setScanComparison(null);
      setVerificationSummary(null);
    }
    setSelectedRoom(null);
    setSelectedFinding(null);
  };

  // Toggle Reviewed status on a finding (persisting to scan record & storage)
  const handleToggleReviewed = async (finding: FindingRecord) => {
    // Strict P1 Invariant: Comparison and Historical inspection are strictly read-only
    if (isViewingComparison || isViewingHistorical) return;

    const nextReviewed = !finding.reviewed;

    if (historicalScanRecord) {
      const updatedFindings = historicalScanRecord.findings.map((f) =>
        f.fingerprint === finding.fingerprint ? { ...f, reviewed: nextReviewed } : f
      );
      setHistoricalScanRecord({
        ...historicalScanRecord,
        findings: updatedFindings,
      });

      if (selectedFinding?.fingerprint === finding.fingerprint) {
        setSelectedFinding({ ...selectedFinding, reviewed: nextReviewed });
      }
    } else if (activeScanRecord) {
      const updatedFindings = activeScanRecord.findings.map((f) =>
        f.fingerprint === finding.fingerprint ? { ...f, reviewed: nextReviewed } : f
      );
      const updatedRecord: ScanRecord = {
        ...activeScanRecord,
        findings: updatedFindings,
      };
      setActiveScanRecord(updatedRecord);

      if (selectedFinding?.fingerprint === finding.fingerprint) {
        setSelectedFinding({ ...selectedFinding, reviewed: nextReviewed });
      }

      try {
        await storageService.saveScan(updatedRecord);
      } catch (err) {
        logSafeWarn('Review status persistence', err);
      }
    } else if (isDemoMode) {
      setDemoFindings((prev) =>
        prev.map((f) =>
          f.fingerprint === finding.fingerprint ? { ...f, reviewed: nextReviewed } : f
        )
      );
      if (selectedFinding?.fingerprint === finding.fingerprint) {
        setSelectedFinding({ ...selectedFinding, reviewed: nextReviewed });
      }
    }
  };

  // Reset all filters to default state
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedImpact('all');
    setConformanceFilter('all');
    setReviewStatusFilter('all');
    setSortBy('severity-desc');
  };

  const isFilterActive =
    searchQuery !== '' ||
    selectedImpact !== 'all' ||
    conformanceFilter !== 'all' ||
    reviewStatusFilter !== 'all' ||
    sortBy !== 'severity-desc';

  // Derive findings based on comparison mode vs historical snapshot vs real scan vs demo mode vs unscanned
  const isViewingComparison = activeComparison !== null;
  const isViewingHistorical = !isViewingComparison && historicalScanRecord !== null;
  const isRealScan = !isViewingComparison && activeScanRecord !== null;

  // Phase 8 Workstream 4: Exportable scan resolution (Historical snapshot vs Live active scan)
  const exportableScan: ScanRecord | null = useMemo(() => {
    if (
      isViewingHistorical &&
      historicalScanRecord &&
      historicalScanRecord.status === 'completed'
    ) {
      return historicalScanRecord;
    }
    if (isRealScan && activeScanRecord && activeScanRecord.status === 'completed') {
      return activeScanRecord;
    }
    return null;
  }, [isViewingHistorical, historicalScanRecord, isRealScan, activeScanRecord]);

  const canExport = exportableScan !== null;

  // Comparison findings tagged with canonical categories
  const comparisonFindings = useMemo<FindingRecord[]>(() => {
    if (!activeComparison) return [];
    const { comparison, categoryFilter } = activeComparison;

    const verified = comparison.verifiedResolved.map((f) => ({
      ...f,
      comparisonCategory: 'verified-fix' as const,
    }));
    const disappeared = comparison.disappeared.map((f) => ({
      ...f,
      comparisonCategory: 'disappeared' as const,
    }));
    const unchanged = comparison.unchanged.map((f) => ({
      ...f,
      comparisonCategory: 'unchanged' as const,
    }));
    const newFindings = comparison.newFindings.map((f) => ({
      ...f,
      comparisonCategory: 'new' as const,
    }));
    const uncertain =
      comparison.uncertainMatches?.map((m) => ({
        ...m.candidateRescanFinding,
        comparisonCategory: 'uncertain' as const,
        uncertainReason: m.reason,
      })) || [];

    switch (categoryFilter) {
      case 'verified-fix':
        return verified;
      case 'disappeared':
        return disappeared;
      case 'unchanged':
        return unchanged;
      case 'new':
        return newFindings;
      case 'uncertain':
        return uncertain;
      case 'all':
      default:
        return [...verified, ...disappeared, ...unchanged, ...newFindings, ...uncertain];
    }
  }, [activeComparison]);

  const totalComparisonFindings = useMemo<number>(() => {
    if (!activeComparison) return 0;
    const { comparison } = activeComparison;
    return (
      comparison.verifiedResolved.length +
      comparison.disappeared.length +
      comparison.unchanged.length +
      comparison.newFindings.length +
      (comparison.uncertainMatches?.length || 0)
    );
  }, [activeComparison]);

  const currentFindings: FindingRecord[] = isViewingComparison
    ? comparisonFindings
    : isViewingHistorical
      ? historicalScanRecord.findings
      : isRealScan
        ? activeScanRecord.findings
        : isDemoMode
          ? demoFindings
          : [];

  // Summary statistics across current findings
  const summaryStats = computeFindingSummaryStats(currentFindings);

  // Filtered and sorted findings for display
  const filteredFindings = filterAndSortFindings(currentFindings, {
    query: searchQuery,
    impacts: selectedImpact === 'all' ? undefined : [selectedImpact],
    conformance: conformanceFilter,
    reviewStatus: reviewStatusFilter,
    sortBy,
  });

  const roomFindingCounts: Record<RoomId, number> = {
    'name-chamber': currentFindings.filter((f) => f.roomId === 'name-chamber').length,
    'contrast-crypt': currentFindings.filter((f) => f.roomId === 'contrast-crypt').length,
    'portrait-gallery': currentFindings.filter((f) => f.roomId === 'portrait-gallery')
      .length,
    'form-cellar': currentFindings.filter((f) => f.roomId === 'form-cellar').length,
    'structure-hall': currentFindings.filter((f) => f.roomId === 'structure-hall').length,
    'focus-corridor': currentFindings.filter((f) => f.roomId === 'focus-corridor').length,
    other: currentFindings.filter((f) => f.roomId === 'other').length,
  };

  // Compute room states:
  // - Comparison, Historical or Real scan: 'haunted' if findings exist in room, 'quiet' if 0 findings.
  // - Demo mode: 'haunted'.
  // - Dormant/unscanned: 'not-checked'.
  const hasAuditedData = isViewingComparison || isViewingHistorical || isRealScan;
  const roomStates: Record<RoomId, RoomState> = {
    'name-chamber': hasAuditedData
      ? roomFindingCounts['name-chamber'] > 0
        ? 'haunted'
        : 'quiet'
      : isDemoMode
        ? 'haunted'
        : 'not-checked',
    'contrast-crypt': hasAuditedData
      ? roomFindingCounts['contrast-crypt'] > 0
        ? 'haunted'
        : 'quiet'
      : isDemoMode
        ? 'haunted'
        : 'not-checked',
    'portrait-gallery': hasAuditedData
      ? roomFindingCounts['portrait-gallery'] > 0
        ? 'haunted'
        : 'quiet'
      : isDemoMode
        ? 'haunted'
        : 'not-checked',
    'form-cellar': hasAuditedData
      ? roomFindingCounts['form-cellar'] > 0
        ? 'haunted'
        : 'quiet'
      : isDemoMode
        ? 'haunted'
        : 'not-checked',
    'structure-hall': hasAuditedData
      ? roomFindingCounts['structure-hall'] > 0
        ? 'haunted'
        : 'quiet'
      : isDemoMode
        ? 'haunted'
        : 'not-checked',
    'focus-corridor': hasAuditedData
      ? roomFindingCounts['focus-corridor'] > 0
        ? 'haunted'
        : 'quiet'
      : isDemoMode
        ? 'haunted'
        : 'not-checked',
    other: hasAuditedData
      ? roomFindingCounts.other > 0
        ? 'haunted'
        : 'quiet'
      : isDemoMode
        ? 'haunted'
        : 'not-checked',
  };

  const selectedRoomFindings = selectedRoom
    ? currentFindings.filter((f) => f.roomId === selectedRoom)
    : [];

  return (
    <div
      className={`min-h-screen bg-base text-gray-100 flex flex-col ${
        preferences.reducedMotion ? 'motion-reduce' : ''
      }`}
    >
      {/* Skip to Main Content Link for Keyboard Accessibility (WCAG 2.4.1) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-purple-600 focus:text-white focus:rounded focus:ring-4 focus:ring-cyan-400"
      >
        Skip to main content
      </a>

      {/* Top Application Header */}
      <AppHeader
        preferences={preferences}
        onToggleReducedMotion={toggleReducedMotion}
        viewMode={viewMode}
        onSetViewMode={setViewMode}
        onOpenHistory={() => setIsHistoryOpen(true)}
        historyTriggerRef={historyTriggerRef}
        onOpenExport={() => setIsExportOpen(true)}
        canExport={canExport}
        exportTriggerRef={exportTriggerRef}
      />

      {/* Main Work Area */}
      <main
        id="main-content"
        role="main"
        className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6"
      >
        {/* Target Context Banner & Unsupported Alert */}
        <TargetBanner
          tabId={tabId}
          targetUrl={targetUrl}
          targetTitle={targetTitle}
          isUnsupported={!eligibility.isEligible}
          isDemoMode={isDemoMode}
        />

        {/* Spectral Cross-Scan Comparison Banner (Phase 7 Workstream 4) */}
        {isViewingComparison && activeComparison && (
          <ComparisonBanner
            baselineScan={activeComparison.baselineScan}
            targetScan={activeComparison.targetScan}
            comparison={activeComparison.comparison}
            activeCategory={activeComparison.categoryFilter}
            onSelectCategory={(category) =>
              setActiveComparison({
                ...activeComparison,
                categoryFilter: category,
              })
            }
            onChangeComparison={() => {
              setHistoryInitialTab('compare');
              setHistoryCompareBaselineId(activeComparison.baselineScan.id);
              setIsHistoryOpen(true);
            }}
            onExitComparison={() => {
              setActiveComparison(null);
              setSelectedRoom(null);
              setSelectedFinding(null);
            }}
          />
        )}

        {/* Historical Snapshot Inspection Banner (Phase 7 The Archive of Past Hauntings) */}
        {!isViewingComparison && isViewingHistorical && historicalScanRecord && (
          <HistoricalSnapshotBanner
            snapshot={historicalScanRecord}
            onReturnToLive={() => {
              setIsExportOpen(false); // Close export modal when returning to live mode (DEF-845)
              setHistoricalScanRecord(null);
              setSelectedRoom(null);
              setSelectedFinding(null);
            }}
            onOpenHistory={() => setIsHistoryOpen(true)}
            onExportSnapshot={() => setIsExportOpen(true)}
          />
        )}

        {/* Target Tab Integration & Scan Control Bar (Phase 3 & 4) */}
        <ScanControlBar
          tabId={tabId}
          targetUrl={targetUrl}
          connectionStatus={connectionStatus}
          eligibility={eligibility}
          isPreparingScan={isPreparingScan}
          scanHandshakeMessage={scanHandshakeMessage}
          errorMessage={errorMessage}
          onStartAudit={handleStartAudit}
          onRefreshStatus={() => {
            if (tabId) checkLiveStatus(tabId);
          }}
        />

        {/* Cross-Scan Diff Banner (Phase 5 Remediation Progress & Phase 6 Verification) */}
        {!isViewingComparison && !isViewingHistorical && scanComparison && (
          <CrossScanDiffBanner
            comparison={scanComparison}
            verificationSummary={verificationSummary}
            onDismiss={() => {
              setScanComparison(null);
              setVerificationSummary(null);
            }}
          />
        )}

        {/* Skipped / Incomparable Verification Advisory Notice */}
        {!isViewingComparison &&
          !isViewingHistorical &&
          verificationSummary?.skippedVerification &&
          !scanComparison && (
            <aside
              aria-label="Rescan Verification Notice"
              className="p-3.5 rounded-xl bg-surface border border-blue-600/40 text-xs text-blue-200 flex items-center justify-between gap-3 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-400 shrink-0" aria-hidden="true" />
                <span>
                  <strong>Verification Skipped:</strong>{' '}
                  {verificationSummary.skippedVerification.reason}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setVerificationSummary(null)}
                className="text-gray-400 hover:text-gray-200 p-1 rounded focus-visible:ring-2 focus-visible:ring-cyan-400"
                aria-label="Dismiss verification notice"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </aside>
          )}

        {/* Real Scan Results Banner (Phase 4 Real Findings) */}
        {!isViewingComparison &&
          !isViewingHistorical &&
          isRealScan &&
          activeScanRecord && (
            <aside
              aria-label="Real Accessibility Audit Results"
              className="p-4 rounded-xl bg-surface border border-cyan-500/40 shadow-glow space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-1 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-500/50 font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle
                      className="w-3.5 h-3.5 text-cyan-400"
                      aria-hidden="true"
                    />
                    <span>Real Audit: axe-core {activeScanRecord.axeVersion}</span>
                  </span>
                  <span className="text-xs text-gray-300 font-medium">
                    {activeScanRecord.pageTitle}
                  </span>
                  <span className="text-xs font-mono text-gray-400">
                    ({activeScanRecord.hostname})
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleClearScan}
                  className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1 px-2.5 py-1 rounded bg-surface-raised border border-border-default hover:bg-surface-overlay transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <RotateCcw className="w-3 h-3" aria-hidden="true" />
                  <span>Reset to Unscanned</span>
                </button>
              </div>

              {/* Metrics Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-surface-raised border border-red-900/40 flex flex-col">
                  <span className="text-gray-300 font-medium">Violations</span>
                  <span className="text-xl font-bold text-red-400 font-mono">
                    {activeScanRecord.findings.length}
                  </span>
                  <span className="text-[10px] text-gray-400">Confirmed issues</span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-raised border border-amber-900/40 flex flex-col">
                  <span className="text-gray-300 font-medium">Needs Manual Review</span>
                  <span className="text-xl font-bold text-amber-400 font-mono">
                    {activeScanRecord.incompleteChecksCount}
                  </span>
                  <span className="text-[10px] text-gray-400">Incomplete checks</span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-raised border border-emerald-900/40 flex flex-col">
                  <span className="text-gray-300 font-medium">Automated Passes</span>
                  <span className="text-xl font-bold text-emerald-400 font-mono">
                    {activeScanRecord.passesCount}
                  </span>
                  <span className="text-[10px] text-gray-400">Rules satisfied</span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-raised border border-gray-800 flex flex-col">
                  <span className="text-gray-300 font-medium">Inapplicable</span>
                  <span className="text-xl font-bold text-gray-300 font-mono">
                    {activeScanRecord.inapplicableCount}
                  </span>
                  <span className="text-[10px] text-gray-400">Not present on page</span>
                </div>
              </div>

              {/* Non-misleading WCAG Limitation Notice */}
              <div className="text-[11px] text-gray-400 flex items-start gap-2 pt-1 border-t border-border-default/60">
                <ShieldAlert
                  className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>
                  <strong>Methodology notice:</strong> Automated accessibility scans
                  evaluate ~30–50% of WCAG 2.2 Success Criteria. Zero automated violations
                  does not certify complete WCAG conformance; keyboard operation, screen
                  reader flow, and color perception require manual human evaluation.
                </span>
              </div>
            </aside>
          )}

        {/* Clean Audit State Banner (Zero Violations Detected) */}
        {isRealScan && activeScanRecord && activeScanRecord.findings.length === 0 && (
          <EmptyState type="clean-audit" />
        )}

        {/* Demo Mode Notice Banner (Phase 2 Requirement) */}
        {isDemoMode && !demoBannerDismissed && (
          <DemoBanner
            onDismiss={() => setDemoBannerDismissed(true)}
            onClearDemo={() => setIsDemoMode(false)}
          />
        )}

        {/* Demo Mode & Inspection State Controls */}
        <section
          aria-label="Simulation Controls"
          className="p-4 rounded-xl bg-surface border border-border-default flex flex-wrap items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-medium">Audit Status:</span>
            <span
              className={`px-2 py-0.5 rounded font-mono font-semibold ${
                isViewingComparison
                  ? 'bg-purple-950/80 text-purple-200 border border-purple-500/50'
                  : isRealScan
                    ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-700/50'
                    : isDemoMode
                      ? 'bg-purple-950/60 text-purple-300 border border-purple-700/50'
                      : 'bg-gray-800 text-gray-400 border border-gray-700'
              }`}
            >
              {isViewingComparison
                ? `Spectral Comparison (${currentFindings.length} findings)`
                : isRealScan
                  ? `Real Scan (${activeScanRecord?.findings.length} findings)`
                  : isDemoMode
                    ? 'Haunted Demo (Mock Fixtures)'
                    : 'Dormant (Unscanned)'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isViewingComparison ? (
              <button
                type="button"
                onClick={() => {
                  setActiveComparison(null);
                  setSelectedRoom(null);
                  setSelectedFinding(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-raised border border-border-default hover:bg-surface-overlay text-gray-200 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <RotateCcw className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
                <span>Exit Comparison View</span>
              </button>
            ) : isRealScan ? (
              <button
                type="button"
                onClick={handleClearScan}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-raised border border-border-default hover:bg-surface-overlay text-gray-200 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <RotateCcw className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
                <span>Clear Real Scan</span>
              </button>
            ) : isDemoMode ? (
              <button
                type="button"
                onClick={() => setIsDemoMode(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-raised border border-border-default hover:bg-surface-overlay text-gray-200 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <RotateCcw className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
                <span>Switch to Unscanned State</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsDemoMode(true);
                  setDemoBannerDismissed(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-purple-700 hover:bg-purple-600 text-white font-medium transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Load Demo Haunted Findings</span>
              </button>
            )}
          </div>
        </section>

        {/* Mansion Views (2D SVG Map vs Standard List Table) */}
        <section aria-labelledby="rooms-heading" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2
                id="rooms-heading"
                className="text-lg font-bold text-white flex items-center gap-2 font-display"
              >
                <span>Haunted Mansion Wings</span>
                <span className="text-xs font-sans text-gray-400 font-normal">
                  ({Object.keys(MANSION_ROOMS).length} rooms mapped)
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                {viewMode === 'mansion'
                  ? 'Interactive 2D architectural map. Select any room to inspect findings.'
                  : 'Accessible tabular view of all taxonomy rooms and current status.'}
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
                <span>Haunted</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                <span>Quiet</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-500 inline-block" />
                <span>Not Checked</span>
              </span>
            </div>
          </div>

          {viewMode === 'mansion' ? (
            <MansionMap
              rooms={MANSION_ROOMS}
              roomStates={roomStates}
              roomFindingCounts={roomFindingCounts}
              selectedRoom={selectedRoom}
              onSelectRoom={(roomId) => {
                setSelectedRoom(roomId);
                setSelectedFinding(null);
              }}
            />
          ) : (
            <RoomListView
              rooms={MANSION_ROOMS}
              roomStates={roomStates}
              roomFindingCounts={roomFindingCounts}
              selectedRoom={selectedRoom}
              onSelectRoom={(roomId) => {
                setSelectedRoom(roomId);
                setSelectedFinding(null);
              }}
            />
          )}
        </section>

        {/* Selected Room Details Drawer / Inspector */}
        {selectedRoom && !selectedFinding && (
          <RoomDetailPanel
            room={MANSION_ROOMS[selectedRoom]}
            state={roomStates[selectedRoom]}
            findings={selectedRoomFindings}
            remediationRecords={remediationRecords}
            onClose={() => setSelectedRoom(null)}
            onSelectFinding={(finding) => setSelectedFinding(finding)}
            onToggleReviewed={
              isViewingComparison || isViewingHistorical
                ? undefined
                : handleToggleReviewed
            }
            isDemo={isDemoMode}
          />
        )}

        {/* Finding Inspector Panel */}
        {selectedFinding && (
          <FindingInspector
            finding={selectedFinding}
            onClose={() => setSelectedFinding(null)}
            onToggleReviewed={
              isViewingComparison || isViewingHistorical
                ? undefined
                : handleToggleReviewed
            }
            onRemediationStatusChange={async () => {
              await refreshRemediationRecords();
            }}
            isDemo={isDemoMode}
            isHistorical={isViewingHistorical}
            isComparison={isViewingComparison}
          />
        )}

        {/* Phase 5: Comprehensive All-Findings Explorer & Multi-Dimensional Filter View */}
        {!selectedRoom &&
          !selectedFinding &&
          (currentFindings.length > 0 ||
            (isViewingComparison && totalComparisonFindings > 0)) && (
            <section
              aria-labelledby="findings-explorer-heading"
              className="space-y-4 pt-4 border-t border-border-subtle"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2
                    id="findings-explorer-heading"
                    className="text-lg font-bold text-white flex items-center gap-2 font-display"
                  >
                    <SlidersHorizontal
                      className="w-5 h-5 text-purple-400"
                      aria-hidden="true"
                    />
                    <span>Finding Intelligence & Explorer</span>
                    <span className="text-xs font-mono text-purple-300 bg-purple-950/60 border border-purple-700/50 px-2 py-0.5 rounded-full font-normal">
                      {currentFindings.length} total
                    </span>
                  </h2>
                  <p className="text-xs text-gray-400">
                    Multi-dimensional aggregation, search, selector copying, and review
                    triage.
                  </p>
                </div>

                {/* Summary Stats Badges */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-md bg-surface border border-border-default text-gray-300 font-mono flex items-center gap-1.5">
                    <span className="text-gray-400">Nodes:</span>
                    <strong className="text-white">
                      {summaryStats.totalAffectedNodes}
                    </strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 font-mono flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      Reviewed: {summaryStats.reviewedCount}/{summaryStats.totalFindings}
                    </span>
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-purple-950/40 border border-purple-800/40 text-purple-300 font-mono flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                    <span>
                      WCAG: {summaryStats.conformanceCount} | Advisory:{' '}
                      {summaryStats.advisoryCount}
                    </span>
                  </span>
                </div>
              </div>

              {/* Filter and Sorting Control Bar */}
              <FindingFilterBar
                totalCount={currentFindings.length}
                filteredCount={filteredFindings.length}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedImpact={selectedImpact}
                onImpactChange={setSelectedImpact}
                conformance={conformanceFilter}
                onConformanceChange={setConformanceFilter}
                reviewStatus={reviewStatusFilter}
                onReviewStatusChange={setReviewStatusFilter}
                groupBy={groupBy}
                onGroupByChange={setGroupBy}
                sortBy={sortBy}
                onSortByChange={setSortBy}
                onResetFilters={handleResetFilters}
                isFilterActive={isFilterActive}
              />

              {/* Grouped or Flat Finding List */}
              <GroupedFindingList
                findings={filteredFindings}
                groupBy={groupBy}
                remediationRecords={remediationRecords}
                onSelectFinding={(f) => {
                  setSelectedFinding(f);
                  setSelectedRoom(null);
                }}
                onToggleReviewed={
                  isViewingComparison || isViewingHistorical
                    ? undefined
                    : handleToggleReviewed
                }
                onResetFilters={handleResetFilters}
                isDemo={isDemoMode}
              />
            </section>
          )}
      </main>

      {/* The Archive of Past Hauntings History Drawer */}
      <ScanHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => {
          setIsHistoryOpen(false);
          setHistoryInitialTab('archive');
          setHistoryCompareBaselineId(null);
        }}
        currentSnapshotId={historicalScanRecord?.id}
        initialTab={historyInitialTab}
        initialCompareBaselineId={historyCompareBaselineId}
        onSelectSnapshot={(scan) => {
          setActiveComparison(null);
          setHistoricalScanRecord(scan);
          setSelectedRoom(null);
          setSelectedFinding(null);
        }}
        onStartComparison={async (baselineScan, targetScan) => {
          let records = remediationRecords;
          try {
            records = await remediationTracker.getAllRecords();
            setRemediationRecords(records);
          } catch {
            // fallback to in-memory records
          }
          const diff = compareScans(baselineScan, targetScan, {
            remediationRecords: records,
          });
          setActiveComparison({
            baselineScan,
            targetScan,
            comparison: diff,
            categoryFilter: 'all',
          });
          setSelectedRoom(null);
          setSelectedFinding(null);
        }}
        onSnapshotDeleted={(deletedId) => {
          if (activeScanRecord?.id === deletedId) {
            setActiveScanRecord(null);
            setScanComparison(null);
            setVerificationSummary(null);
          }
          if (historicalScanRecord?.id === deletedId) {
            setIsExportOpen(false); // Close export modal if currently viewing deleted snapshot (DEF-845)
            setHistoricalScanRecord(null);
            setSelectedRoom(null);
            setSelectedFinding(null);
          }
          if (
            activeComparison &&
            (activeComparison.baselineScan.id === deletedId ||
              activeComparison.targetScan.id === deletedId)
          ) {
            setActiveComparison(null);
            setSelectedRoom(null);
            setSelectedFinding(null);
          }
        }}
        onHistoryCleared={() => {
          setIsExportOpen(false); // Close export modal when history is cleared (DEF-845)
          setActiveScanRecord(null);
          setScanComparison(null);
          setVerificationSummary(null);
          setHistoricalScanRecord(null);
          setActiveComparison(null);
          setSelectedRoom(null);
          setSelectedFinding(null);
        }}
        triggerRef={historyTriggerRef}
      />

      {/* Phase 8: Privacy Export Options Modal */}
      <ExportReportDialog
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        scan={exportableScan}
        triggerRef={exportTriggerRef}
        remediationRecords={remediationRecords}
      />

      {/* Footer & Compliance Notice (WCAG 2.2 Truth in Advertising) */}
      <footer
        role="contentinfo"
        className="mt-auto border-t border-border-subtle bg-surface px-6 py-4 text-xs text-gray-400 text-center space-y-1"
      >
        <p className="font-semibold text-gray-300">
          Privacy-First Architecture • No remote data transmission in MVP
        </p>
        <p className="text-[11px] text-gray-400 max-w-3xl mx-auto">
          Phantom Audit performs automated accessibility evaluations using locally bundled
          axe-core. Zero automated findings does not certify WCAG 2.2 conformance. Manual
          keyboard testing, screen-reader evaluation, and cognitive reviews remain
          essential.
        </p>
      </footer>
    </div>
  );
}
