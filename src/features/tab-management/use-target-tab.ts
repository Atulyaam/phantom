/**
 * Hook for managing target tab connection state, eligibility, and background messaging.
 */

import { useState, useEffect, useCallback } from 'react';
import { validateTabEligibility, type TabEligibilityResult } from './url-validator';
import { fetchTabStatus, requestStartScan } from '@/lib/messaging';
import type { ScanRecord } from '@/domain/scan';
import { parseDashboardQueryParams } from '@/lib/security/query-validator';

export type TargetTabConnectionStatus =
  | 'loading'
  | 'connected'
  | 'navigated'
  | 'closed'
  | 'ineligible'
  | 'standalone'
  | 'error';

export interface TargetTabState {
  tabId: number | null;
  targetUrl: string;
  targetTitle: string;
  connectionStatus: TargetTabConnectionStatus;
  eligibility: TabEligibilityResult;
  errorMessage: string | null;
  isPreparingScan: boolean;
  scanHandshakeMessage: string | null;
  scanPhase: string;
  lastScanRecord: ScanRecord | null;
}

export function useTargetTab() {
  const [state, setState] = useState<TargetTabState>(() => {
    // Parse and strictly validate query params on initial mount (SEC-003)
    const parsed = parseDashboardQueryParams(
      typeof window !== 'undefined' ? window.location.search : ''
    );

    let initialStatus: TargetTabConnectionStatus = 'loading';
    if (!parsed.tabId && !parsed.targetUrl) {
      initialStatus = 'standalone';
    } else if (!parsed.eligibility.isEligible) {
      initialStatus = 'ineligible';
    } else {
      initialStatus = 'connected';
    }

    return {
      tabId: parsed.tabId,
      targetUrl: parsed.targetUrl,
      targetTitle: parsed.targetTitle,
      connectionStatus: initialStatus,
      eligibility: parsed.eligibility,
      errorMessage: null,
      isPreparingScan: false,
      scanHandshakeMessage: null,
      scanPhase: 'idle',
      lastScanRecord: null,
    };
  });

  const checkLiveStatus = useCallback(async (tabId: number) => {
    try {
      const response = await fetchTabStatus(tabId);
      if (response.success && response.tab) {
        setState((prev) => ({
          ...prev,
          targetUrl: response.tab!.url,
          targetTitle: response.tab!.title,
          eligibility: response.tab!.eligibility,
          connectionStatus: response.tab!.eligibility.isEligible
            ? 'connected'
            : 'ineligible',
          errorMessage: null,
        }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('TAB_NOT_FOUND')) {
        setState((prev) => ({
          ...prev,
          connectionStatus: 'closed',
          errorMessage: 'The target tab was closed.',
        }));
      } else {
        setState((prev) => ({
          ...prev,
          connectionStatus: 'error',
          errorMessage: msg,
        }));
      }
    }
  }, []);

  // Poll/verify on mount if tabId is present
  useEffect(() => {
    if (state.tabId && typeof chrome !== 'undefined' && chrome.runtime) {
      checkLiveStatus(state.tabId);
    }
  }, [state.tabId, checkLiveStatus]);

  // Listen for broadcast lifecycle events from background worker
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;

    const messageListener = (msg: unknown) => {
      if (!msg || typeof msg !== 'object' || !('type' in msg)) return;

      const event = msg as {
        type: string;
        tabId?: number;
        url?: string;
        title?: string;
        phase?: string;
        message?: string;
      };

      if (event.tabId && event.tabId === state.tabId) {
        if (event.type === 'TAB_CLOSED_EVENT') {
          setState((prev) => ({
            ...prev,
            connectionStatus: 'closed',
            errorMessage: 'Target tab was closed in the browser.',
          }));
        } else if (event.type === 'TAB_UPDATED_EVENT') {
          const newUrl = event.url || '';
          const newEligibility = validateTabEligibility(newUrl);
          setState((prev) => ({
            ...prev,
            targetUrl: newUrl,
            targetTitle: event.title || prev.targetTitle,
            eligibility: newEligibility,
            connectionStatus: newEligibility.isEligible ? 'navigated' : 'ineligible',
            errorMessage: null,
          }));
        } else if (event.type === 'SCAN_PROGRESS_EVENT') {
          setState((prev) => ({
            ...prev,
            scanPhase: event.phase || prev.scanPhase,
            scanHandshakeMessage: event.message || prev.scanHandshakeMessage,
          }));
        }
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [state.tabId]);

  // Start real scan execution (Phase 4 axe-core integration)
  const initiateScanHandshake = useCallback(async (): Promise<ScanRecord | null> => {
    if (!state.tabId) {
      setState((prev) => ({
        ...prev,
        errorMessage: 'Cannot start audit: No active target tab ID.',
      }));
      return null;
    }

    setState((prev) => ({
      ...prev,
      isPreparingScan: true,
      errorMessage: null,
      scanPhase: 'validating',
      scanHandshakeMessage: 'Initiating accessibility audit on active tab...',
    }));

    try {
      const response = await requestStartScan(state.tabId);
      const record = response.scanRecord || null;
      setState((prev) => ({
        ...prev,
        isPreparingScan: false,
        scanPhase: 'completed',
        scanHandshakeMessage: response.message,
        lastScanRecord: record,
      }));
      return record;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState((prev) => ({
        ...prev,
        isPreparingScan: false,
        scanPhase: 'failed',
        errorMessage: msg,
      }));
      return null;
    }
  }, [state.tabId]);

  return {
    ...state,
    checkLiveStatus,
    initiateScanHandshake,
  };
}
