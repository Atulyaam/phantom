import '@testing-library/jest-dom/vitest';

// Minimal in-memory storage mock for unit tests
const storageMock: Record<string, unknown> = {};

const messageListeners = new Set<
  (message: unknown, sender?: unknown, sendResponse?: unknown) => void
>();

// Mock HTMLCanvasElement.getContext to silence JSDOM warnings during axe color contrast evaluation
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    putImageData: vi.fn(),
    createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    transform: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
  })) as unknown as CanvasRenderingContext2D;
}

// Silence JSDOM pseudoElt warning during axe CSS inspection
if (typeof window !== 'undefined' && window.getComputedStyle) {
  const origGetComputedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = (elt: Element, _pseudoElt?: string | null) => {
    return origGetComputedStyle(elt);
  };
}

global.chrome = {
  storage: {
    local: {
      get: vi.fn(async (key: string | string[]) => {
        if (typeof key === 'string') {
          return { [key]: storageMock[key] };
        }
        const result: Record<string, unknown> = {};
        for (const k of key) {
          result[k] = storageMock[k];
        }
        return result;
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(storageMock, items);
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) {
          delete storageMock[k];
        }
      }),
      clear: vi.fn(async () => {
        for (const k of Object.keys(storageMock)) {
          delete storageMock[k];
        }
      }),
    },
  },
  runtime: {
    id: 'test-extension-id',
    getURL: vi.fn((path: string) => `chrome-extension://test-extension-id${path}`),
    sendMessage: vi.fn((message: unknown, callback?: (response: unknown) => void) => {
      if (callback) {
        const msg = message as { type?: string; requestId?: string; tabId?: number };
        const searchParams =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search)
            : null;
        const testUrl = searchParams?.get('url')
          ? decodeURIComponent(searchParams.get('url')!)
          : 'https://example.com';
        const isUnsupported =
          searchParams?.get('unsupported') === '1' ||
          testUrl.startsWith('chrome://') ||
          testUrl.startsWith('edge://');

        if (msg.type === 'PING') {
          callback({
            success: true,
            type: 'PONG',
            requestId: msg.requestId || 'req_mock',
            timestamp: Date.now(),
            version: '0.1.0',
          });
        } else if (msg.type === 'GET_TAB_STATUS') {
          callback({
            success: true,
            type: 'TAB_STATUS_RESPONSE',
            requestId: msg.requestId || 'req_mock',
            tab: {
              tabId: msg.tabId || 1,
              url: testUrl,
              title: searchParams?.get('title') || 'Example Domain',
              isAlive: true,
              eligibility: {
                isEligible: !isUnsupported,
                title: isUnsupported ? 'Ineligible Target' : 'Eligible Target Page',
                normalizedUrl: testUrl,
              },
              lastUpdated: Date.now(),
            },
          });
        } else if (msg.type === 'START_SCAN_REQUEST') {
          callback({
            success: true,
            type: 'START_SCAN_RESPONSE',
            requestId: msg.requestId || 'req_mock',
            tabId: msg.tabId || 1,
            status: 'completed',
            scanRecord: {
              id: '11111111-1111-1111-1111-111111111111',
              schemaVersion: 1,
              tabUrl: testUrl,
              pageTitle: searchParams?.get('title') || 'Example Domain',
              hostname: 'example.com',
              scannedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              axeVersion: '4.14.0',
              extensionVersion: '0.1.0',
              browserName: 'chrome',
              status: 'completed',
              findings: [],
              incompleteChecksCount: 0,
              passesCount: 10,
              inapplicableCount: 20,
            },
            message: 'Scan completed successfully',
          });
        } else {
          callback({ success: true, requestId: msg.requestId });
        }
      }
    }),
    onMessage: {
      addListener: vi.fn((listener: (message: unknown) => void) => {
        messageListeners.add(listener);
      }),
      removeListener: vi.fn((listener: (message: unknown) => void) => {
        messageListeners.delete(listener);
      }),
    },
  },
  tabs: {
    get: vi.fn((tabId: number, callback?: (tab: unknown) => void) => {
      const tab = {
        id: tabId,
        url: 'https://example.com',
        title: 'Example Domain',
        active: true,
      };
      if (typeof callback === 'function') {
        callback(tab);
      }
      return Promise.resolve(tab);
    }),
    sendMessage: vi.fn(
      (_tabId: number, _message: unknown, callback?: (res: unknown) => void) => {
        if (typeof callback === 'function') {
          callback({});
        }
        return Promise.resolve({});
      }
    ),
    create: vi.fn((props: { url: string }, callback?: (tab: unknown) => void) => {
      const tab = { id: 999, ...props };
      if (typeof callback === 'function') {
        callback(tab);
      }
      return Promise.resolve(tab);
    }),
  },
  scripting: {
    executeScript: vi.fn((_details: unknown, callback?: (res: unknown) => void) => {
      const res = [{ result: null }];
      if (typeof callback === 'function') {
        callback(res);
      }
      return Promise.resolve(res);
    }),
  },
} as unknown as typeof chrome;

// Ensure globalThis.browser aliases globalThis.chrome for WXT browser compatibility
(globalThis as unknown as { browser: typeof chrome }).browser = global.chrome;
