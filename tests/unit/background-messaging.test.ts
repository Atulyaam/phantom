import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pingBackground, fetchTabStatus, requestStartScan } from '@/lib/messaging/client';

describe('Messaging Client & Background Request Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends PING message and receives validated PONG response', async () => {
    const response = await pingBackground();
    expect(response.type).toBe('PONG');
    expect(response.success).toBe(true);
    expect(response.version).toBe('0.1.0');
  });

  it('fetches tab status and receives structured TabMetadata', async () => {
    const response = await fetchTabStatus(42);
    expect(response.type).toBe('TAB_STATUS_RESPONSE');
    expect(response.success).toBe(true);
    expect(response.tab?.tabId).toBe(42);
    expect(response.tab?.url).toBe('https://example.com');
  });

  it('requests scan initiation and receives completed status', async () => {
    const response = await requestStartScan(42);
    expect(response.type).toBe('START_SCAN_RESPONSE');
    expect(response.success).toBe(true);
    expect(response.status).toBe('completed');
  });

  it('handles runtime error response safely without unhandled exception', async () => {
    // Mock runtime.sendMessage returning a structured error
    vi.mocked(chrome.runtime.sendMessage).mockImplementationOnce(
      (_msg: unknown, callback?: (res: unknown) => void) => {
        if (callback) {
          callback({
            success: false,
            requestId: 'req_test',
            error: 'Target tab closed',
            code: 'TAB_NOT_FOUND',
          });
        }
      }
    );

    await expect(fetchTabStatus(999)).rejects.toThrow(/\[TAB_NOT_FOUND\]/);
  });

  it('handles extension runtime lastError gracefully', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockImplementationOnce(
      (_msg: unknown, callback?: (res: unknown) => void) => {
        // @ts-expect-error simulating chrome.runtime.lastError
        chrome.runtime.lastError = { message: 'Receiving end does not exist' };
        if (callback) {
          callback(null);
        }
        // @ts-expect-error cleanup
        delete chrome.runtime.lastError;
      }
    );

    await expect(pingBackground()).rejects.toThrow(/Receiving end does not exist/);
  });
});
