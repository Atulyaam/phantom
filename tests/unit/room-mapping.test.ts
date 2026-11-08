import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { mapRuleToRoom, isValidRoomId } from '@/features/normalization/room-mapper';
import { MANSION_ROOMS, type RoomId } from '@/domain/room';

describe('Room Mapping Engine', () => {
  it('maps known accessibility rules to correct mansion rooms', () => {
    // Name Chamber
    expect(mapRuleToRoom('button-name')).toBe('name-chamber');
    expect(mapRuleToRoom('link-name')).toBe('name-chamber');

    // Contrast Crypt
    expect(mapRuleToRoom('color-contrast')).toBe('contrast-crypt');

    // Portrait Gallery
    expect(mapRuleToRoom('image-alt')).toBe('portrait-gallery');

    // Form Cellar
    expect(mapRuleToRoom('label')).toBe('form-cellar');

    // Structure Hall
    expect(mapRuleToRoom('heading-order')).toBe('structure-hall');

    // Focus Corridor
    expect(mapRuleToRoom('focus-order-semantics')).toBe('focus-corridor');
  });

  it('maps unmapped or unknown rules to "other" (Unmapped Catacombs)', () => {
    expect(mapRuleToRoom('some-future-undiscovered-rule')).toBe('other');
    expect(mapRuleToRoom('')).toBe('other');
    // Prototype pollution / object property shadowing regression checks
    expect(mapRuleToRoom('__proto__')).toBe('other');
    expect(mapRuleToRoom('constructor')).toBe('other');
    expect(mapRuleToRoom('toString')).toBe('other');
    expect(mapRuleToRoom('valueOf')).toBe('other');
    expect(isValidRoomId('__proto__')).toBe(false);
    expect(isValidRoomId('constructor')).toBe(false);
    // @ts-expect-error testing runtime resilience against non-string input
    expect(mapRuleToRoom(null)).toBe('other');
  });

  it('verifies all mapped rooms are present in MANSION_ROOMS definition', () => {
    const allRoomIds: RoomId[] = [
      'name-chamber',
      'contrast-crypt',
      'portrait-gallery',
      'form-cellar',
      'structure-hall',
      'focus-corridor',
      'other',
    ];

    for (const roomId of allRoomIds) {
      expect(isValidRoomId(roomId)).toBe(true);
      expect(MANSION_ROOMS[roomId]).toBeDefined();
      expect(MANSION_ROOMS[roomId].name.length).toBeGreaterThan(0);
      expect(MANSION_ROOMS[roomId].themeTitle.length).toBeGreaterThan(0);
    }
  });

  describe('Property-based testing (fast-check)', () => {
    it('always returns a valid RoomId for any arbitrary string input', () => {
      fc.assert(
        fc.property(fc.string(), (arbitraryRuleId) => {
          const room = mapRuleToRoom(arbitraryRuleId);
          return isValidRoomId(room);
        })
      );
    });

    it('is strictly deterministic: mapping the same rule always produces the same room', () => {
      fc.assert(
        fc.property(fc.string(), (arbitraryRuleId) => {
          const run1 = mapRuleToRoom(arbitraryRuleId);
          const run2 = mapRuleToRoom(arbitraryRuleId);
          return run1 === run2;
        })
      );
    });

    it('is case-insensitive and ignores surrounding whitespace', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('button-name', 'color-contrast', 'image-alt'),
          (rule) => {
            const variation = `  ${rule.toUpperCase()}  `;
            return mapRuleToRoom(variation) === mapRuleToRoom(rule);
          }
        )
      );
    });
  });
});
