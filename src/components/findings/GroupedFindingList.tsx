import { useState } from 'react';
import { ChevronDown, ChevronUp, Compass, Ghost, FolderOpen } from 'lucide-react';
import type { FindingRecord, Impact, WcagPrinciple } from '@/domain/finding';
import type { RemediationStoragePayload } from '@/domain/remediation';
import { MANSION_ROOMS, type RoomId } from '@/domain/room';
import { FindingCard } from './FindingCard';
import type { GroupByOption } from './FindingFilterBar';
import {
  groupByRoom,
  groupBySeverity,
  groupByPrinciple,
} from '@/features/findings/finding-aggregation';
import { SeverityBadge } from '@/components/shared';

interface GroupedFindingListProps {
  findings: FindingRecord[];
  groupBy: GroupByOption;
  remediationRecords?: RemediationStoragePayload;
  onSelectFinding?: (finding: FindingRecord) => void;
  onToggleReviewed?: (finding: FindingRecord) => void;
  onResetFilters?: () => void;
  isDemo?: boolean;
}

const PRINCIPLE_TITLES: Record<WcagPrinciple, string> = {
  perceivable: 'Principle 1: Perceivable',
  operable: 'Principle 2: Operable',
  understandable: 'Principle 3: Understandable',
  robust: 'Principle 4: Robust',
  'best-practice': 'Advisory Best Practice',
};

const SEVERITY_ORDER: Impact[] = ['critical', 'serious', 'moderate', 'minor', 'unknown'];
const PRINCIPLE_ORDER: WcagPrinciple[] = [
  'perceivable',
  'operable',
  'understandable',
  'robust',
  'best-practice',
];

