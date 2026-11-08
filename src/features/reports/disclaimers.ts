/**
 * Phantom Audit — Automated Testing Limitations & Disclaimers
 *
 * Mandatory, standards-compliant disclosures for accessibility reporting.
 * Explicitly prevents misleading compliance claims (e.g. "100% accessible" or "WCAG certified").
 * Adheres strictly to Section 11 of the project specification.
 */

export const AUTOMATED_TESTING_LIMITATIONS =
  'Automated accessibility testing tools evaluate programmatic indicators and rule violations, ' +
  'such as missing alternative text, insufficient color contrast, missing form labels, and invalid ARIA attributes. ' +
  'However, automated tools can test only a subset of all accessibility requirements and cannot determine ' +
  'complete WCAG conformance. They cannot assess human context, cognitive readability, semantic appropriateness ' +
  'of descriptions, logical reading order, complex dynamic interactions, or real assistive technology experiences. ' +
  'Zero reported automated violations does not establish that a web page is WCAG compliant, accessible, or barrier-free. ' +
  'Comprehensive accessibility requires ongoing human evaluation, including manual keyboard navigation, screen-reader testing, ' +
  'focus order verification, content readability, and zoom/reflow inspection.';

export const MANUAL_REVIEW_CHECKLIST_PROMPTS: readonly string[] = [
  'Can all interactive elements and controls be navigated and operated using only a keyboard?',
  'Is keyboard focus clearly visible at all times and does it move in an intuitive, logical sequence?',
  'Do modal dialogs, flyouts, and menus contain focus and restore focus to the triggering element upon dismissal?',
  'Are instructions, error alerts, and status changes clearly announced by screen readers?',
  'Are error messages descriptive, identifying the problematic field and providing concrete guidance to resolve it?',
  'Are text alternatives provided for all non-decorative visual and auditory media (e.g. captions, transcripts, descriptions)?',
  'Does the interface adapt without content loss or horizontal scrolling at 400% zoom and across responsive viewports?',
  'Is meaning conveyed through text and visual indicators rather than color alone?',
];
