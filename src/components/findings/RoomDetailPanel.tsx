import { Ghost, X } from 'lucide-react';
import type { RoomDefinition, RoomState } from '@/domain/room';
import type { FindingRecord } from '@/domain/finding';
import type { RemediationStoragePayload } from '@/domain/remediation';
import { RoomStatusBadge, Button } from '@/components/shared';
import { FindingCard } from './FindingCard';

interface RoomDetailPanelProps {
  room: RoomDefinition;
  state: RoomState;
  findings: FindingRecord[];
  remediationRecords?: RemediationStoragePayload;
  onClose: () => void;
  onSelectFinding: (finding: FindingRecord) => void;
  onToggleReviewed?: (finding: FindingRecord) => void;
  isDemo?: boolean;
}

/**
 * RoomDetailPanel shows full context for a selected mansion room:
 * - Room name, thematic title, description, WCAG family
 * - Associated primary rules
 * - List of findings mapped to this room (with FindingCards)
 */
export function RoomDetailPanel({
  room,
  state,
  findings,
  remediationRecords,
  onClose,
  onSelectFinding,
  onToggleReviewed,
  isDemo = false,
}: RoomDetailPanelProps) {
  return (
    <section
      aria-labelledby="room-detail-heading"
      className="p-6 rounded-xl bg-surface-raised border border-purple-500/40 shadow-glow space-y-5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-md bg-purple-900/40 text-purple-300 border border-purple-700/40">
              <Ghost className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <h3
                id="room-detail-heading"
                className="text-base font-bold text-white font-display"
              >
                {room.name} Taxonomy Inspector
              </h3>
              <p className="text-xs text-purple-300/90 italic font-display">
                "{room.themeTitle}"
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <RoomStatusBadge state={state} />
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close Inspector"
          >
            <X className="w-4 h-4 mr-1" aria-hidden="true" />
            <span>Close Inspector</span>
          </Button>
        </div>
      </div>

      {/* Description & WCAG Family */}
      <div className="p-3.5 rounded-lg bg-surface border border-border-subtle space-y-2">
        <p className="text-xs text-gray-300 leading-relaxed">{room.description}</p>
        <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-xs">
          <span className="text-gray-400">WCAG Family:</span>
          <span className="font-mono text-purple-300">{room.wcagFamily}</span>
        </div>
      </div>

      {/* Primary Rules */}
      <div className="space-y-1.5">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Monitored axe-core Rules ({room.primaryRules.length})
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {room.primaryRules.length > 0 ? (
            room.primaryRules.map((rule) => (
              <span
                key={rule}
                className="px-2 py-0.5 rounded bg-surface border border-border-subtle text-xs font-mono text-gray-300"
              >
                {rule}
              </span>
            ))
          ) : (
            <span className="text-xs text-gray-500 italic">
              General / unmapped accessibility criteria
            </span>
          )}
        </div>
      </div>

      {/* Findings Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            Room Findings ({findings.length})
          </h4>
          {findings.length > 0 && (
            <span className="text-[11px] text-gray-400">
              Click Inspect on any card for full details
            </span>
          )}
        </div>

        {findings.length > 0 ? (
          <div className="space-y-3">
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
        ) : (
          <div className="p-6 rounded-lg bg-surface border border-border-subtle text-center space-y-1">
            <p className="text-xs text-gray-400 font-medium">
              No findings detected in this room.
            </p>
            <p className="text-[11px] text-gray-500">
              {state === 'not-checked'
                ? 'Run an accessibility scan to evaluate this room.'
                : 'All automated criteria passed for this taxonomy category.'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