export function GroupedFindingList({
  findings,
  groupBy,
  remediationRecords,
  onSelectFinding,
  onToggleReviewed,
  onResetFilters,
  isDemo = false,
}: GroupedFindingListProps) {
  // Collapsed group state: map of group key -> boolean
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // 1. Empty State
  if (findings.length === 0) {
    return (
      <div
        role="region"
        aria-label="No findings found"
        className="p-8 rounded-xl bg-surface border border-border-default text-center space-y-3"
      >
        <div className="w-10 h-10 rounded-full bg-purple-950/60 border border-purple-800/40 text-purple-300 flex items-center justify-center mx-auto">
          <FolderOpen className="w-5 h-5 text-purple-400" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-gray-200">
            No matching accessibility findings
          </h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            No issues match the active search term, severity filter, or conformance
            criteria.
          </p>
        </div>
        {onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="px-3 py-1.5 rounded-lg bg-surface-raised border border-border-default hover:bg-surface-overlay text-cyan-300 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            Reset Active Filters
          </button>
        )}
      </div>
    );
  }

  // 2. Flat List (groupBy === 'none')
  if (groupBy === 'none') {
    return (
      <div
        className="space-y-3"
        role="feed"
        aria-label="Flat accessibility findings list"
      >
        {findings.map((finding) => (
          <FindingCard
            key={finding.fingerprint}
            finding={finding}
            remediationStatus={remediationRecords?.[finding.fingerprint]?.status}
            isRegression={Boolean(
              remediationRecords?.[finding.fingerprint]?.isRegression
            )}
            onSelectForInspection={onSelectFinding}
            onToggleReviewed={onToggleReviewed}
            isDemo={isDemo}
          />
        ))}
      </div>
    );
  }

  // 3. Group by Room
  if (groupBy === 'room') {
    const roomGroups = groupByRoom(findings);
    const roomKeys = (Object.keys(roomGroups) as RoomId[]).filter(
      (roomId) => (roomGroups[roomId] || []).length > 0
    );

    return (
      <div
        className="space-y-4"
        role="feed"
        aria-label="Findings grouped by mansion room"
      >
        {roomKeys.map((roomId) => {
          const roomDef = MANSION_ROOMS[roomId];
          const roomFindings = roomGroups[roomId];
          const isCollapsed = collapsedGroups[roomId] ?? false;

          return (
            <section
              key={roomId}
              className="rounded-xl bg-surface border border-border-default overflow-hidden shadow-sm"
              aria-labelledby={`room-group-heading-${roomId}`}
            >
              <button
                type="button"
                onClick={() => toggleGroup(roomId)}
                aria-expanded={!isCollapsed}
                className="w-full p-3.5 bg-surface-raised hover:bg-surface-overlay border-b border-border-subtle flex items-center justify-between text-left transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-md bg-purple-950/60 text-purple-300 border border-purple-800/40">
                    <Ghost className="w-4 h-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h3
                      id={`room-group-heading-${roomId}`}
                      className="text-xs font-bold text-white font-display flex items-center gap-2"
                    >
                      <span>{roomDef?.name || roomId}</span>
                      <span className="text-[11px] text-purple-300/80 font-normal italic">
                        "{roomDef?.themeTitle || ''}"
                      </span>
                    </h3>
                    <span className="text-[10px] font-mono text-gray-400">
                      {roomDef?.wcagFamily || 'General'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface border border-border-subtle text-red-400 font-bold">
                    {roomFindings.length} issue{roomFindings.length !== 1 ? 's' : ''}
                  </span>
                  {isCollapsed ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </button>

              {!isCollapsed && (
                <div className="p-4 space-y-3">
                  {roomFindings.map((finding) => (
                    <FindingCard
                      key={finding.fingerprint}
                      finding={finding}
                      remediationStatus={
                        remediationRecords?.[finding.fingerprint]?.status
                      }
                      isRegression={Boolean(
                        remediationRecords?.[finding.fingerprint]?.isRegression
                      )}
                      onSelectForInspection={onSelectFinding}
                      onToggleReviewed={onToggleReviewed}
                      isDemo={isDemo}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  // 4. Group by Severity
  if (groupBy === 'severity') {
    const severityGroups = groupBySeverity(findings);
    const activeSeverities = SEVERITY_ORDER.filter(
      (impact) => (severityGroups[impact] || []).length > 0
    );

    return (
      <div
        className="space-y-4"
        role="feed"
        aria-label="Findings grouped by severity impact"
      >
        {activeSeverities.map((impact) => {
          const impactFindings = severityGroups[impact];
          const isCollapsed = collapsedGroups[impact] ?? false;

          return (
            <section
              key={impact}
              className="rounded-xl bg-surface border border-border-default overflow-hidden shadow-sm"
              aria-labelledby={`severity-group-heading-${impact}`}
            >
              <button
                type="button"
                onClick={() => toggleGroup(impact)}
                aria-expanded={!isCollapsed}
                className="w-full p-3.5 bg-surface-raised hover:bg-surface-overlay border-b border-border-subtle flex items-center justify-between text-left transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <div className="flex items-center gap-2.5">
                  <SeverityBadge impact={impact} />
                  <h3
                    id={`severity-group-heading-${impact}`}
                    className="text-xs font-bold text-white uppercase tracking-wider font-mono"
                  >
                    {impact} Severity
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface border border-border-subtle text-gray-200">
                    {impactFindings.length} finding
                    {impactFindings.length !== 1 ? 's' : ''}
                  </span>
                  {isCollapsed ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </button>

              {!isCollapsed && (
                <div className="p-4 space-y-3">
                  {impactFindings.map((finding) => (
                    <FindingCard
                      key={finding.fingerprint}
                      finding={finding}
                      remediationStatus={
                        remediationRecords?.[finding.fingerprint]?.status
                      }
                      isRegression={Boolean(
                        remediationRecords?.[finding.fingerprint]?.isRegression
                      )}
                      onSelectForInspection={onSelectFinding}
                      onToggleReviewed={onToggleReviewed}
                      isDemo={isDemo}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  // 5. Group by Principle
  if (groupBy === 'principle') {
    const principleGroups = groupByPrinciple(findings);
    const activePrinciples = PRINCIPLE_ORDER.filter(
      (principle) => (principleGroups[principle] || []).length > 0
    );

    return (
      <div
        className="space-y-4"
        role="feed"
        aria-label="Findings grouped by WCAG Principle"
      >
        {activePrinciples.map((principle) => {
          const principleFindings = principleGroups[principle];
          const isCollapsed = collapsedGroups[principle] ?? false;

          return (
            <section
              key={principle}
              className="rounded-xl bg-surface border border-border-default overflow-hidden shadow-sm"
              aria-labelledby={`principle-group-heading-${principle}`}
            >
              <button
                type="button"
                onClick={() => toggleGroup(principle)}
                aria-expanded={!isCollapsed}
                className="w-full p-3.5 bg-surface-raised hover:bg-surface-overlay border-b border-border-subtle flex items-center justify-between text-left transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-md bg-purple-950/60 text-purple-300 border border-purple-800/40">
                    <Compass className="w-4 h-4 text-cyan-400" aria-hidden="true" />
                  </span>
                  <div>
                    <h3
                      id={`principle-group-heading-${principle}`}
                      className="text-xs font-bold text-white font-display"
                    >
                      {PRINCIPLE_TITLES[principle]}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface border border-border-subtle text-purple-300 font-bold">
                    {principleFindings.length} issue
                    {principleFindings.length !== 1 ? 's' : ''}
                  </span>
                  {isCollapsed ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </button>

              {!isCollapsed && (
                <div className="p-4 space-y-3">
                  {principleFindings.map((finding) => (
                    <FindingCard
                      key={finding.fingerprint}
                      finding={finding}
                      remediationStatus={
                        remediationRecords?.[finding.fingerprint]?.status
                      }
                      isRegression={Boolean(
                        remediationRecords?.[finding.fingerprint]?.isRegression
                      )}
                      onSelectForInspection={onSelectFinding}
                      onToggleReviewed={onToggleReviewed}
                      isDemo={isDemo}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  return null;
}
