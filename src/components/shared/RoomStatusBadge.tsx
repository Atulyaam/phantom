import { Ghost, CheckCircle2, CircleDashed, Eye } from 'lucide-react';
import type { RoomState } from '@/domain/room';
import { Badge } from './Badge';

const stateConfig: Record<
  RoomState,
  {
    label: string;
    icon: typeof Ghost;
    variant: 'danger' | 'success' | 'muted' | 'warning';
  }
> = {
  haunted: {
    label: 'Haunted',
    icon: Ghost,
    variant: 'danger',
  },
  quiet: {
    label: 'Quiet',
    icon: CheckCircle2,
    variant: 'success',
  },
  'not-checked': {
    label: 'Not Checked',
    icon: CircleDashed,
    variant: 'muted',
  },
  'manual-review': {
    label: 'Needs Review',
    icon: Eye,
    variant: 'warning',
  },
};

interface RoomStatusBadgeProps {
  state: RoomState;
  className?: string;
}

/**
 * Room status badge using icon + text + color.
 * "Not checked" is visually distinct from "quiet" (clean).
 */
export function RoomStatusBadge({ state, className }: RoomStatusBadgeProps) {
  const config = stateConfig[state];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={className}>
      <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span>{config.label}</span>
    </Badge>
  );
}
