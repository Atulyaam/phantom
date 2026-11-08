import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FindingCard, FindingInspector, RoomDetailPanel } from '@/components/findings';
import { MOCK_FINDINGS } from '@/fixtures/mock-findings';
import { MANSION_ROOMS } from '@/domain/room';

describe('Finding Presentation & Inspector Components', () => {
  const sampleFinding = MOCK_FINDINGS[0]!;

  describe('FindingCard', () => {
    it('renders finding summary, ruleId, severity badge, and node counts', () => {
      render(<FindingCard finding={sampleFinding} isDemo />);

      expect(screen.getByText(sampleFinding.ruleId)).toBeInTheDocument();
      expect(screen.getByText(sampleFinding.help)).toBeInTheDocument();
      expect(screen.getByText(/3 nodes/i)).toBeInTheDocument();
      expect(screen.getByText('DEMO')).toBeInTheDocument();
    });

    it('toggles node details expansion on click', () => {
      render(<FindingCard finding={sampleFinding} />);

      // Initially details are collapsed
      expect(screen.queryByText(/button\.icon-only/i)).not.toBeInTheDocument();

      // Click to expand
      const expandButton = screen.getByRole('button', { name: /show details/i });
      fireEvent.click(expandButton);

      // Now node details are visible
      expect(screen.getByText(/button\.icon-only/i)).toBeInTheDocument();

      // Click to collapse
      const collapseButton = screen.getByRole('button', { name: /hide details/i });
      fireEvent.click(collapseButton);

      expect(screen.queryByText(/button\.icon-only/i)).not.toBeInTheDocument();
    });

    it('safely renders HTML excerpts without executing script or HTML injection', () => {
      const maliciousFinding = {
        ...sampleFinding,
        nodes: [
          {
            target: ['#test'],
            htmlExcerpt: '<img src=x onerror="alert(1)">Safe text',
            failureSummary: 'Failure reason',
          },
        ],
      };

      const { container } = render(<FindingCard finding={maliciousFinding} />);
      const expandButton = screen.getByRole('button', { name: /show details/i });
      fireEvent.click(expandButton);

      // The raw HTML code tag must contain the escaped text, not an executed img element
      const codeElement = container.querySelector('code');
      expect(codeElement?.textContent).toBe('<img src=x onerror="alert(1)">Safe text');
    });

    it('triggers onSelectForInspection callback', () => {
      const handleInspect = vi.fn();
      render(
        <FindingCard finding={sampleFinding} onSelectForInspection={handleInspect} />
      );

      const inspectButton = screen.getByRole('button', { name: /inspect/i });
      fireEvent.click(inspectButton);
      expect(handleInspect).toHaveBeenCalledWith(sampleFinding);
    });

    it('renders remediation status badge on card', () => {
      render(
        <FindingCard finding={sampleFinding} remediationStatus="attempted" isDemo />
      );
      expect(
        screen.getByRole('status', { name: /remediation status: attempted/i })
      ).toBeInTheDocument();
    });
  });

  describe('FindingInspector', () => {
    it('renders comprehensive finding inspection panel with guidance', () => {
      const handleClose = vi.fn();
      render(<FindingInspector finding={sampleFinding} onClose={handleClose} isDemo />);

      expect(
        screen.getByRole('heading', { level: 3, name: sampleFinding.help })
      ).toBeInTheDocument();
      expect(screen.getByText(/remediation guidance/i)).toBeInTheDocument();
      expect(screen.getByText(/axe-core rule documentation/i)).toBeInTheDocument();
      expect(screen.getByText('DEMO DATA')).toBeInTheDocument();

      const closeButton = screen.getByRole('button', {
        name: /close finding inspector/i,
      });
      fireEvent.click(closeButton);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('handles remediation status change inside inspector', async () => {
      const handleStatusChange = vi.fn();
      render(
        <FindingInspector
          finding={sampleFinding}
          onClose={vi.fn()}
          onRemediationStatusChange={handleStatusChange}
          isDemo
        />
      );

      const attemptBtn = screen.getByRole('button', {
        name: /mark finding remediation as attempted/i,
      });
      fireEvent.click(attemptBtn);

      await waitFor(() => {
        expect(handleStatusChange).toHaveBeenCalledWith(
          sampleFinding.fingerprint,
          'attempted'
        );
      });
    });

    it('renders Historical Snapshot badge and disables remediation editing in historical mode', () => {
      render(<FindingInspector finding={sampleFinding} onClose={vi.fn()} isHistorical />);

      expect(screen.getByText('Historical Snapshot')).toBeInTheDocument();
      // Status change button must not be rendered when isHistorical is true
      expect(
        screen.queryByRole('button', {
          name: /mark finding remediation as attempted/i,
        })
      ).not.toBeInTheDocument();
    });
  });

  describe('RoomDetailPanel', () => {
    it('renders room metadata, primary rules, and mapped findings', () => {
      const room = MANSION_ROOMS['name-chamber'];
      const roomFindings = MOCK_FINDINGS.filter((f) => f.roomId === 'name-chamber');
      const handleClose = vi.fn();
      const handleSelectFinding = vi.fn();

      render(
        <RoomDetailPanel
          room={room}
          state="haunted"
          findings={roomFindings}
          onClose={handleClose}
          onSelectFinding={handleSelectFinding}
          isDemo
        />
      );

      expect(
        screen.getByRole('heading', {
          name: /the name chamber taxonomy inspector/i,
        })
      ).toBeInTheDocument();
      expect(screen.getByText(room.description)).toBeInTheDocument();
      expect(screen.getByText(room.wcagFamily)).toBeInTheDocument();

      // Check all primary rules are listed
      for (const rule of room.primaryRules) {
        expect(screen.getAllByText(rule).length).toBeGreaterThanOrEqual(1);
      }

      // Close button
      const closeBtn = screen.getByRole('button', { name: /close inspector/i });
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });
});
