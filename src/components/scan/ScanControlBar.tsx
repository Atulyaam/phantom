import { useState, useRef } from 'react';
import {
  Play,
  Shield,
  RefreshCw,
  AlertOctagon,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { Button, Badge } from '@/components/shared';
import { ActiveTabExplainer } from './ActiveTabExplainer';
import type { TargetTabConnectionStatus } from '@/features/tab-management/use-target-tab';
import type { TabEligibilityResult } from '@/features/tab-management/url-validator';

interface ScanControlBarProps {
  tabId: number | null;
  targetUrl: string;
  connectionStatus: TargetTabConnectionStatus;
  eligibility: TabEligibilityResult;
  isPreparingScan: boolean;
  scanHandshakeMessage: string | null;
  scanPhase?: string;
  errorMessage: string | null;
  onStartAudit: () => void;
  onRefreshStatus: () => void;
}

const statusBadgeConfig: Record<
  TargetTabConnectionStatus,
  {
    label: string;
    variant: 'success' | 'warning' | 'danger' | 'muted';
    icon: typeof CheckCircle2;
  }
> = {
  connected: { label: 'Target Tab Live', variant: 'success', icon: CheckCircle2 },
  navigated: { label: 'Target Navigated', variant: 'warning', icon: AlertTriangle },
  closed: { label: 'Target Tab Closed', variant: 'danger', icon: AlertOctagon },
  ineligible: { label: 'Ineligible Target', variant: 'danger', icon: AlertOctagon },
  standalone: { label: 'Standalone Launch', variant: 'muted', icon: AlertTriangle },
  loading: { label: 'Checking Tab...', variant: 'muted', icon: RefreshCw },
  error: { label: 'Connection Error', variant: 'danger', icon: AlertOctagon },
};

/**
 * ScanControlBar provides explicit audit invocation controls (FR-002),
 * live target tab connection state, and activeTab privacy explanations.
 */
export function ScanControlBar({
  tabId,
  connectionStatus,
  eligibility,
  isPreparingScan,
  scanHandshakeMessage,
  errorMessage,
  onStartAudit,
  onRefreshStatus,
}: ScanControlBarProps) {
  const [showExplainer, setShowExplainer] = useState(false);
  const privacyTriggerRef = useRef<HTMLButtonElement | null>(null);

  const badgeConfig = statusBadgeConfig[connectionStatus];
  const StatusIcon = badgeConfig.icon;

  const canStartScan =
    connectionStatus === 'connected' ||
    connectionStatus === 'navigated' ||
    (connectionStatus === 'standalone' && eligibility.isEligible);

  return (
    <>
      <section
        aria-labelledby="scan-control-heading"
        className="p-4 rounded-xl bg-surface border border-border-default shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2
              id="scan-control-heading"
              className="text-xs font-semibold text-gray-300 uppercase tracking-wider"
            >
              Target Tab Integration
            </h2>
            <Badge variant={badgeConfig.variant} className="flex items-center gap-1">
              <StatusIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>{badgeConfig.label}</span>
            </Badge>
          </div>

          <p className="text-xs text-gray-400">
            {connectionStatus === 'ineligible'
              ? eligibility.title || 'This browser page cannot be audited.'
              : connectionStatus === 'closed'
                ? 'The target tab was closed. Please navigate to a page and open Phantom Audit again.'
                : 'Explicit user action required to initiate accessibility evaluation.'}
          </p>

          {errorMessage && (
            <p className="text-xs text-red-400 flex items-center gap-1 font-medium pt-1">
              <AlertOctagon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </p>
          )}

          {scanHandshakeMessage && (
            <p className="text-xs text-emerald-400 flex items-center gap-1 font-medium pt-1">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{scanHandshakeMessage}</span>
            </p>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            ref={privacyTriggerRef}
            type="button"
            onClick={() => setShowExplainer(true)}
            className="text-xs text-purple-300 hover:text-purple-200 flex items-center gap-1 px-2 py-1.5 rounded transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <Shield className="w-3.5 h-3.5" aria-hidden="true" />
            <span>activeTab Privacy</span>
            <ExternalLink className="w-3 h-3 text-purple-400" aria-hidden="true" />
          </button>

          {tabId && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onRefreshStatus}
              title="Refresh connection status of target tab"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Check Tab</span>
            </Button>
          )}

          <Button
            variant="primary"
            size="md"
            disabled={!canStartScan || isPreparingScan}
            onClick={onStartAudit}
            className="shadow-glow"
          >
            <Play
              className={`w-4 h-4 fill-current ${isPreparingScan ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>
              {isPreparingScan ? 'Auditing Active Tab...' : 'Start Accessibility Audit'}
            </span>
          </Button>
        </div>
      </section>

      {/* activeTab Permission Explainer Modal */}
      <ActiveTabExplainer
        isOpen={showExplainer}
        onClose={() => setShowExplainer(false)}
        triggerRef={privacyTriggerRef}
      />
    </>
  );
}
