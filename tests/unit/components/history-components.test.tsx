/**
 * Phantom Audit — Haunted Mansion History UI Tests (Workstream 3)
 *
 * Tests for:
 * 1. HistoricalSnapshotBanner: atmospheric banner, metadata presentation, live auditing pause advisory, return to live scan.
 * 2. ScanHistoryDrawer: loading, empty, and populated states, newest-first ordering, search & filtering.
 * 3. Snapshot inspection: opening full ScanRecord from storage, corrupted snapshot handling.
 * 4. Deletion lifecycle: confirmed individual deletion, confirmed clear-history, storage failure resilience.
 * 5. Accessibility: dialog semantics, Escape key handling, focus restoration, screen-reader live announcements.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HistoricalSnapshotBanner, ScanHistoryDrawer } from '@/components/history';
import { storageService } from '@/lib/storage';
import type { ScanRecord, ScanSummary } from '@/domain/scan';
import type { FindingRecord } from '@/domain/finding';

const mockFinding: FindingRecord = {
  fingerprint: 'v1:button-name:button#submit',
  ruleId: 'button-name',
  impact: 'critical',
  description: 'Buttons must have discernible text',
  help: 'Fix button name',
  wcagTags: ['wcag2a'],
  roomId: 'name-chamber',
  affectedNodeCount: 1,
  nodes: [
    {
      target: ['button#submit'],
      htmlExcerpt: '<button id="submit"></button>',
      failureSummary: 'Fix button name',
    },
  ],
  firstSeenAt: '2026-10-31T20:00:00.000Z',
  reviewed: false,
};

const mockScanRecord1: ScanRecord = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  schemaVersion: 1,
  tabUrl: 'https://example.com/checkout',
  pageTitle: 'Haunted Checkout',
  hostname: 'example.com',
  scannedAt: '2026-10-31T20:00:00.000Z',
  axeVersion: '4.14.0',
  extensionVersion: '0.1.0',
  browserName: 'chrome',
  status: 'completed',
  findings: [mockFinding],
  incompleteChecksCount: 0,
  passesCount: 12,
  inapplicableCount: 5,
};

const mockScanRecord2: ScanRecord = {
  id: '550e8400-e29b-41d4-a716-446655440002',
  schemaVersion: 1,
  tabUrl: 'https://example.com/settings',
  pageTitle: 'Gothic Settings',
  hostname: 'example.com',
  scannedAt: '2026-10-31T21:30:00.000Z',
  axeVersion: '4.14.0',
  extensionVersion: '0.1.0',
  browserName: 'chrome',
  status: 'completed',
  findings: [],
  incompleteChecksCount: 0,
  passesCount: 20,
  inapplicableCount: 10,
};

const mockSummary1: ScanSummary = {
  id: mockScanRecord1.id,
  schemaVersion: 1,
  tabUrl: mockScanRecord1.tabUrl,
  pageTitle: mockScanRecord1.pageTitle,
  hostname: mockScanRecord1.hostname,
  scannedAt: mockScanRecord1.scannedAt,
  status: mockScanRecord1.status,
  totalFindings: 1,
  criticalCount: 1,
  seriousCount: 0,
  moderateCount: 0,
  minorCount: 0,
  passesCount: 12,
  incompleteChecksCount: 0,
};

const mockSummary2: ScanSummary = {
  id: mockScanRecord2.id,
  schemaVersion: 1,
  tabUrl: mockScanRecord2.tabUrl,
  pageTitle: mockScanRecord2.pageTitle,
  hostname: mockScanRecord2.hostname,
  scannedAt: mockScanRecord2.scannedAt, // newer than summary 1
  status: mockScanRecord2.status,
  totalFindings: 0,
  criticalCount: 0,
  seriousCount: 0,
  moderateCount: 0,
  minorCount: 0,
  passesCount: 20,
  incompleteChecksCount: 0,
};

describe('Haunted Mansion History UI — Workstream 3', () => {
  describe('HistoricalSnapshotBanner Component', () => {
    it('renders prominent atmospheric banner with snapshot metadata and warning', () => {
      const onReturnToLive = vi.fn();
      const onOpenHistory = vi.fn();

      render(
        <HistoricalSnapshotBanner
          snapshot={mockScanRecord1}
          onReturnToLive={onReturnToLive}
          onOpenHistory={onOpenHistory}
        />
      );

      // Verify header and atmospheric badges
      expect(screen.getByText('Historical Snapshot')).toBeInTheDocument();
      expect(screen.getByText('ID: 550e8400')).toBeInTheDocument();
      expect(screen.getByText(/1 finding in archive/i)).toBeInTheDocument();

      // Verify page details
      expect(screen.getByText('Haunted Checkout')).toBeInTheDocument();
      expect(screen.getByText('https://example.com/checkout')).toBeInTheDocument();

      // Verify paused auditing advisory
      expect(
        screen.getByText(
          /Real-time live auditing paused while inspecting historical data/i
        )
      ).toBeInTheDocument();

      // Verify action buttons
      expect(
        screen.getByRole('button', { name: /Return to Live Scan/i })
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Browse Archive/i })).toBeInTheDocument();
    });

    it('triggers onReturnToLive when Return to Live Scan is clicked', () => {
      const onReturnToLive = vi.fn();

      render(
        <HistoricalSnapshotBanner
          snapshot={mockScanRecord1}
          onReturnToLive={onReturnToLive}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Return to Live Scan/i }));
      expect(onReturnToLive).toHaveBeenCalledTimes(1);
    });

    it('triggers onOpenHistory when Browse Archive is clicked', () => {
      const onReturnToLive = vi.fn();
      const onOpenHistory = vi.fn();

      render(
        <HistoricalSnapshotBanner
          snapshot={mockScanRecord1}
          onReturnToLive={onReturnToLive}
          onOpenHistory={onOpenHistory}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Browse Archive/i }));
      expect(onOpenHistory).toHaveBeenCalledTimes(1);
    });
  });

  describe('ScanHistoryDrawer Component', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('does not render when isOpen is false', () => {
      const { container } = render(
        <ScanHistoryDrawer isOpen={false} onClose={vi.fn()} onSelectSnapshot={vi.fn()} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders empty archive state when storage has zero saved scans', async () => {
      vi.spyOn(storageService, 'getScanSummaries').mockResolvedValue([]);

      render(
        <ScanHistoryDrawer isOpen={true} onClose={vi.fn()} onSelectSnapshot={vi.fn()} />
      );

      // Loading state initially
      expect(screen.getByText(/Consulting the spectral archives/i)).toBeInTheDocument();

      // Waits for empty state
      await waitFor(() => {
        expect(screen.getByText('The Archive is Silent')).toBeInTheDocument();
      });
      expect(
        screen.getByText(/No past hauntings have been recorded yet/i)
      ).toBeInTheDocument();
    });

    it('renders populated list ordered newest-first and displays severity breakdown', async () => {
      // Return summaries in older-first order from mock to test sorting
      vi.spyOn(storageService, 'getScanSummaries').mockResolvedValue([
        mockSummary1,
        mockSummary2,
      ]);

      render(
        <ScanHistoryDrawer isOpen={true} onClose={vi.fn()} onSelectSnapshot={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('The Archive of Past Hauntings')).toBeInTheDocument();
      });

      // Verify newest-first ordering: mockSummary2 (21:30) must appear before mockSummary1 (20:00)
      const articles = screen.getAllByRole('article');
      expect(articles).toHaveLength(2);
      expect(articles[0]).toHaveTextContent('Gothic Settings');
      expect(articles[1]).toHaveTextContent('Haunted Checkout');

      // Verify severity pill on mockSummary1
      expect(screen.getByText('1 Critical')).toBeInTheDocument();
      // Verify clean pill on mockSummary2
      expect(screen.getByText('0 Violations (Clean)')).toBeInTheDocument();
    });

    it('highlights currently viewed snapshot with Currently Viewing badge', async () => {
      vi.spyOn(storageService, 'getScanSummaries').mockResolvedValue([
        mockSummary1,
        mockSummary2,
      ]);

      render(
        <ScanHistoryDrawer
          isOpen={true}
          currentSnapshotId={mockSummary1.id}
          onClose={vi.fn()}
          onSelectSnapshot={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Currently Viewing')).toBeInTheDocument();
      });

      // Button for currently viewed snapshot is disabled / labeled "Viewing"
      expect(screen.getByRole('button', { name: /Viewing/i })).toBeDisabled();
    });

    it('filters historical scans dynamically by search query', async () => {
      vi.spyOn(storageService, 'getScanSummaries').mockResolvedValue([
        mockSummary1,
        mockSummary2,
      ]);

      render(
        <ScanHistoryDrawer isOpen={true} onClose={vi.fn()} onSelectSnapshot={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(2);
      });

      const searchInput = screen.getByLabelText(/Search scan history/i);
      fireEvent.change(searchInput, { target: { value: 'Checkout' } });

      // Only Haunted Checkout should be visible
      expect(screen.getAllByRole('article')).toHaveLength(1);
      expect(screen.getByText('Haunted Checkout')).toBeInTheDocument();
      expect(screen.queryByText('Gothic Settings')).not.toBeInTheDocument();
      expect(screen.getByText('Showing 1 of 2')).toBeInTheDocument();
    });

    it('reopens historical snapshot when Inspect button is clicked and verifies contextual accessible names', async () => {
      vi.spyOn(storageService, 'getScanSummaries').mockResolvedValue([mockSummary1]);
      vi.spyOn(storageService, 'getScanById').mockResolvedValue(mockScanRecord1);
      const onSelectSnapshot = vi.fn();
      const onClose = vi.fn();

      const { rerender } = render(
        <ScanHistoryDrawer
          isOpen={true}
          onClose={onClose}
          onSelectSnapshot={onSelectSnapshot}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Haunted Checkout')).toBeInTheDocument();
      });

      // Verify disambiguated accessible label contains page title (DEF-933)
      const inspectButton = screen.getByRole('button', {
        name: /inspect snapshot for haunted checkout/i,
      });
      expect(inspectButton).toBeInTheDocument();
      fireEvent.click(inspectButton);

      await waitFor(() => {
        expect(storageService.getScanById).toHaveBeenCalledWith(mockSummary1.id);
        expect(onSelectSnapshot).toHaveBeenCalledWith(mockScanRecord1);
        expect(onClose).toHaveBeenCalled();
      });

      // Verify current snapshot viewing state has disambiguated label and is disabled
      rerender(
        <ScanHistoryDrawer
          isOpen={true}
          onClose={onClose}
          onSelectSnapshot={onSelectSnapshot}
          currentSnapshotId={mockSummary1.id}
        />
      );

      await waitFor(() => {
        const viewingButton = screen.getByRole('button', {
          name: /currently viewing snapshot for haunted checkout/i,
        });
        expect(viewingButton).toBeInTheDocument();
        expect(viewingButton).toBeDisabled();
      });
    });

    it('handles missing or corrupted snapshot in storage gracefully with honest error alert', async () => {
      vi.spyOn(storageService, 'getScanSummaries').mockResolvedValue([mockSummary1]);
      vi.spyOn(storageService, 'getScanById').mockResolvedValue(null); // Corrupted / evicted

      render(
        <ScanHistoryDrawer isOpen={true} onClose={vi.fn()} onSelectSnapshot={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('Haunted Checkout')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Inspect/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          /Snapshot record is missing or corrupted in storage/i
        );
      });
    });

    it('executes confirmed individual deletion of a snapshot', async () => {
      vi.spyOn(storageService, 'getScanSummaries')
        .mockResolvedValueOnce([mockSummary1, mockSummary2])
        .mockResolvedValueOnce([mockSummary2]);
      const deleteSpy = vi.spyOn(storageService, 'deleteScan').mockResolvedValue();

      render(
        <ScanHistoryDrawer isOpen={true} onClose={vi.fn()} onSelectSnapshot={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(2);
      });

      // Click delete icon on first snapshot
      const deleteButtons = screen.getAllByTitle(/Delete this snapshot/i);
      fireEvent.click(deleteButtons[0]);

      // Verify inline confirmation prompts appear
      expect(screen.getByText('Delete?')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument();

      // Click "Yes" to confirm
      fireEvent.click(screen.getByRole('button', { name: 'Yes' }));

      await waitFor(() => {
        expect(deleteSpy).toHaveBeenCalledWith(mockSummary2.id); // newest was first
      });
    });

    it('cancels individual deletion when "No" is clicked', async () => {
      vi.spyOn(storageService, 'getScanSummaries').mockResolvedValue([mockSummary1]);
      const deleteSpy = vi.spyOn(storageService, 'deleteScan');

      render(
        <ScanHistoryDrawer isOpen={true} onClose={vi.fn()} onSelectSnapshot={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('Haunted Checkout')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle(/Delete this snapshot/i));
      expect(screen.getByText('Delete?')).toBeInTheDocument();

      // Cancel
      fireEvent.click(screen.getByRole('button', { name: 'No' }));
      expect(screen.queryByText('Delete?')).not.toBeInTheDocument();
      expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('executes confirmed clear-history action and purges all snapshots', async () => {
      vi.spyOn(storageService, 'getScanSummaries').mockResolvedValue([
        mockSummary1,
        mockSummary2,
      ]);
      const clearSpy = vi.spyOn(storageService, 'clearScanHistory').mockResolvedValue();

      render(
        <ScanHistoryDrawer isOpen={true} onClose={vi.fn()} onSelectSnapshot={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('The Archive of Past Hauntings')).toBeInTheDocument();
      });

      // Click Clear Archive in header
      fireEvent.click(screen.getByRole('button', { name: /Clear Archive/i }));

      // Confirmation banner must appear
      expect(
        screen.getByText(/Purge all past hauntings from local storage/i)
      ).toBeInTheDocument();

      // Confirm purge
      fireEvent.click(screen.getByRole('button', { name: /Confirm Purge/i }));

      await waitFor(() => {
        expect(clearSpy).toHaveBeenCalledTimes(1);
        expect(screen.getByText('The Archive is Silent')).toBeInTheDocument();
      });
    });

    it('cancels clear-history action when Cancel button is clicked', async () => {
      vi.spyOn(storageService, 'getScanSummaries').mockResolvedValue([mockSummary1]);
      const clearSpy = vi.spyOn(storageService, 'clearScanHistory');

      render(
        <ScanHistoryDrawer isOpen={true} onClose={vi.fn()} onSelectSnapshot={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('Haunted Checkout')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Clear Archive/i }));
      expect(screen.getByText(/Purge all past hauntings/i)).toBeInTheDocument();

      // Cancel
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByText(/Purge all past hauntings/i)).not.toBeInTheDocument();
      expect(clearSpy).not.toHaveBeenCalled();
    });

    it('handles storage errors honestly when deletion throws', async () => {
      vi.spyOn(storageService, 'getScanSummaries').mockResolvedValue([mockSummary1]);
      vi.spyOn(storageService, 'deleteScan').mockRejectedValue(
        new Error('Storage quota exceeded')
      );

      render(
        <ScanHistoryDrawer isOpen={true} onClose={vi.fn()} onSelectSnapshot={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText('Haunted Checkout')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle(/Delete this snapshot/i));
      fireEvent.click(screen.getByRole('button', { name: 'Yes' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Failed to delete scan snapshot from storage.'
        );
      });
    });

    it('closes drawer on Escape key press and restores focus to trigger button', async () => {
      vi.spyOn(storageService, 'getScanSummaries').mockResolvedValue([]);
      const onClose = vi.fn();
      const triggerBtn = document.createElement('button');
      document.body.appendChild(triggerBtn);
      const focusSpy = vi.spyOn(triggerBtn, 'focus');

      render(
        <ScanHistoryDrawer
          isOpen={true}
          onClose={onClose}
          onSelectSnapshot={vi.fn()}
          triggerRef={{ current: triggerBtn }}
        />
      );

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);

      // Verify close button also restores focus
      const closeBtn = screen.getByLabelText(/Close archive drawer/i);
      fireEvent.click(closeBtn);
      expect(focusSpy).toHaveBeenCalled();

      document.body.removeChild(triggerBtn);
    });

    it('provides accessible dialog semantics and screen-reader live status', async () => {
      vi.spyOn(storageService, 'getScanSummaries').mockResolvedValue([mockSummary1]);

      render(
        <ScanHistoryDrawer isOpen={true} onClose={vi.fn()} onSelectSnapshot={vi.fn()} />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'archive-drawer-title');

      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      await waitFor(() => {
        expect(liveRegion).toHaveTextContent(/Loaded 1 historical scans/i);
      });
    });

    it('notifies onSnapshotDeleted when a snapshot is deleted', async () => {
      vi.spyOn(storageService, 'getScanSummaries')
        .mockResolvedValueOnce([mockSummary1])
        .mockResolvedValueOnce([]);
      vi.spyOn(storageService, 'deleteScan').mockResolvedValue();
      const onSnapshotDeleted = vi.fn();

      render(
        <ScanHistoryDrawer
          isOpen={true}
          onClose={vi.fn()}
          onSelectSnapshot={vi.fn()}
          currentSnapshotId={mockSummary1.id}
          onSnapshotDeleted={onSnapshotDeleted}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Haunted Checkout')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle(/Delete this snapshot/i));
      fireEvent.click(screen.getByRole('button', { name: 'Yes' }));

      await waitFor(() => {
        expect(onSnapshotDeleted).toHaveBeenCalledWith(mockSummary1.id);
      });
    });

    it('notifies onHistoryCleared when all snapshots are purged', async () => {
      vi.spyOn(storageService, 'getScanSummaries').mockResolvedValue([mockSummary1]);
      vi.spyOn(storageService, 'clearScanHistory').mockResolvedValue();
      const onHistoryCleared = vi.fn();

      render(
        <ScanHistoryDrawer
          isOpen={true}
          onClose={vi.fn()}
          onSelectSnapshot={vi.fn()}
          currentSnapshotId={mockSummary1.id}
          onHistoryCleared={onHistoryCleared}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Haunted Checkout')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Clear Archive/i }));
      fireEvent.click(screen.getByRole('button', { name: /Confirm Purge/i }));

      await waitFor(() => {
        expect(onHistoryCleared).toHaveBeenCalledTimes(1);
      });
    });

    it('sorts snapshots deterministically with equal or malformed timestamps', async () => {
      const summaryEqualA: ScanSummary = {
        ...mockSummary1,
        id: '550e8400-e29b-41d4-a716-44665544000a',
        scannedAt: '2026-11-01T00:00:00.000Z',
        pageTitle: 'Page Alpha',
      };
      const summaryEqualB: ScanSummary = {
        ...mockSummary1,
        id: '550e8400-e29b-41d4-a716-44665544000b',
        scannedAt: '2026-11-01T00:00:00.000Z',
        pageTitle: 'Page Beta',
      };
      const summaryMalformed: ScanSummary = {
        ...mockSummary1,
        id: '550e8400-e29b-41d4-a716-44665544000c',
        scannedAt: 'not-a-valid-date',
        pageTitle: 'Page Corrupted Time',
      };

      vi.spyOn(storageService, 'getScanSummaries').mockResolvedValue([
        summaryMalformed,
        summaryEqualA,
        summaryEqualB,
      ]);

      render(
        <ScanHistoryDrawer isOpen={true} onClose={vi.fn()} onSelectSnapshot={vi.fn()} />
      );

      await waitFor(() => {
        const articles = screen.getAllByRole('article');
        expect(articles).toHaveLength(3);
        // Valid timestamps come before malformed (which falls back to 0)
        // Equal timestamps sort stably by UUID descending (b before a)
        expect(articles[0]).toHaveTextContent('Page Beta');
        expect(articles[1]).toHaveTextContent('Page Alpha');
        expect(articles[2]).toHaveTextContent('Page Corrupted Time');
      });
    });
  });
});
