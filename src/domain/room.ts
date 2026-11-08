/**
 * Haunted Mansion Room taxonomy and state models.
 * Maps accessibility problem families to memorable mansion locations.
 */

export type RoomId =
  | 'name-chamber'
  | 'contrast-crypt'
  | 'portrait-gallery'
  | 'form-cellar'
  | 'structure-hall'
  | 'focus-corridor'
  | 'other';

export type RoomState = 'haunted' | 'quiet' | 'not-checked' | 'manual-review';

export interface RoomDefinition {
  id: RoomId;
  name: string;
  themeTitle: string;
  description: string;
  wcagFamily: string;
  primaryRules: string[];
}

export const MANSION_ROOMS: Record<RoomId, RoomDefinition> = {
  'name-chamber': {
    id: 'name-chamber',
    name: 'The Name Chamber',
    themeTitle: 'The Echoing Crypt of Nameless Things',
    description: 'Elements lacking an accessible name or programmatic label.',
    wcagFamily: '4.1.2 Name, Role, Value',
    primaryRules: ['button-name', 'link-name', 'aria-command-name', 'input-button-name'],
  },
  'contrast-crypt': {
    id: 'contrast-crypt',
    name: 'The Contrast Crypt',
    themeTitle: 'The Murky Vault of Shadow and Ink',
    description: 'Text and UI components with insufficient luminance contrast.',
    wcagFamily: '1.4.3 Contrast (Minimum) / 1.4.11 Non-text Contrast',
    primaryRules: ['color-contrast', 'color-contrast-enhanced'],
  },
  'portrait-gallery': {
    id: 'portrait-gallery',
    name: 'The Portrait Gallery',
    themeTitle: 'The Silent Hall of Blank Canvases',
    description: 'Images and graphic media missing alternative descriptions.',
    wcagFamily: '1.1.1 Non-text Content',
    primaryRules: ['image-alt', 'input-image-alt', 'area-alt', 'role-img-alt'],
  },
  'form-cellar': {
    id: 'form-cellar',
    name: 'The Form Cellar',
    themeTitle: 'The Catacombs of Unbound Controls',
    description: 'Form inputs, checkboxes, and controls lacking clear associated labels.',
    wcagFamily: '3.3.2 Labels or Instructions / 1.3.1 Info and Relationships',
    primaryRules: [
      'label',
      'label-title-only',
      'select-name',
      'form-field-multiple-labels',
    ],
  },
  'structure-hall': {
    id: 'structure-hall',
    name: 'The Structure Hall',
    themeTitle: 'The Great Crumbling Staircase',
    description:
      'Broken heading hierarchies, missing landmarks, or invalid list structure.',
    wcagFamily: '1.3.1 Info and Relationships / 2.4.6 Headings and Labels',
    primaryRules: [
      'heading-order',
      'landmark-one-main',
      'region',
      'page-has-heading-one',
    ],
  },
  'focus-corridor': {
    id: 'focus-corridor',
    name: 'The Focus Corridor',
    themeTitle: 'The Labyrinth of Invisible Stepping Stones',
    description: 'Keyboard navigation, tab order traps, or hidden focus indicators.',
    wcagFamily: '2.4.7 Focus Visible / 2.1.1 Keyboard',
    primaryRules: ['focus-order-semantics', 'tabindex', 'bypass'],
  },
  other: {
    id: 'other',
    name: 'The Unmapped Catacombs',
    themeTitle: 'The Outer Fog of Uncharted Anomalies',
    description: 'General accessibility findings not assigned to a primary room.',
    wcagFamily: 'General WCAG Findings',
    primaryRules: [],
  },
};
