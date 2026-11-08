import { describe, it, expect } from 'vitest';
import {
  RequestMessageSchema,
  ErrorResponseSchema,
  TabStatusResponseSchema,
  TabEligibilitySchema,
  TabMetadataSchema,
} from '@/lib/messaging/contracts';

describe('Messaging Contracts & Schemas Validation', () => {
  it('validates a correct PING request message', () => {
    const valid = {
      type: 'PING',
      requestId: 'req_123',
    };
    const parsed = RequestMessageSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('validates a correct GET_TAB_STATUS request message', () => {
    const valid = {
      type: 'GET_TAB_STATUS',
      requestId: 'req_456',
      tabId: 42,
    };
    const parsed = RequestMessageSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('rejects an invalid request with non-positive tabId', () => {
    const invalid = {
      type: 'GET_TAB_STATUS',
      requestId: 'req_789',
      tabId: -1,
    };
    const parsed = RequestMessageSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('validates a correct TabStatusResponse', () => {
    const response = {
      success: true,
      requestId: 'req_abc',
      type: 'TAB_STATUS_RESPONSE',
      tab: {
        tabId: 101,
        url: 'https://example.com',
        title: 'Example Domain',
        isAlive: true,
        eligibility: {
          isEligible: true,
          title: 'Eligible Target Page',
          normalizedUrl: 'https://example.com',
        },
        lastUpdated: Date.now(),
      },
    };

    const parsed = TabStatusResponseSchema.safeParse(response);
    expect(parsed.success).toBe(true);
  });

  it('validates a structured ErrorResponse with code', () => {
    const error = {
      success: false,
      requestId: 'req_err',
      error: 'Target tab not found or was closed',
      code: 'TAB_NOT_FOUND',
    };

    const parsed = ErrorResponseSchema.safeParse(error);
    expect(parsed.success).toBe(true);
  });

  it('validates TabEligibilitySchema and TabMetadataSchema directly', () => {
    const eligibility = {
      isEligible: true,
      title: 'Valid Webpage',
      normalizedUrl: 'https://example.com',
    };
    expect(TabEligibilitySchema.safeParse(eligibility).success).toBe(true);

    const metadata = {
      tabId: 1,
      url: 'https://example.com',
      title: 'Example',
      isAlive: true,
      eligibility,
      lastUpdated: Date.now(),
    };
    expect(TabMetadataSchema.safeParse(metadata).success).toBe(true);
  });
});
