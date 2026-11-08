import { defineBackground } from 'wxt/sandbox';
import { browser } from 'wxt/browser';
import { tabTracker } from '@/features/tab-management/tab-tracker';
import { validateTabEligibility } from '@/features/tab-management/url-validator';
import { validateMessageSender } from '@/lib/security/sender-validator';
import {
  scannerService,
  ScannerServiceError,
  type ScanPhase,
} from '@/features/scanner/scanner-service';
import {
  RequestMessageSchema,
  type RequestMessage,
  type ErrorResponse,
  type TabStatusResponse,
  type StartScanResponse,
  type PingResponse,
} from '@/lib/messaging/contracts';

export default defineBackground(() => {
  // ── 1. Extension Action Click (Explicit User Gesture) ──
  browser.action.onClicked.addListener(async (tab) => {
    if (!tab.id) return;

    // Track tab context & validate URL
    const metadata = tabTracker.registerTargetTab({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl,
    });

    const isUnsupported = !metadata.eligibility.isEligible;
    const reason = metadata.eligibility.reason || '';

    // Build dashboard URL with validated target tab context
    const dashboardUrl = browser.runtime.getURL(
      `/dashboard.html?tabId=${tab.id}&unsupported=${isUnsupported ? '1' : '0'}&reason=${encodeURIComponent(reason)}&url=${encodeURIComponent(tab.url || '')}&title=${encodeURIComponent(tab.title || '')}`
    );

    // Open dashboard tab
    const dashboardTab = await browser.tabs.create({ url: dashboardUrl });
    if (dashboardTab.id) {
      tabTracker.linkDashboardToTarget(dashboardTab.id, tab.id);
    }
  });

  // ── 2. Tab Lifecycle: On Removed ──
  browser.tabs.onRemoved.addListener((tabId) => {
    const result = tabTracker.handleTabRemoved(tabId);
    if (result.isTarget) {
      const dashboardTabId = tabTracker.findDashboardForTarget(tabId);
      if (dashboardTabId) {
        // Notify dashboard that its target tab was closed
        browser.tabs
          .sendMessage(dashboardTabId, {
            type: 'TAB_CLOSED_EVENT',
            tabId,
            timestamp: Date.now(),
          })
          .catch(() => {
            // Dashboard tab may have closed already; ignore safely
          });
      }
    }
  });

  // ── 3. Tab Lifecycle: On Updated (Navigation) ──
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.title) {
      const result = tabTracker.handleTabUpdated(tabId, {
        url: changeInfo.url || tab.url,
        title: changeInfo.title || tab.title,
      });

      if (result.isTarget && result.metadata) {
        const dashboardTabId = tabTracker.findDashboardForTarget(tabId);
        if (dashboardTabId) {
          browser.tabs
            .sendMessage(dashboardTabId, {
              type: 'TAB_UPDATED_EVENT',
              tabId,
              url: result.metadata.url,
              title: result.metadata.title,
              eligibility: result.metadata.eligibility,
              timestamp: Date.now(),
            })
            .catch(() => {
              // Dashboard tab not listening or closed; ignore safely
            });
        }
      }
    }
  });

  // ── 4. Runtime Message Handler (Zod-Validated Request/Response) ──
  browser.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
    // 4a. Verify message sender boundary (SEC-002)
    const senderValidation = validateMessageSender(sender, {
      expectedPath: '/dashboard.html',
      allowTopLevelOnly: true,
    });

    if (!senderValidation.isValid) {
      const errorResponse: ErrorResponse = {
        success: false,
        requestId:
          typeof rawMessage === 'object' && rawMessage && 'requestId' in rawMessage
            ? String((rawMessage as Record<string, unknown>).requestId)
            : 'unknown',
        error:
          senderValidation.reason || 'Sender is not authorized to invoke this action',
        code: 'UNAUTHORIZED_SENDER',
      };
      sendResponse(errorResponse);
      return true;
    }

    // 4b. Contract validation via Zod schema
    const parseResult = RequestMessageSchema.safeParse(rawMessage);

    if (!parseResult.success) {
      const errorResponse: ErrorResponse = {
        success: false,
        requestId:
          typeof rawMessage === 'object' && rawMessage && 'requestId' in rawMessage
            ? String((rawMessage as Record<string, unknown>).requestId)
            : 'unknown',
        error: 'Invalid message contract or unrecognized action type',
        code: 'VALIDATION_FAILED',
      };
      sendResponse(errorResponse);
      return true;
    }

    const message: RequestMessage = parseResult.data;

    switch (message.type) {
      case 'PING': {
        const response: PingResponse = {
          success: true,
          type: 'PONG',
          requestId: message.requestId,
          timestamp: Date.now(),
          version: '0.1.0',
        };
        sendResponse(response);
        return true;
      }

      case 'GET_TAB_STATUS': {
        // Query live tab state
        const existing = tabTracker.getTargetTab(message.tabId);
        browser.tabs
          .get(message.tabId)
          .then((tab) => {
            const effectiveUrl = tab?.url || existing?.url || '';
            const eligibility = validateTabEligibility(effectiveUrl);
            const metadata = tabTracker.registerTargetTab({
              id: message.tabId,
              url: effectiveUrl,
              title: tab?.title || existing?.title,
              favIconUrl: tab?.favIconUrl || existing?.favIconUrl,
            });

            metadata.eligibility = eligibility;

            const response: TabStatusResponse = {
              success: true,
              type: 'TAB_STATUS_RESPONSE',
              requestId: message.requestId,
              tab: metadata,
            };
            sendResponse(response);
          })
          .catch(() => {
            // Tab was closed or not found
            tabTracker.handleTabRemoved(message.tabId);
            const notFoundResponse: ErrorResponse = {
              success: false,
              requestId: message.requestId,
              error: `Target tab #${message.tabId} is no longer open or accessible`,
              code: 'TAB_NOT_FOUND',
            };
            sendResponse(notFoundResponse);
          });

        return true; // Asynchronous sendResponse
      }

      case 'START_SCAN_REQUEST': {
        const dashboardTabId = tabTracker.findDashboardForTarget(message.tabId);

        const progressDispatcher = (phase: ScanPhase, text: string) => {
          if (dashboardTabId) {
            browser.tabs
              .sendMessage(dashboardTabId, {
                type: 'SCAN_PROGRESS_EVENT',
                tabId: message.tabId,
                phase,
                message: text,
                timestamp: Date.now(),
              })
              .catch(() => {
                // Ignore if dashboard is not listening
              });
          }
        };

        scannerService
          .scanTab(message.tabId, progressDispatcher)
          .then((scanRecord) => {
            const scanResponse: StartScanResponse = {
              success: true,
              type: 'START_SCAN_RESPONSE',
              requestId: message.requestId,
              tabId: message.tabId,
              status: 'completed',
              scanRecord,
              message: `Scan completed successfully with ${scanRecord.findings.length} findings.`,
            };
            sendResponse(scanResponse);
          })
          .catch((err: unknown) => {
            const code = err instanceof ScannerServiceError ? err.code : 'INTERNAL_ERROR';
            const messageText =
              err instanceof Error
                ? err.message
                : 'Accessibility audit failed unexpectedly.';
            const errorResponse: ErrorResponse = {
              success: false,
              requestId: message.requestId,
              error: messageText,
              code,
            };
            sendResponse(errorResponse);
          });

        return true; // Asynchronous sendResponse
      }
    }
  });
});
