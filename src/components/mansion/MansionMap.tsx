import { type RoomId, type RoomDefinition } from '@/domain/room';
import type { RoomState } from '@/domain/room';
import { MansionRoom } from './MansionRoom';

/**
 * SVG layout grid for the 7 mansion rooms.
 * Top row: 3 rooms (upper floor)
 * Middle row: 3 rooms (main floor)
 * Bottom: 1 room (cellar / catacombs)
 *
 * Each room is 200×140 with 20px gutters.
 * Total viewBox: 680 × 490
 */
const ROOM_LAYOUT: Array<{
  roomId: RoomId;
  x: number;
  y: number;
  w: number;
  h: number;
  floor: string;
}> = [
  // Upper Floor (Towers & Attic)
  { roomId: 'name-chamber', x: 20, y: 20, w: 200, h: 140, floor: 'Upper Floor' },
  { roomId: 'contrast-crypt', x: 240, y: 20, w: 200, h: 140, floor: 'Upper Floor' },
  { roomId: 'portrait-gallery', x: 460, y: 20, w: 200, h: 140, floor: 'Upper Floor' },
  // Main Floor
  { roomId: 'form-cellar', x: 20, y: 180, w: 200, h: 140, floor: 'Main Floor' },
  { roomId: 'structure-hall', x: 240, y: 180, w: 200, h: 140, floor: 'Main Floor' },
  { roomId: 'focus-corridor', x: 460, y: 180, w: 200, h: 140, floor: 'Main Floor' },
  // Cellar
  { roomId: 'other', x: 185, y: 340, w: 310, h: 130, floor: 'Cellar' },
];

interface MansionMapProps {
  rooms: Record<RoomId, RoomDefinition>;
  roomStates: Record<RoomId, RoomState>;
  roomFindingCounts: Record<RoomId, number>;
  selectedRoom: RoomId | null;
  onSelectRoom: (roomId: RoomId) => void;
}

/**
 * Interactive 2D SVG haunted mansion visualization.
 * All rooms are keyboard-accessible with ARIA labels.
 * Respects prefers-reduced-motion via CSS token system.
 */
export function MansionMap({
  rooms,
  roomStates,
  roomFindingCounts,
  selectedRoom,
  onSelectRoom,
}: MansionMapProps) {
  return (
    <div
      role="region"
      aria-label="Haunted Mansion 2D Map"
      className="w-full max-w-3xl mx-auto"
    >
      <svg
        viewBox="0 0 680 490"
        className="w-full h-auto"
        aria-label="Phantom Audit Haunted Mansion with 7 accessibility rooms"
      >
        {/* Mansion Outer Shell — Gothic silhouette */}
        <defs>
          <linearGradient id="mansionBg" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--color-bg-surface)" />
            <stop offset="100%" stopColor="var(--color-bg-base)" />
          </linearGradient>
          <filter id="roomGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Gothic arch clip for decorative elements */}
          <clipPath id="archClip">
            <rect x="0" y="0" width="680" height="490" rx="8" />
          </clipPath>
        </defs>

        {/* Full background */}
        <rect
          width="680"
          height="490"
          rx="8"
          fill="url(#mansionBg)"
          stroke="var(--color-border-subtle)"
          strokeWidth="1"
        />

        {/* Decorative roof line */}
        <path
          d="M 20 18 L 340 2 L 660 18"
          fill="none"
          stroke="var(--color-spectral-purple)"
          strokeWidth="1"
          opacity="0.3"
        />

        {/* Floor divider lines */}
        <line
          x1="20"
          y1="170"
          x2="660"
          y2="170"
          stroke="var(--color-border-subtle)"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.5"
        />
        <line
          x1="20"
          y1="330"
          x2="660"
          y2="330"
          stroke="var(--color-border-subtle)"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.5"
        />

        {/* Floor labels */}
        <text
          x="345"
          y="14"
          textAnchor="middle"
          className="fill-gray-500 text-[9px]"
          fontFamily="var(--font-sans)"
        >
          ▲ Upper Floor — Towers & Attic
        </text>
        <text
          x="345"
          y="175"
          textAnchor="middle"
          className="fill-gray-500 text-[9px]"
          fontFamily="var(--font-sans)"
        >
          Main Floor
        </text>
        <text
          x="345"
          y="335"
          textAnchor="middle"
          className="fill-gray-500 text-[9px]"
          fontFamily="var(--font-sans)"
        >
          Cellar & Catacombs
        </text>

        {/* Render each room */}
        {ROOM_LAYOUT.map((layout) => (
          <MansionRoom
            key={layout.roomId}
            room={rooms[layout.roomId]}
            state={roomStates[layout.roomId]}
            findingCount={roomFindingCounts[layout.roomId] ?? 0}
            isSelected={selectedRoom === layout.roomId}
            onSelect={() => onSelectRoom(layout.roomId)}
            x={layout.x}
            y={layout.y}
            width={layout.w}
            height={layout.h}
          />
        ))}
      </svg>
    </div>
  );
}
