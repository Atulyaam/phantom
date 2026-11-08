import { Sparkles, Wrench, CheckCircle2, AlertOctagon } from 'lucide-react';
import type { RemediationStatus } from '@/domain/remediation';

export interface RemediationStatusBadgeProps {
  status: RemediationStatus;
  isRegression?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  showIcon?: boolean;
}

const STATUS_CONFIG: Record<
  RemediationStatus,
  {
    label: string;
    description: string;
    badgeClasses: string;
    icon: typeof Sparkles;
    iconColor: string;
  }
> = {
  suggested: {
    label: 'Suggested',
    description: 'Remediation pattern available; not yet applied or tested.',
    badgeClasses: 'bg-cyan-950/60 text-cyan-300 border-cyan-700/60 shadow-cyan-950/30',
    icon: Sparkles,
    iconColor: 'text-cyan-400',
  },
  attempted: {
    label: 'Attempted',
    description: 'Remediation has been drafted; pending rescan verification.',
    badgeClasses:
      'bg-amber-950/60 text-amber-300 border-amber-700/60 shadow-amber-950/30',
    icon: Wrench,
    iconColor: 'text-amber-400',
  },
  verified: {
    label: 'Verified',
    description: 'Confirmed resolved by subsequent accessibility scan.',
    badgeClasses:
      'bg-emerald-950/60 text-emerald-300 border-emerald-600/60 shadow-emerald-950/30',
    icon: CheckCircle2,
    iconColor: 'text-emerald-400',
  },
  unresolved: {
    label: 'Unresolved',
    description: 'Defect persists or has regressed upon subsequent rescan.',
    badgeClasses: 'bg-red-950/60 text-red-300 border-red-700/60 shadow-red-950/30',
    icon: AlertOctagon,
    iconColor: 'text-red-400',
  },
};

/**
 * RemediationStatusBadge displays the lifecycle remediation status
 * of an accessibility finding in the Phantom Audit gothic theme.
 */
export function RemediationStatusBadge({
  status,
  isRegression = false,
  size = 'md',
  className = '',
  showIcon = true,
}: RemediationStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.suggested;
  const Icon = config.icon;

  const sizeClasses =
    size === 'sm' ? 'px-1.5 py-0.5 text-[10px] gap-1' : 'px-2 py-0.5 text-xs gap-1.5';

  const accessibleLabel = isRegression
    ? `Remediation status: ${config.label} (Regression detected)`
    : `Remediation status: ${config.label}`;

  return (
    <span className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      <span
        className={`inline-flex items-center font-medium rounded-full border shadow-sm font-sans tracking-wide ${sizeClasses} ${config.badgeClasses}`}
        title={
          isRegression
            ? 'Regression detected: previously verified finding has reappeared.'
            : config.description
        }
        role="status"
        aria-label={accessibleLabel}
      >
        {showIcon && (
          <Icon
            className={`shrink-0 ${size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} ${config.iconColor}`}
            aria-hidden="true"
          />
        )}
        <span>{config.label}</span>
      </span>
      {isRegression && (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-rose-950/80 border border-rose-600/70 text-rose-300 font-mono text-[9px] font-bold uppercase tracking-wider shadow-sm"
          title="Regression: previously verified defect reappeared on subsequent rescan"
          aria-label="Regression detected"
        >
          <AlertOctagon className="w-2.5 h-2.5 text-rose-400" aria-hidden="true" />
          <span>Regression</span>
        </span>
      )}
    </span>
  );
}
