import { Ghost, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/shared';

export type EmptyStateType = 'no-scan' | 'clean-audit' | 'error' | 'unsupported';

interface EmptyStateProps {
  type: EmptyStateType;
  onAction?: () => void;
  actionLabel?: string;
  errorMessage?: string;
}

const stateConfig: Record<
  EmptyStateType,
  {
    icon: typeof Ghost;
    title: string;
    description: string;
    iconColor: string;
    bgColor: string;
  }
> = {
  'no-scan': {
    icon: Ghost,
    title: 'The Mansion Lies Dormant',
    description:
      'Launch an accessibility audit on the active page to awaken the mansion rooms and reveal any haunting defects.',
    iconColor: 'text-purple-400',
    bgColor: 'bg-purple-950/40 border-purple-800/40',
  },
  'clean-audit': {
    icon: CheckCircle2,
    title: 'The Mansion is Peaceful',
    description:
      'No automated accessibility findings were detected across all rooms. Note that manual testing is still required for full WCAG conformance.',
    iconColor: 'text-emerald-400',
    bgColor: 'bg-emerald-950/40 border-emerald-800/40',
  },
  error: {
    icon: AlertCircle,
    title: 'A Dark Cloud Approaches',
    description:
      'An unexpected error occurred during the audit process. Please try again or inspect the console for details.',
    iconColor: 'text-red-400',
    bgColor: 'bg-red-950/40 border-red-800/40',
  },
  unsupported: {
    icon: AlertCircle,
    title: 'Forbidden Territory',
    description:
      'Phantom Audit cannot inspect browser-internal pages due to browser security restrictions. Navigate to a standard webpage to begin.',
    iconColor: 'text-amber-400',
    bgColor: 'bg-amber-950/40 border-amber-800/40',
  },
};

/**
 * EmptyState component for various application states.
 * Clear messaging and actionable next steps.
 */
export function EmptyState({
  type,
  onAction,
  actionLabel,
  errorMessage,
}: EmptyStateProps) {
  const config = stateConfig[type];
  const Icon = config.icon;

  return (
    <div
      role="region"
      aria-label={config.title}
      className="p-8 rounded-xl bg-surface border border-border-default text-center max-w-lg mx-auto space-y-4"
    >
      <div
        className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center border ${config.bgColor}`}
      >
        <Icon className={`w-7 h-7 ${config.iconColor}`} aria-hidden="true" />
      </div>

      <div className="space-y-1.5">
        <h3 className="text-base font-bold text-white font-display">{config.title}</h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          {errorMessage || config.description}
        </p>
      </div>

      {onAction && actionLabel && (
        <div className="pt-2">
          <Button variant="primary" size="sm" onClick={onAction}>
            <Sparkles className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
