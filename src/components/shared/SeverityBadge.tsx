import { AlertTriangle, AlertCircle, AlertOctagon, Info, HelpCircle } from 'lucide-react';
import type { Impact } from '@/domain/finding';
import { Badge } from './Badge';

const severityConfig: Record<
  Impact,
  {
    label: string;
    icon: typeof AlertOctagon;
    badgeClass: string;
  }
> = {
  critical: {
    label: 'Critical',
    icon: AlertOctagon,
    badgeClass: 'bg-[var(--color-severity-critical-bg)] border-red-700/50 text-red-300',
  },
  serious: {
    label: 'Serious',
    icon: AlertCircle,
    badgeClass:
      'bg-[var(--color-severity-serious-bg)] border-orange-700/50 text-orange-300',
  },
  moderate: {
    label: 'Moderate',
    icon: AlertTriangle,
    badgeClass:
      'bg-[var(--color-severity-moderate-bg)] border-yellow-700/50 text-yellow-300',
  },
  minor: {
    label: 'Minor',
    icon: Info,
    badgeClass: 'bg-[var(--color-severity-minor-bg)] border-blue-700/50 text-blue-300',
  },
  unknown: {
    label: 'Unknown',
    icon: HelpCircle,
    badgeClass:
      'bg-[var(--color-severity-unknown-bg)] border-purple-700/50 text-purple-300',
  },
};

interface SeverityBadgeProps {
  impact: Impact;
  className?: string;
  showLabel?: boolean;
}

/**
 * Severity badge that communicates impact via color + text + icon.
 * Never relies on color alone (WCAG 1.4.1).
 */
export function SeverityBadge({
  impact,
  className,
  showLabel = true,
}: SeverityBadgeProps) {
  const config = severityConfig[impact];
  const Icon = config.icon;

  return (
    <Badge className={`${config.badgeClass} ${className ?? ''}`}>
      <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
      {showLabel && <span>{config.label}</span>}
      <span className="sr-only">{config.label} severity</span>
    </Badge>
  );
}
