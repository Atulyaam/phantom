import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MansionMap, MansionRoom, RoomListView } from '@/components/mansion';
import { MANSION_ROOMS, type RoomId, type RoomState } from '@/domain/room';

describe('Haunted Mansion Visualization & List Components', () => {
  const defaultStates: Record<RoomId, RoomState> = {
    'name-chamber': 'haunted',
    'contrast-crypt': 'haunted',
    'portrait-gallery': 'quiet',
    'form-cellar': 'not-checked',
    'structure-hall': 'manual-review',
    'focus-corridor': 'haunted',
    other: 'quiet',
  };

  const defaultCounts: Record<RoomId, number> = {
    'name-chamber': 5,
    'contrast-crypt': 2,
    'portrait-gallery': 0,
    'form-cellar': 0,
    'structure-hall': 3,
    'focus-corridor': 1,
    other: 0,
  };

  describe('MansionMap (SVG 2D Interactive Architecture)', () => {
    it('renders all 7 rooms in the SVG structure', () => {
      const handleSelect = vi.fn();
      render(
        <MansionMap
          rooms={MANSION_ROOMS}
          roomStates={defaultStates}
          roomFindingCounts={defaultCounts}
          selectedRoom={null}
          onSelectRoom={handleSelect}
        />
      );

      // Verify container region
      const mapRegion = screen.getByRole('region', {
        name: /haunted mansion 2d map/i,
      });
      expect(mapRegion).toBeInTheDocument();

      // Check all 7 room buttons exist with proper accessible names
      for (const room of Object.values(MANSION_ROOMS)) {
        const roomButton = screen.getByRole('button', {
          name: new RegExp(room.name, 'i'),
        });
        expect(roomButton).toBeInTheDocument();
      }
    });

    it('triggers onSelectRoom when a room is clicked', () => {
      const handleSelect = vi.fn();
      render(
        <MansionMap
          rooms={MANSION_ROOMS}
          roomStates={defaultStates}
          roomFindingCounts={defaultCounts}
          selectedRoom="name-chamber"
          onSelectRoom={handleSelect}
        />
      );

      const contrastCrypt = screen.getByRole('button', {
        name: /the contrast crypt/i,
      });
      fireEvent.click(contrastCrypt);
      expect(handleSelect).toHaveBeenCalledWith('contrast-crypt');
    });
  });

  describe('MansionRoom Keyboard Accessibility', () => {
    it('supports Enter and Space key activation and communicates selected state and focus indicators', () => {
      const handleSelect = vi.fn();
      const { rerender } = render(
        <svg>
          <MansionRoom
            room={MANSION_ROOMS['name-chamber']}
            state="haunted"
            findingCount={5}
            isSelected={false}
            onSelect={handleSelect}
            x={20}
            y={20}
            width={200}
            height={140}
          />
        </svg>
      );

      const roomButton = screen.getByRole('button', {
        name: /the name chamber/i,
      });

      // Verify aria-pressed communicates unselected state
      expect(roomButton).toHaveAttribute('aria-pressed', 'false');

      // Verify parent <g> has group class for Tailwind group-focus-visible (DEF-931)
      expect(roomButton).toHaveClass('group');
      expect(roomButton).toHaveClass('cursor-pointer');
      expect(roomButton).toHaveClass('focus:outline-none');

      // Verify child focus indicator rect exists with group-focus-visible:opacity-100
      const focusRect = roomButton.querySelector('rect.group-focus-visible\\:opacity-100');
      expect(focusRect).toBeInTheDocument();

      // Press Enter
      fireEvent.keyDown(roomButton, { key: 'Enter' });
      expect(handleSelect).toHaveBeenCalledTimes(1);

      // Press Space
      fireEvent.keyDown(roomButton, { key: ' ' });
      expect(handleSelect).toHaveBeenCalledTimes(2);

      // Other keys should not trigger
      fireEvent.keyDown(roomButton, { key: 'Tab' });
      expect(handleSelect).toHaveBeenCalledTimes(2);

      // Rerender as selected and verify aria-pressed communicates selected state
      rerender(
        <svg>
          <MansionRoom
            room={MANSION_ROOMS['name-chamber']}
            state="haunted"
            findingCount={5}
            isSelected={true}
            onSelect={handleSelect}
            x={20}
            y={20}
            width={200}
            height={140}
          />
        </svg>
      );
      expect(roomButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('RoomListView (Accessible Table Alternative)', () => {
    it('renders all 7 rooms in semantic table with disambiguated contextual action buttons', () => {
      const handleSelect = vi.fn();
      render(
        <RoomListView
          rooms={MANSION_ROOMS}
          roomStates={defaultStates}
          roomFindingCounts={defaultCounts}
          selectedRoom="contrast-crypt"
          onSelectRoom={handleSelect}
        />
      );

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(
        screen.getByRole('region', { name: /mansion room taxonomy list/i })
      ).toBeInTheDocument();

      // Check all rooms are rows
      for (const room of Object.values(MANSION_ROOMS)) {
        expect(screen.getByText(room.name)).toBeInTheDocument();
        expect(screen.getByText(room.themeTitle)).toBeInTheDocument();
      }

      // Check that each room button has a disambiguated accessible label including room name (DEF-932)
      for (const room of Object.values(MANSION_ROOMS)) {
        const isSelected = room.id === 'contrast-crypt';
        const expectedName = isSelected
          ? `${room.name} room selected`
          : `Inspect ${room.name} room details`;

        const button = screen.getByRole('button', { name: expectedName });
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute('aria-pressed', isSelected ? 'true' : 'false');
      }

      // Click an inspect button
      const nameChamberBtn = screen.getByRole('button', {
        name: /inspect the name chamber room details/i,
      });
      fireEvent.click(nameChamberBtn);
      expect(handleSelect).toHaveBeenCalledWith('name-chamber');
    });
  });
});
