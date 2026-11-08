/**
 * Target Tab Tracker & Multi-Tab Isolation State Manager
 *
 * Manages in-memory metadata for target tabs being inspected by Phantom Audit.
 * Provides concurrency locking and lifecycle event processing.
 */

import { validateTabEligibility } from './url-validator';
import type { TabMetadata } from '@/lib/messaging/contracts';

export class TabTracker {
  private targetTabs = new Map<number, TabMetadata>();
  private dashboardToTarget = new Map<number, number>();
  private scanLocks = new Set<number>();

  /**
   * Register or update a target tab context.
   */
  registerTargetTab(tab: {
    id: number;
    url?: string;
    title?: string;
    favIconUrl?: string;
  }): TabMetadata {
    const eligibility = validateTabEligibility(tab.url);
    const metadata: TabMetadata = {
      tabId: tab.id,
      url: tab.url || '',
      title: tab.title || '',
      favIconUrl: tab.favIconUrl,
      isAlive: true,
      eligibility,
      lastUpdated: Date.now(),
    };

    this.targetTabs.set(tab.id, metadata);
    return metadata;
  }

  /**
   * Get metadata for a tracked target tab.
   */
  getTargetTab(tabId: number): TabMetadata | undefined {
    return this.targetTabs.get(tabId);
  }

  /**
   * Associate a dashboard tab with its inspected target tab.
   */
  linkDashboardToTarget(dashboardTabId: number, targetTabId: number): void {
    this.dashboardToTarget.set(dashboardTabId, targetTabId);
  }

  /**
   * Find the dashboard tab ID monitoring a given target tab.
   */
  findDashboardForTarget(targetTabId: number): number | undefined {
    for (const [dashId, tgtId] of this.dashboardToTarget.entries()) {
      if (tgtId === targetTabId) return dashId;
    }
    return undefined;
  }

  /**
   * Mark a target tab as closed/dead and release any scan lock.
   */
  handleTabRemoved(tabId: number): { isTarget: boolean; metadata?: TabMetadata } {
    this.scanLocks.delete(tabId);
    this.dashboardToTarget.delete(tabId);

    const existing = this.targetTabs.get(tabId);
    if (existing) {
      existing.isAlive = false;
      existing.lastUpdated = Date.now();
      return { isTarget: true, metadata: existing };
    }
    return { isTarget: false };
  }

  /**
   * Update URL and metadata when a target tab navigates.
   */
  handleTabUpdated(
    tabId: number,
    changeInfo: { url?: string; title?: string }
  ): { isTarget: boolean; metadata?: TabMetadata } {
    const existing = this.targetTabs.get(tabId);
    if (!existing) return { isTarget: false };

    if (changeInfo.url) {
      existing.url = changeInfo.url;
      existing.eligibility = validateTabEligibility(changeInfo.url);
    }
    if (changeInfo.title !== undefined) {
      existing.title = changeInfo.title;
    }
    existing.isAlive = true;
    existing.lastUpdated = Date.now();

    return { isTarget: true, metadata: existing };
  }

  /**
   * Attempt to acquire concurrency lock for a tab scan request.
   * Returns true if lock was successfully acquired, false if already locked.
   */
  acquireScanLock(tabId: number): boolean {
    if (this.scanLocks.has(tabId)) {
      return false;
    }
    this.scanLocks.add(tabId);
    return true;
  }

  /**
   * Release scan concurrency lock for a tab.
   */
  releaseScanLock(tabId: number): void {
    this.scanLocks.delete(tabId);
  }

  /**
   * Check if a tab currently holds a scan lock.
   */
  isScanLocked(tabId: number): boolean {
    return this.scanLocks.has(tabId);
  }

  /**
   * Reset all tracked state (for testing or extension wipe).
   */
  reset(): void {
    this.targetTabs.clear();
    this.dashboardToTarget.clear();
    this.scanLocks.clear();
  }
}

export const tabTracker = new TabTracker();
