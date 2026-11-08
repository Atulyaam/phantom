import { MANSION_ROOMS, type RoomId } from '@/domain/room';

/**
 * Deterministic mapping dictionary from axe rule IDs to Mansion Rooms.
 */
const RULE_TO_ROOM_MAP: Record<string, RoomId> = {
  // The Name Chamber (Accessible Names & Labels)
  'button-name': 'name-chamber',
  'link-name': 'name-chamber',
  'aria-command-name': 'name-chamber',
  'input-button-name': 'name-chamber',
  'aria-dialog-name': 'name-chamber',
  'aria-meter-name': 'name-chamber',
  'aria-progressbar-name': 'name-chamber',
  'aria-treeitem-name': 'name-chamber',
  'aria-input-field-name': 'name-chamber',
  'aria-toggle-field-name': 'name-chamber',
  'frame-title': 'name-chamber',
  'frame-title-unique': 'name-chamber',
  'object-alt': 'name-chamber',

  // The Contrast Crypt (Luminance & Contrast)
  'color-contrast': 'contrast-crypt',
  'color-contrast-enhanced': 'contrast-crypt',
  'link-in-text-block': 'contrast-crypt',

  // The Portrait Gallery (Images & Visual Media)
  'image-alt': 'portrait-gallery',
  'input-image-alt': 'portrait-gallery',
  'area-alt': 'portrait-gallery',
  'role-img-alt': 'portrait-gallery',
  'svg-img-alt': 'portrait-gallery',
  'image-redundant-alt': 'portrait-gallery',

  // The Form Cellar (Form Controls & Labels)
  label: 'form-cellar',
  'label-title-only': 'form-cellar',
  'select-name': 'form-cellar',
  'form-field-multiple-labels': 'form-cellar',
  'autocomplete-valid': 'form-cellar',

  // The Structure Hall (Headings, Landmarks, Document Structure)
  'heading-order': 'structure-hall',
  'landmark-one-main': 'structure-hall',
  'page-has-heading-one': 'structure-hall',
  'document-title': 'structure-hall',
  'html-has-lang': 'structure-hall',
  'valid-lang': 'structure-hall',
  'landmark-unique': 'structure-hall',
  region: 'structure-hall',
  list: 'structure-hall',
  listitem: 'structure-hall',
  'definition-list': 'structure-hall',

  // The Focus Corridor (Keyboard & Focus)
  'focus-order-semantics': 'focus-corridor',
  tabindex: 'focus-corridor',
  bypass: 'focus-corridor',
  accesskeys: 'focus-corridor',
  'nested-interactive': 'focus-corridor',
};

/**
 * Map an axe-core ruleId to a Mansion Room deterministically.
 * Falls back to 'other' (The Unmapped Catacombs) if unmapped.
 */
export function mapRuleToRoom(ruleId: string): RoomId {
  if (!ruleId || typeof ruleId !== 'string') {
    return 'other';
  }
  const normalized = ruleId.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(RULE_TO_ROOM_MAP, normalized)) {
    return RULE_TO_ROOM_MAP[normalized] as RoomId;
  }
  return 'other';
}

/**
 * Check if a room definition exists for a given RoomId.
 */
export function isValidRoomId(roomId: string): roomId is RoomId {
  return (
    typeof roomId === 'string' &&
    Object.prototype.hasOwnProperty.call(MANSION_ROOMS, roomId)
  );
}
