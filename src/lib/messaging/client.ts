/**
 * Typed messaging client for Dashboard -> Background runtime communication.
 *
 * Implements request-response correlation, timeout protection,
 * and safe error parsing to prevent unhandled promise rejections.
 */

import {
  type RequestMessage,
  type TabStatusResponse,
  type StartScanResponse,
  type PingResponse,
  type ErrorResponse,
  ErrorResponseSchema,
  TabStatusResponseSchema,
  StartScanResponseSchema,
  PingResponseSchema,
} from './contracts';

export type RequestPayload =
  | { type: 'PING' }
  | { type: 'GET_TAB_STATUS'; tabId: number }
  | { type: 'START_SCAN_REQUEST'; tabId: number };

export interface SendMessageOptions {
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5000;

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Send a typed request message to the extension background service worker.
 */
export async function sendRuntimeMessage<T>(
  message: RequestPayload,
  options: SendMessageOptions = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const requestId = generateRequestId();
  const fullMessage: RequestMessage = {
    ...message,
    requestId,
  } as RequestMessage;

  // Verify extension runtime availability
  if (
    typeof chrome === 'undefined' ||
    typeof chrome.runtime === 'undefined' ||
    typeof chrome.runtime.sendMessage === 'undefined'
  ) {
    throw new Error('Extension runtime not available in this environment');
  }

  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `Runtime message timed out after ${timeoutMs}ms [requestId=${requestId}]`
        )
      );
    }, timeoutMs);
  });

  const sendPromise = new Promise<T>((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(fullMessage, (response: unknown) => {
        if (chrome.runtime.lastError) {
          return reject(
            new Error(chrome.runtime.lastError.message || 'Extension runtime error')
          );
        }

        if (!response || typeof response !== 'object') {
          return reject(
            new Error('Invalid null or non-object response from background worker')
          );
        }

        // Check if background returned structured error
        const errorCheck = ErrorResponseSchema.safeParse(response);
        if (errorCheck.success) {
          const errData: ErrorResponse = errorCheck.data;
          return reject(new Error(`[${errData.code}] ${errData.error}`));
        }

        resolve(response as T);
      });
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });

  try {
    const result = await Promise.race([sendPromise, timeoutPromise]);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Ping the background worker to confirm it is active and responsive.
 */
export async function pingBackground(): Promise<PingResponse> {
  const raw = await sendRuntimeMessage<unknown>({ type: 'PING' });
  return PingResponseSchema.parse(raw);
}

/**
 * Fetch the latest status and eligibility of a target tab.
 */
export async function fetchTabStatus(tabId: number): Promise<TabStatusResponse> {
  const raw = await sendRuntimeMessage<unknown>({
    type: 'GET_TAB_STATUS',
    tabId,
  });
  return TabStatusResponseSchema.parse(raw);
}

/**
 * Request initiation of scan preparation and execution for a specific target tab.
 */
export async function requestStartScan(
  tabId: number,
  timeoutMs: number = 20_000
): Promise<StartScanResponse> {
  const raw = await sendRuntimeMessage<unknown>(
    {
      type: 'START_SCAN_REQUEST',
      tabId,
    },
    { timeoutMs }
  );
  return StartScanResponseSchema.parse(raw);
}
