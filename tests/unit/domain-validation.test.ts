import { describe, it, expect } from 'vitest';
import {
  ImpactSchema,
  RoomIdSchema,
  FindingNodeSchema,
  FindingRecordSchema,
  ScanRecordSchema,
  StartScanMessageSchema,
} from '@/lib/validation/schemas';

describe('Domain Validation Schemas', () => {
  it('validates supported accessibility impacts', () => {
    expect(ImpactSchema.safeParse('critical').success).toBe(true);
    expect(ImpactSchema.safeParse('serious').success).toBe(true);
    expect(ImpactSchema.safeParse('moderate').success).toBe(true);
    expect(ImpactSchema.safeParse('minor').success).toBe(true);
    expect(ImpactSchema.safeParse('unknown').success).toBe(true);
    expect(ImpactSchema.safeParse('catastrophic').success).toBe(false);
  });

  it('validates all 7 mansion room IDs', () => {
    const validRooms = [
      'name-chamber',
      'contrast-crypt',
      'portrait-gallery',
      'form-cellar',
      'structure-hall',
      'focus-corridor',
      'other',
    ];
    for (const room of validRooms) {
      expect(RoomIdSchema.safeParse(room).success).toBe(true);
    }
    expect(RoomIdSchema.safeParse('dungeon').success).toBe(false);
  });

  it('validates finding nodes with excerpt length limits', () => {
    const validNode = {
      target: ['button#submit'],
      htmlExcerpt: '<button>Submit</button>',
      failureSummary: 'Fix any of the following: Element does not have an inner text',
    };
    expect(FindingNodeSchema.safeParse(validNode).success).toBe(true);

    const oversizedNode = {
      ...validNode,
      htmlExcerpt: 'a'.repeat(1001),
    };
    expect(FindingNodeSchema.safeParse(oversizedNode).success).toBe(false);
  });

  it('validates complete FindingRecord structures', () => {
    const finding = {
      fingerprint: 'v1:button-name:button#submit',
      ruleId: 'button-name',
      impact: 'critical',
      description: 'Ensures buttons have discernible text',
      help: 'Buttons must have discernible text',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/button-name',
      wcagTags: ['wcag2a', 'wcag412'],
      roomId: 'name-chamber',
      affectedNodeCount: 1,
      nodes: [
        {
          target: ['button#submit'],
          htmlExcerpt: '<button></button>',
          failureSummary: 'Element does not have an inner text',
        },
      ],
      firstSeenAt: new Date().toISOString(),
      reviewed: false,
    };

    const parsed = FindingRecordSchema.safeParse(finding);
    expect(parsed.success).toBe(true);
  });

  it('validates ScanRecord structures and rejects invalid URLs', () => {
    const validScan = {
      id: 'e28b21c6-2c96-4db0-9b36-9b16ea9825b2',
      schemaVersion: 1,
      tabUrl: 'https://example.com/checkout',
      pageTitle: 'Example Checkout',
      hostname: 'example.com',
      scannedAt: new Date().toISOString(),
      axeVersion: '4.10.2',
      extensionVersion: '0.1.0',
      browserName: 'chrome',
      status: 'completed',
      findings: [],
      incompleteChecksCount: 0,
      passesCount: 12,
      inapplicableCount: 4,
    };
    expect(ScanRecordSchema.safeParse(validScan).success).toBe(true);

    const invalidScan = {
      ...validScan,
      tabUrl: 'not-a-valid-url',
    };
    expect(ScanRecordSchema.safeParse(invalidScan).success).toBe(false);
  });

  it('validates extension inter-process messages', () => {
    expect(
      StartScanMessageSchema.safeParse({ type: 'START_SCAN', tabId: 102 }).success
    ).toBe(true);
    expect(
      StartScanMessageSchema.safeParse({ type: 'INVALID_TYPE', tabId: 102 }).success
    ).toBe(false);
    expect(
      StartScanMessageSchema.safeParse({ type: 'START_SCAN', tabId: -5 }).success
    ).toBe(false);
  });
});
