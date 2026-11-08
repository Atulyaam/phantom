import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import axe from 'axe-core';
import { mapRuleToRoom } from '@/features/normalization/room-mapper';
import { SCANNER_CONFIG } from '@/features/scanner/scanner-config';

const fixturesDir = path.resolve(__dirname, '../fixtures/html');

function loadFixture(filename: string): string {
  return fs.readFileSync(path.join(fixturesDir, filename), 'utf-8');
}

function setupDocument(filename: string) {
  const html = loadFixture(filename);
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  document.documentElement.innerHTML = doc.documentElement.innerHTML;
  document.documentElement.setAttribute(
    'lang',
    doc.documentElement.getAttribute('lang') || 'en'
  );
  document.title = doc.title || 'Fixture';
}

describe('axe-core Controlled Accessibility Fixtures', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '';
    document.documentElement.setAttribute('lang', 'en');
  });

  it('detects button-name and maps to name-chamber (missing-name.html)', async () => {
    setupDocument('missing-name.html');

    const results = await axe.run(document, {
      runOnly: {
        type: 'tag',
        values: [...SCANNER_CONFIG.RULE_TAGS],
      },
    });

    const ruleIds = results.violations.map((v) => v.id);
    expect(ruleIds).toContain('button-name');

    const buttonViolation = results.violations.find((v) => v.id === 'button-name');
    expect(buttonViolation).toBeDefined();
    expect(buttonViolation?.impact).toBe('critical');

    // Confirm Room Mapper assigns it to The Name Chamber
    const roomId = mapRuleToRoom('button-name');
    expect(roomId).toBe('name-chamber');
  });

  it('detects image-alt and maps to portrait-gallery (image-alt.html)', async () => {
    setupDocument('image-alt.html');

    const results = await axe.run(document, {
      runOnly: {
        type: 'tag',
        values: [...SCANNER_CONFIG.RULE_TAGS],
      },
    });

    const ruleIds = results.violations.map((v) => v.id);
    expect(ruleIds).toContain('image-alt');

    const imageViolation = results.violations.find((v) => v.id === 'image-alt');
    expect(imageViolation).toBeDefined();
    expect(imageViolation?.impact).toBe('critical');

    // Confirm Room Mapper assigns it to The Portrait Gallery
    const roomId = mapRuleToRoom('image-alt');
    expect(roomId).toBe('portrait-gallery');
  });

  it('detects label and maps to form-cellar (form-label.html)', async () => {
    setupDocument('form-label.html');

    const results = await axe.run(document, {
      runOnly: {
        type: 'tag',
        values: [...SCANNER_CONFIG.RULE_TAGS],
      },
    });

    const ruleIds = results.violations.map((v) => v.id);
    expect(ruleIds).toContain('label');

    const labelViolation = results.violations.find((v) => v.id === 'label');
    expect(labelViolation).toBeDefined();
    expect(labelViolation?.impact).toBe('critical');

    // Confirm Room Mapper assigns it to The Form Cellar
    const roomId = mapRuleToRoom('label');
    expect(roomId).toBe('form-cellar');
  });

  it('detects heading-order and maps to structure-hall (heading-order.html)', async () => {
    setupDocument('heading-order.html');

    const results = await axe.run(document, {
      runOnly: {
        type: 'tag',
        values: [...SCANNER_CONFIG.RULE_TAGS],
      },
    });

    const ruleIds = results.violations.map((v) => v.id);
    expect(ruleIds).toContain('heading-order');

    const headingViolation = results.violations.find((v) => v.id === 'heading-order');
    expect(headingViolation).toBeDefined();
    expect(headingViolation?.impact).toBe('moderate');

    // Confirm Room Mapper assigns it to The Structure Hall
    const roomId = mapRuleToRoom('heading-order');
    expect(roomId).toBe('structure-hall');
  });

  it('detects tabindex and maps to focus-corridor (focus-tabindex.html)', async () => {
    setupDocument('focus-tabindex.html');

    const results = await axe.run(document, {
      runOnly: {
        type: 'tag',
        values: [...SCANNER_CONFIG.RULE_TAGS],
      },
    });

    const ruleIds = results.violations.map((v) => v.id);
    expect(ruleIds).toContain('tabindex');

    const tabindexViolation = results.violations.find((v) => v.id === 'tabindex');
    expect(tabindexViolation).toBeDefined();
    expect(tabindexViolation?.impact).toBe('serious');

    // Confirm Room Mapper assigns it to The Focus Corridor
    const roomId = mapRuleToRoom('tabindex');
    expect(roomId).toBe('focus-corridor');
  });

  it('returns clean baseline with 0 violations (clean-baseline.html)', async () => {
    setupDocument('clean-baseline.html');

    const results = await axe.run(document, {
      runOnly: {
        type: 'tag',
        values: [...SCANNER_CONFIG.RULE_TAGS],
      },
    });

    expect(results.violations).toHaveLength(0);
    expect(results.passes.length).toBeGreaterThan(0);
  });

  it('detects multiple issues across mansion rooms (mixed-issues.html)', async () => {
    setupDocument('mixed-issues.html');

    const results = await axe.run(document, {
      runOnly: {
        type: 'tag',
        values: [...SCANNER_CONFIG.RULE_TAGS],
      },
    });

    const ruleIds = results.violations.map((v) => v.id);
    expect(ruleIds).toContain('button-name');
    expect(ruleIds).toContain('image-alt');
    expect(ruleIds).toContain('label');
    expect(ruleIds).toContain('heading-order');

    // Verify room distribution
    const rooms = new Set(ruleIds.map(mapRuleToRoom));
    expect(rooms.has('name-chamber')).toBe(true);
    expect(rooms.has('portrait-gallery')).toBe(true);
    expect(rooms.has('form-cellar')).toBe(true);
    expect(rooms.has('structure-hall')).toBe(true);
  });
});
