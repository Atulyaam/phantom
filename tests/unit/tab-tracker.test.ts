import { describe, it, expect, beforeEach } from 'vitest';
import { TabTracker } from '@/features/tab-management/tab-tracker';

describe('TabTracker Multi-Tab State & Lifecycle Manager', () => {
  let tracker: TabTracker;

  beforeEach(() => {
    tracker = new TabTracker();
  });

  it('registers and isolates target tabs by tabId', () => {
    const tab1 = tracker.registerTargetTab({
      id: 10,
      url: 'https://site-a.com',
      title: 'Site A',
    });

    const tab2 = tracker.registerTargetTab({
      id: 20,
      url: 'https://site-b.com',
      title: 'Site B',
    });

    expect(tracker.getTargetTab(10)?.url).toBe('https://site-a.com');
    expect(tracker.getTargetTab(20)?.url).toBe('https://site-b.com');
    expect(tab1.isAlive).toBe(true);
    expect(tab2.isAlive).toBe(true);
  });

  it('manages concurrency scan locks to prevent duplicate simultaneous requests', () => {
    const tabId = 42;

    // First lock attempt succeeds
    expect(tracker.acquireScanLock(tabId)).toBe(true);
    expect(tracker.isScanLocked(tabId)).toBe(true);

    // Second lock attempt for same tab fails
    expect(tracker.acquireScanLock(tabId)).toBe(false);

    // Release lock
    tracker.releaseScanLock(tabId);
    expect(tracker.isScanLocked(tabId)).toBe(false);

    // Now re-acquiring succeeds
    expect(tracker.acquireScanLock(tabId)).toBe(true);
  });

  it('handles tab URL navigation updates and re-evaluates eligibility', () => {
    tracker.registerTargetTab({
      id: 100,
      url: 'https://initial.com',
      title: 'Initial',
    });

    // Navigate to a restricted chrome:// page
    const updated = tracker.handleTabUpdated(100, {
      url: 'chrome://settings',
      title: 'Settings',
    });

    expect(updated.isTarget).toBe(true);
    expect(updated.metadata?.url).toBe('chrome://settings');
    expect(updated.metadata?.eligibility.isEligible).toBe(false);
    expect(updated.metadata?.eligibility.reason).toBe('chrome-internal');
  });

  it('handles tab removal by marking it as dead and releasing locks', () => {
    tracker.registerTargetTab({
      id: 200,
      url: 'https://closing.com',
    });
    tracker.acquireScanLock(200);

    const removed = tracker.handleTabRemoved(200);
    expect(removed.isTarget).toBe(true);
    expect(removed.metadata?.isAlive).toBe(false);
    expect(tracker.isScanLocked(200)).toBe(false);
  });
});
