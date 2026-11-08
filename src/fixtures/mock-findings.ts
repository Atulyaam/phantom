/**
 * Phase 2 — Mock Findings Fixtures
 *
 * ⚠️ DEMO DATA ONLY — These are illustrative accessibility findings
 * used exclusively to demonstrate the Phantom Audit UI.
 * They do NOT represent actual scan results from any real website.
 */

import type { FindingRecord } from '@/domain/finding';
import type { RoomId } from '@/domain/room';

/** Label prepended to all mock data display strings */
export const DEMO_LABEL = '[DEMO]';

export const MOCK_FINDINGS: FindingRecord[] = [
  // ── Name Chamber (critical + serious) ──
  {
    fingerprint: 'v1:button-name:demo-btn-1',
    ruleId: 'button-name',
    impact: 'critical',
    description: 'Ensures buttons have discernible text that describes their purpose.',
    help: 'Buttons must have discernible text',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/button-name',
    wcagTags: ['wcag2a', 'wcag412'],
    roomId: 'name-chamber',
    affectedNodeCount: 3,
    nodes: [
      {
        target: ['button.icon-only'],
        htmlExcerpt: '<button class="icon-only"><svg>...</svg></button>',
        failureSummary:
          'Fix any of the following: Element does not have inner text that is visible to screen readers. aria-label attribute does not exist or is empty.',
      },
      {
        target: ['button#close-modal'],
        htmlExcerpt: '<button id="close-modal">×</button>',
        failureSummary:
          'Fix any of the following: Element does not have inner text that is visible to screen readers.',
      },
      {
        target: ['button.hamburger'],
        htmlExcerpt: '<button class="hamburger"><span></span></button>',
        failureSummary:
          'Fix any of the following: Element does not have inner text or aria-label.',
      },
    ],
    firstSeenAt: '2026-10-31T20:00:00.000Z',
    reviewed: false,
  },
  {
    fingerprint: 'v1:link-name:demo-link-1',
    ruleId: 'link-name',
    impact: 'serious',
    description: 'Ensures links have discernible text.',
    help: 'Links must have discernible text',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/link-name',
    wcagTags: ['wcag2a', 'wcag412', 'wcag244'],
    roomId: 'name-chamber',
    affectedNodeCount: 2,
    nodes: [
      {
        target: ['a.social-icon'],
        htmlExcerpt: '<a class="social-icon" href="/twitter"><svg>...</svg></a>',
        failureSummary:
          'Fix any of the following: Element is in tab order and does not have accessible text.',
      },
      {
        target: ['a#logo-link'],
        htmlExcerpt: '<a id="logo-link" href="/"><img src="logo.png"></a>',
        failureSummary:
          'Fix any of the following: Element does not have text that is visible to screen readers.',
      },
    ],
    firstSeenAt: '2026-10-31T20:00:00.000Z',
    reviewed: false,
  },

  // ── Contrast Crypt (serious + moderate) ──
  {
    fingerprint: 'v1:color-contrast:demo-cc-1',
    ruleId: 'color-contrast',
    impact: 'serious',
    description:
      'Ensures the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds.',
    help: 'Elements must meet minimum color contrast ratio thresholds',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast',
    wcagTags: ['wcag2aa', 'wcag143'],
    roomId: 'contrast-crypt',
    affectedNodeCount: 5,
    nodes: [
      {
        target: ['p.subtle-text'],
        htmlExcerpt: '<p class="subtle-text" style="color: #999">Light gray on white</p>',
        failureSummary:
          'Fix any of the following: Element has insufficient color contrast of 2.85 (foreground: #999999, background: #ffffff, font size: 12pt, expected ratio: 4.5:1).',
      },
      {
        target: ['span.footer-link'],
        htmlExcerpt: '<span class="footer-link" style="color: #aaa">Terms</span>',
        failureSummary:
          'Fix any of the following: Element has insufficient color contrast of 2.32.',
      },
    ],
    firstSeenAt: '2026-10-31T20:00:00.000Z',
    reviewed: false,
  },

  // ── Portrait Gallery (serious) ──
  {
    fingerprint: 'v1:image-alt:demo-img-1',
    ruleId: 'image-alt',
    impact: 'critical',
    description:
      'Ensures <img> elements have alternate text or a role of none or presentation.',
    help: 'Images must have alternate text',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/image-alt',
    wcagTags: ['wcag2a', 'wcag111'],
    roomId: 'portrait-gallery',
    affectedNodeCount: 4,
    nodes: [
      {
        target: ['img.hero-banner'],
        htmlExcerpt: '<img class="hero-banner" src="/images/hero.jpg">',
        failureSummary:
          'Fix any of the following: Element does not have an alt attribute. aria-label attribute does not exist or is empty.',
      },
      {
        target: ['img.product-thumb'],
        htmlExcerpt: '<img class="product-thumb" src="/images/product-1.jpg">',
        failureSummary:
          'Fix any of the following: Element does not have an alt attribute.',
      },
    ],
    firstSeenAt: '2026-10-31T20:00:00.000Z',
    reviewed: true,
  },

  // ── Form Cellar (serious) ──
  {
    fingerprint: 'v1:label:demo-label-1',
    ruleId: 'label',
    impact: 'serious',
    description: 'Ensures every form element has a label.',
    help: 'Form elements must have labels',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/label',
    wcagTags: ['wcag2a', 'wcag412', 'wcag131'],
    roomId: 'form-cellar',
    affectedNodeCount: 3,
    nodes: [
      {
        target: ['input#search'],
        htmlExcerpt: '<input id="search" type="text" placeholder="Search...">',
        failureSummary:
          'Fix any of the following: Form element does not have an implicit (wrapped) <label>. aria-label attribute does not exist or is empty.',
      },
      {
        target: ['select#country'],
        htmlExcerpt: '<select id="country"><option>Select country</option></select>',
        failureSummary:
          'Fix any of the following: Form element does not have an associated label.',
      },
    ],
    firstSeenAt: '2026-10-31T20:00:00.000Z',
    reviewed: false,
  },

  // ── Structure Hall (moderate) ──
  {
    fingerprint: 'v1:heading-order:demo-heading-1',
    ruleId: 'heading-order',
    impact: 'moderate',
    description: 'Ensures the order of headings is semantically correct.',
    help: 'Heading levels should only increase by one',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/heading-order',
    wcagTags: ['best-practice'],
    roomId: 'structure-hall',
    affectedNodeCount: 2,
    nodes: [
      {
        target: ['h4.section-title'],
        htmlExcerpt: '<h4 class="section-title">Features</h4>',
        failureSummary:
          'Fix any of the following: Heading order invalid: expected h2 or h3 but found h4.',
      },
    ],
    firstSeenAt: '2026-10-31T20:00:00.000Z',
    reviewed: false,
  },
  {
    fingerprint: 'v1:landmark-one-main:demo-landmark-1',
    ruleId: 'landmark-one-main',
    impact: 'moderate',
    description: 'Ensures the document has a main landmark.',
    help: 'Document should have one main landmark',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/landmark-one-main',
    wcagTags: ['best-practice'],
    roomId: 'structure-hall',
    affectedNodeCount: 1,
    nodes: [
      {
        target: ['html'],
        htmlExcerpt: '<html lang="en">',
        failureSummary:
          'Fix any of the following: Document does not have a main landmark.',
      },
    ],
    firstSeenAt: '2026-10-31T20:00:00.000Z',
    reviewed: false,
  },

  // ── Focus Corridor (serious + minor) ──
  {
    fingerprint: 'v1:tabindex:demo-tabindex-1',
    ruleId: 'tabindex',
    impact: 'serious',
    description: 'Ensures tabindex attribute values are not greater than 0.',
    help: 'Elements should not have tabindex greater than zero',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/tabindex',
    wcagTags: ['wcag2a', 'wcag241'],
    roomId: 'focus-corridor',
    affectedNodeCount: 2,
    nodes: [
      {
        target: ['div.modal-overlay[tabindex="5"]'],
        htmlExcerpt: '<div class="modal-overlay" tabindex="5">...</div>',
        failureSummary:
          'Fix any of the following: Element has a tabindex greater than 0.',
      },
    ],
    firstSeenAt: '2026-10-31T20:00:00.000Z',
    reviewed: false,
  },
  {
    fingerprint: 'v1:bypass:demo-bypass-1',
    ruleId: 'bypass',
    impact: 'minor',
    description:
      'Ensures each page has at least one mechanism for a user to bypass navigation and jump to content.',
    help: 'Page must have means to bypass repeated blocks',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/bypass',
    wcagTags: ['wcag2a', 'wcag241'],
    roomId: 'focus-corridor',
    affectedNodeCount: 1,
    nodes: [
      {
        target: ['html'],
        htmlExcerpt: '<html lang="en">',
        failureSummary:
          'Fix any of the following: No valid skip link found. Document does not have a header.',
      },
    ],
    firstSeenAt: '2026-10-31T20:00:00.000Z',
    reviewed: false,
  },

  // ── Unmapped Catacombs (minor) ──
  {
    fingerprint: 'v1:html-has-lang:demo-lang-1',
    ruleId: 'html-has-lang',
    impact: 'serious',
    description: 'Ensures every HTML document has a lang attribute.',
    help: '<html> element must have a lang attribute',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/html-has-lang',
    wcagTags: ['wcag2a', 'wcag311'],
    roomId: 'other',
    affectedNodeCount: 1,
    nodes: [
      {
        target: ['html'],
        htmlExcerpt: '<html>',
        failureSummary:
          'Fix any of the following: The <html> element does not have a lang attribute.',
      },
    ],
    firstSeenAt: '2026-10-31T20:00:00.000Z',
    reviewed: false,
  },
];

/**
 * Get mock findings filtered by room.
 */
export function getMockFindingsByRoom(roomId: RoomId): FindingRecord[] {
  return MOCK_FINDINGS.filter((f) => f.roomId === roomId);
}

/**
 * Compute room finding summary counts from mock data.
 */
export function getMockRoomSummary(): Record<
  RoomId,
  { total: number; critical: number; serious: number; moderate: number; minor: number }
> {
  const summary = {} as Record<
    RoomId,
    { total: number; critical: number; serious: number; moderate: number; minor: number }
  >;

  const rooms: RoomId[] = [
    'name-chamber',
    'contrast-crypt',
    'portrait-gallery',
    'form-cellar',
    'structure-hall',
    'focus-corridor',
    'other',
  ];

  for (const roomId of rooms) {
    const roomFindings = MOCK_FINDINGS.filter((f) => f.roomId === roomId);
    summary[roomId] = {
      total: roomFindings.length,
      critical: roomFindings.filter((f) => f.impact === 'critical').length,
      serious: roomFindings.filter((f) => f.impact === 'serious').length,
      moderate: roomFindings.filter((f) => f.impact === 'moderate').length,
      minor: roomFindings.filter((f) => f.impact === 'minor').length,
    };
  }

  return summary;
}
