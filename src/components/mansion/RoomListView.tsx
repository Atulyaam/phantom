import { type RoomId, type RoomDefinition, type RoomState } from '@/domain/room';
import { RoomStatusBadge } from '@/components/shared';

interface RoomListViewProps {
  rooms: Record<RoomId, RoomDefinition>;
  roomStates: Record<RoomId, RoomState>;
  roomFindingCounts: Record<RoomId, number>;
  selectedRoom: RoomId | null;
  onSelectRoom: (roomId: RoomId) => void;
}

/**
 * Accessible table representation of the mansion taxonomy.
 * Full keyboard navigable alternative to the SVG mansion map.
 */
export function RoomListView({
  rooms,
  roomStates,
  roomFindingCounts,
  selectedRoom,
  onSelectRoom,
}: RoomListViewProps) {
  const roomsList = Object.values(rooms);

  return (
    <div
      role="region"
      aria-label="Mansion Room Taxonomy List"
      className="rounded-xl border border-border-default bg-surface overflow-hidden shadow-mansion"
    >
      <table className="w-full text-left text-xs">
        <caption className="sr-only">
          Mansion Room Taxonomy, Status, and Findings Table
        </caption>
        <thead className="bg-surface-raised text-gray-300 border-b border-border-default">
          <tr>
            <th scope="col" className="p-3 font-semibold">
              Room Name
            </th>
            <th scope="col" className="p-3 font-semibold">
              Thematic Title
            </th>
            <th scope="col" className="p-3 font-semibold">
              WCAG Criteria
            </th>
            <th scope="col" className="p-3 font-semibold">
              Status
            </th>
            <th scope="col" className="p-3 font-semibold text-right">
              Findings
            </th>
            <th scope="col" className="p-3 font-semibold text-right">
              Action
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle text-gray-300">
          {roomsList.map((room) => {
            const state = roomStates[room.id];
            const count = roomFindingCounts[room.id] ?? 0;
            const isSelected = selectedRoom === room.id;

            return (
              <tr
                key={room.id}
                className={`transition-colors ${
                  isSelected
                    ? 'bg-purple-950/30 border-l-2 border-purple-500'
                    : 'hover:bg-surface-raised/50'
                }`}
              >
                <td className="p-3 font-medium text-white">{room.name}</td>
                <td className="p-3 italic text-purple-300">{room.themeTitle}</td>
                <td className="p-3 font-mono text-gray-400">{room.wcagFamily}</td>
                <td className="p-3">
                  <RoomStatusBadge state={state} />
                </td>
                <td className="p-3 text-right font-mono">
                  {state === 'not-checked' ? (
                    <span className="text-gray-500">—</span>
                  ) : count > 0 ? (
                    <span className="text-red-400 font-bold">{count}</span>
                  ) : (
                    <span className="text-emerald-400">0</span>
                  )}
                </td>
                <td className="p-3 text-right">
                  <button
                    type="button"
                    onClick={() => onSelectRoom(room.id)}
                    aria-pressed={isSelected}
                    aria-label={
                      isSelected
                        ? `${room.name} room selected`
                        : `Inspect ${room.name} room details`
                    }
                    className="px-2.5 py-1 text-xs rounded bg-surface-raised border border-border-default hover:bg-surface-overlay text-gray-200 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
                  >
                    {isSelected ? 'Selected' : 'Inspect'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
