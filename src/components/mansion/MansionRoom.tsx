import { type RoomDefinition, type RoomState } from '@/domain/room';

/** Color mapping for room states */
const STATE_COLORS: Record<
  RoomState,
  { bg: string; border: string; badge: string; text: string }
> = {
  haunted: {
    bg: 'rgba(248, 113, 113, 0.08)',
    border: 'var(--color-room-haunted)',
    badge: 'var(--color-severity-critical)',
    text: '#fca5a5',
  },
  quiet: {
    bg: 'rgba(52, 211, 153, 0.06)',
    border: 'var(--color-room-quiet)',
    badge: 'var(--color-room-quiet)',
    text: '#6ee7b7',
  },
  'not-checked': {
    bg: 'rgba(107, 114, 128, 0.06)',
    border: 'var(--color-border-default)',
    badge: '#6b7280',
    text: '#9ca3af',
  },
  'manual-review': {
    bg: 'rgba(251, 191, 36, 0.06)',
    border: 'var(--color-room-manual)',
    badge: 'var(--color-room-manual)',
    text: '#fcd34d',
  },
};

/** State icon characters */
const STATE_ICONS: Record<RoomState, string> = {
  haunted: '👻',
  quiet: '✓',
  'not-checked': '?',
  'manual-review': '⚠',
};

interface MansionRoomProps {
  room: RoomDefinition;
  state: RoomState;
  findingCount: number;
  isSelected: boolean;
  onSelect: () => void;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Individual SVG room element within the mansion.
 * Keyboard accessible with role="button" and aria-label.
 */
export function MansionRoom({
  room,
  state,
  findingCount,
  isSelected,
  onSelect,
  x,
  y,
  width,
  height,
}: MansionRoomProps) {
  const colors = STATE_COLORS[state];
  const stateIcon = STATE_ICONS[state];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  };

  const stateLabel =
    state === 'haunted'
      ? `${findingCount} finding${findingCount !== 1 ? 's' : ''}`
      : state === 'quiet'
        ? 'No findings'
        : state === 'not-checked'
          ? 'Not yet scanned'
          : 'Needs manual review';

  return (
    <>
      {/* Interactive Room Button Control */}
      <g
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        aria-label={`${room.name}: ${stateLabel}. ${room.description}`}
        onClick={onSelect}
        onKeyDown={handleKeyDown}
        className="group cursor-pointer focus:outline-none"
        data-room-id={room.id}
      >
        {/* Room background */}
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={6}
          fill={colors.bg}
          stroke={isSelected ? 'var(--color-spectral-purple)' : colors.border}
          strokeWidth={isSelected ? 2 : 1}
          className="transition-all"
          style={{
            transitionDuration: 'var(--motion-duration-fast)',
          }}
        />

        {/* Focus indicator rect (shown on keyboard focus) */}
        <rect
          x={x - 3}
          y={y - 3}
          width={width + 6}
          height={height + 6}
          rx={9}
          fill="none"
          stroke="var(--focus-ring-color)"
          strokeWidth="3"
          opacity="0"
          className="group-focus-visible:opacity-100"
          style={{ pointerEvents: 'none' }}
        />

        {/* Selected glow effect */}
        {isSelected && (
          <rect
            x={x - 1}
            y={y - 1}
            width={width + 2}
            height={height + 2}
            rx={7}
            fill="none"
            stroke="var(--color-spectral-purple)"
            strokeWidth="1"
            opacity="0.4"
            filter="url(#roomGlow)"
          />
        )}
      </g>

      {/* Visual Room Content (Labels, Descriptions & Badges) */}
      <g style={{ pointerEvents: 'none' }} aria-hidden="true">
        {/* State badge circle (top-right) */}
        <circle cx={x + width - 16} cy={y + 16} r={10} fill={colors.badge} opacity={0.9} />
        <text
          x={x + width - 16}
          y={y + 20}
          textAnchor="middle"
          fontSize="10"
          fill="white"
          fontFamily="var(--font-sans)"
        >
          {state === 'haunted' ? findingCount : stateIcon}
        </text>

        {/* Room name */}
        <text
          x={x + 12}
          y={y + 28}
          fontSize="12"
          fontWeight="600"
          fill="white"
          fontFamily="var(--font-sans)"
        >
          {room.name}
        </text>

        {/* Thematic title */}
        <text
          x={x + 12}
          y={y + 46}
          fontSize="9"
          fill={colors.text}
          fontFamily="var(--font-display)"
          fontStyle="italic"
        >
          {room.themeTitle.length > 32
            ? room.themeTitle.slice(0, 30) + '…'
            : room.themeTitle}
        </text>

        {/* Description (truncated) */}
        <text
          x={x + 12}
          y={y + 66}
          fontSize="9"
          fill="var(--color-text-secondary)"
          fontFamily="var(--font-sans)"
        >
          {room.description.length > 38
            ? room.description.slice(0, 36) + '…'
            : room.description}
        </text>

        {/* WCAG family */}
        <text
          x={x + 12}
          y={y + height - 18}
          fontSize="8"
          fill="var(--color-text-accent)"
          fontFamily="var(--font-mono)"
        >
          {room.wcagFamily.length > 30
            ? room.wcagFamily.slice(0, 28) + '…'
            : room.wcagFamily}
        </text>

        {/* Rules count */}
        <text
          x={x + width - 12}
          y={y + height - 18}
          textAnchor="end"
          fontSize="8"
          fill="var(--color-text-muted)"
          fontFamily="var(--font-sans)"
        >
          {room.primaryRules.length} rules
        </text>

        {/* Severity mini-bar (only when haunted) */}
        {state === 'haunted' && (
          <rect
            x={x + 12}
            y={y + height - 8}
            width={width - 24}
            height={3}
            rx={1.5}
            fill="var(--color-severity-critical)"
            opacity={0.4}
          />
        )}
      </g>
    </>
  );
}
