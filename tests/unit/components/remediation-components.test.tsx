import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import {
  CodeSnippetViewer,
  RemediationStatusBadge,
  VerificationChecklist,
  RemediationGuidancePanel,
} from '@/components/remediation';
import { CrossScanDiffBanner } from '@/components/findings/CrossScanDiffBanner';
import type {
  CodeSnippet,
  VerificationStep,
  RescanVerificationSummary,
} from '@/domain/remediation';
import type { FindingRecord } from '@/domain/finding';
import type { ScanComparison } from '@/domain/report';

const mockFinding: FindingRecord = {
  id: 'test-finding-1',
  scanId: 'test-scan-1',
  ruleId: 'button-name',
  description: 'Buttons must have discernible text',
  help: 'Buttons must have accessible text',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.14/button-name',
  impact: 'critical',
  roomId: 'name-chamber',
  fingerprint: 'v1:button-name:button#action',
  selector: 'button#action',
  wcagTags: ['wcag2a', 'wcag412', 'cat.name-role-value'],
  nodes: [
    {
      target: ['button#action'],
      htmlExcerpt: '<button id="action"><svg></svg></button>',
      failureSummary: 'Element does not have an inner text',
    },
  ],
  affectedNodeCount: 1,
  firstSeenAt: '2026-11-06T18:00:00.000Z',
  reviewed: false,
};

describe('Remediation UI Components (Workstream 3)', () => {
  describe('RemediationStatusBadge', () => {
    it('renders each of the 4 lifecycle statuses with accessible labels and roles', () => {
      const statuses = ['suggested', 'attempted', 'verified', 'unresolved'] as const;

      for (const status of statuses) {
        const { unmount } = render(<RemediationStatusBadge status={status} />);
        const badge = screen.getByRole('status');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveAttribute(
          'aria-label',
          expect.stringContaining(status.charAt(0).toUpperCase())
        );
        unmount();
      }
    });

    it('renders with both sm and md sizing classes', () => {
      const { container: smContainer, unmount: unmountSm } = render(
        <RemediationStatusBadge status="suggested" size="sm" />
      );
      expect(smContainer.querySelector('[role="status"]')?.className).toContain(
        'text-[10px]'
      );
      unmountSm();

      const { container: mdContainer } = render(
        <RemediationStatusBadge status="verified" size="md" />
      );
      expect(mdContainer.querySelector('[role="status"]')?.className).toContain(
        'text-xs'
      );
    });

    it('renders regression indicator tag and accessible label when isRegression is true', () => {
      render(<RemediationStatusBadge status="unresolved" isRegression={true} />);
      const badge = screen.getByRole('status');
      expect(badge).toHaveAttribute(
        'aria-label',
        'Remediation status: Unresolved (Regression detected)'
      );
      expect(screen.getByText('Regression')).toBeInTheDocument();
    });
  });

  describe('CodeSnippetViewer', () => {
    const mockSnippets: CodeSnippet[] = [
      {
        language: 'html',
        title: 'Semantic Button',
        code: '<button type="button" class="btn">\n  <span>Close</span>\n</button>',
        explanation: 'Provides accessible name via visible text.',
        isPrimary: true,
      },
      {
        language: 'react',
        title: 'React Button Component',
        code: 'export function CloseBtn() {\n  return <button>Close</button>;\n}',
        explanation: 'React component implementation.',
      },
    ];

    it('renders tabs only for available languages', () => {
      render(<CodeSnippetViewer snippets={mockSnippets} />);

      expect(screen.getByRole('tab', { name: /html/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /react/i })).toBeInTheDocument();
      // CSS tab must not be rendered since it is not in mockSnippets
      expect(screen.queryByRole('tab', { name: /css/i })).not.toBeInTheDocument();
    });

    it('renders line numbers alongside code lines', () => {
      render(<CodeSnippetViewer snippets={mockSnippets} />);

      // Line numbers 1, 2, 3 should be rendered
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('switches active snippet tab on click and updates explanation', () => {
      render(<CodeSnippetViewer snippets={mockSnippets} />);

      expect(screen.getByText('Semantic Button')).toBeInTheDocument();
      expect(
        screen.getByText(/provides accessible name via visible text/i)
      ).toBeInTheDocument();

      // Click React tab
      const reactTab = screen.getByRole('tab', { name: /react/i });
      fireEvent.click(reactTab);

      expect(screen.getByText('React Button Component')).toBeInTheDocument();
      expect(screen.getByText(/react component implementation/i)).toBeInTheDocument();
    });

    it('supports keyboard navigation across tabs (ArrowRight, ArrowLeft)', () => {
      render(<CodeSnippetViewer snippets={mockSnippets} />);

      const htmlTab = screen.getByRole('tab', { name: /html/i });
      htmlTab.focus();

      fireEvent.keyDown(htmlTab, { key: 'ArrowRight' });
      expect(screen.getByRole('tab', { name: /react/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );

      fireEvent.keyDown(screen.getByRole('tab', { name: /react/i }), {
        key: 'ArrowLeft',
      });
      expect(screen.getByRole('tab', { name: /html/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    it('copies snippet code to clipboard with visual feedback', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      render(<CodeSnippetViewer snippets={mockSnippets} />);

      const copyButton = screen.getByRole('button', { name: /copy/i });
      fireEvent.click(copyButton);

      expect(writeTextMock).toHaveBeenCalledWith(mockSnippets[0]!.code);
      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });
    });

    it('renders empty fallback when no snippets provided', () => {
      render(<CodeSnippetViewer snippets={[]} />);
      expect(screen.getByText(/no code snippets available/i)).toBeInTheDocument();
    });
  });

  describe('VerificationChecklist', () => {
    const mockSteps: VerificationStep[] = [
      {
        method: 'keyboard',
        instruction: 'Press Tab to focus the element.',
        expectedResult: 'Focus ring is visibly displayed.',
      },
      {
        method: 'screen-reader',
        instruction: 'Navigate with virtual cursor.',
        expectedResult: 'Element name and role are announced.',
      },
    ];

    it('renders checklist items with instructions and expected results', () => {
      render(<VerificationChecklist steps={mockSteps} />);

      expect(screen.getByText('Press Tab to focus the element.')).toBeInTheDocument();
      expect(screen.getByText('Focus ring is visibly displayed.')).toBeInTheDocument();
      expect(screen.getByText('Navigate with virtual cursor.')).toBeInTheDocument();
      expect(screen.getByText(/0 of 2 manual tests checked/i)).toBeInTheDocument();
    });

    it('toggles checkbox states and updates completed count', () => {
      render(<VerificationChecklist steps={mockSteps} />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(2);

      // Check first item
      fireEvent.click(checkboxes[0]!);
      expect(checkboxes[0]).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByText(/1 of 2 manual tests checked/i)).toBeInTheDocument();

      // Uncheck first item
      fireEvent.click(checkboxes[0]!);
      expect(checkboxes[0]).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByText(/0 of 2 manual tests checked/i)).toBeInTheDocument();
    });

    it('displays non-misleading certification notice', () => {
      render(<VerificationChecklist steps={mockSteps} />);
      expect(screen.getByText(/certification notice:/i)).toBeInTheDocument();
      expect(
        screen.getByText(/status is certified automatically on subsequent rescan/i)
      ).toBeInTheDocument();
    });
  });

  describe('RemediationGuidancePanel', () => {
    it('renders problem, why it matters, classification, root cause, and code solutions', () => {
      render(
        <RemediationGuidancePanel finding={mockFinding} remediationStatus="suggested" />
      );

      expect(screen.getByText('Normative WCAG Failure')).toBeInTheDocument();
      expect(screen.getByText(/why it matters/i)).toBeInTheDocument();
      expect(screen.getByText(/root cause analysis/i)).toBeInTheDocument();
      expect(screen.getByText(/anti-pattern \(inaccessible code\)/i)).toBeInTheDocument();
      expect(screen.getByText(/recommended accessible solutions/i)).toBeInTheDocument();
      expect(screen.getByText(/common pitfalls & side effects/i)).toBeInTheDocument();
      expect(
        screen.getByText(/deque university axe-core rule documentation/i)
      ).toBeInTheDocument();
    });

    it('triggers onStatusChange when "Mark as Attempted" is clicked', async () => {
      const handleStatusChange = vi.fn();
      render(
        <RemediationGuidancePanel
          finding={mockFinding}
          remediationStatus="suggested"
          onStatusChange={handleStatusChange}
        />
      );

      const attemptBtn = screen.getByRole('button', {
        name: /mark finding remediation as attempted/i,
      });
      await act(async () => {
        fireEvent.click(attemptBtn);
      });

      expect(handleStatusChange).toHaveBeenCalledWith('attempted', '');
    });

    it('triggers onStatusChange when "Reset to Suggested" is clicked from attempted status', async () => {
      const handleStatusChange = vi.fn();
      render(
        <RemediationGuidancePanel
          finding={mockFinding}
          remediationStatus="attempted"
          onStatusChange={handleStatusChange}
        />
      );

      const resetBtn = screen.getByRole('button', {
        name: /reset finding remediation status to suggested/i,
      });
      await act(async () => {
        fireEvent.click(resetBtn);
      });

      expect(handleStatusChange).toHaveBeenCalledWith('suggested', '');
    });

    it('prohibits a manual "Verify" button (enforcing rescan certification invariant)', () => {
      render(
        <RemediationGuidancePanel
          finding={mockFinding}
          remediationStatus="attempted"
          onStatusChange={vi.fn()}
        />
      );

      // Verify that NO button with "Verify" or "Mark as Verified" exists
      expect(
        screen.queryByRole('button', { name: /mark as verified/i })
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^verify$/i })).not.toBeInTheDocument();
    });

    it('allows entering user notes and limits to 500 characters', () => {
      render(
        <RemediationGuidancePanel
          finding={mockFinding}
          remediationStatus="suggested"
          onStatusChange={vi.fn()}
        />
      );

      const textarea = screen.getByPlaceholderText(/add context on the applied fix/i);
      expect(textarea).toBeInTheDocument();

      fireEvent.change(textarea, {
        target: { value: 'Added accessible name in PR #42' },
      });
      expect(textarea).toHaveValue('Added accessible name in PR #42');
      expect(screen.getByText(/31\/500/)).toBeInTheDocument();
    });

    it('displays regression warning alert when isRegression is true', () => {
      render(
        <RemediationGuidancePanel
          finding={mockFinding}
          remediationStatus="unresolved"
          isRegression={true}
          onStatusChange={vi.fn()}
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(screen.getByText('Regression Detected')).toBeInTheDocument();
      expect(
        screen.getByText(/previously verified resolved, but has resurfaced/i)
      ).toBeInTheDocument();
    });
  });

  describe('CrossScanDiffBanner — Rescan Verification Integration', () => {
    const mockComparison: ScanComparison = {
      fromScanId: crypto.randomUUID(),
      toScanId: crypto.randomUUID(),
      generatedAt: new Date().toISOString(),
      resolved: [mockFinding],
      unchanged: [],
      newFindings: [],
      uncertainMatches: [],
      metrics: {
        baselineTotal: 1,
        rescanTotal: 0,
        resolvedCount: 1,
        unchangedCount: 0,
        newCount: 0,
        uncertainCount: 0,
        netProgress: 1,
        improvementScore: 100,
      },
    };

    it('renders certified verified notice when newlyVerified findings exist', () => {
      const summary: RescanVerificationSummary = {
        comparable: true,
        scanId: mockComparison.toScanId,
        baselineScanId: mockComparison.fromScanId,
        totalEvaluated: 1,
        newlyVerified: [
          {
            fingerprint: mockFinding.fingerprint,
            previousStatus: 'attempted',
            newStatus: 'verified',
            action: 'verified',
            reason: 'Resolved on rescan',
          },
        ],
        stillPresent: [],
        regressions: [],
        uncertainMatches: [],
        retained: [],
        timestamp: new Date().toISOString(),
      };

      render(
        <CrossScanDiffBanner comparison={mockComparison} verificationSummary={summary} />
      );

      expect(screen.getByText(/1 fix/i)).toBeInTheDocument();
      expect(screen.getByText(/certified Verified on this rescan/i)).toBeInTheDocument();
      expect(screen.getByText(/1 verified/i)).toBeInTheDocument();
    });

    it('renders regression alert callout when regressions exist', () => {
      const summary: RescanVerificationSummary = {
        comparable: true,
        scanId: mockComparison.toScanId,
        baselineScanId: mockComparison.fromScanId,
        totalEvaluated: 1,
        newlyVerified: [],
        stillPresent: [],
        regressions: [
          {
            fingerprint: mockFinding.fingerprint,
            previousStatus: 'verified',
            newStatus: 'unresolved',
            action: 'unresolved',
            reason: 'Defect reappeared',
          },
        ],
        uncertainMatches: [],
        retained: [],
        timestamp: new Date().toISOString(),
      };

      render(
        <CrossScanDiffBanner comparison={mockComparison} verificationSummary={summary} />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(
        screen.getByText(/Regression Alert: 1 Verified Issue Reappeared/i)
      ).toBeInTheDocument();
    });

    it('renders skipped verification note when comparison was skipped', () => {
      const summary: RescanVerificationSummary = {
        comparable: false,
        scanId: mockComparison.toScanId,
        totalEvaluated: 1,
        newlyVerified: [],
        stillPresent: [],
        regressions: [],
        uncertainMatches: [],
        retained: [],
        skippedVerification: {
          count: 1,
          reason: 'Scan targets differ between baseline and rescan.',
        },
        timestamp: new Date().toISOString(),
      };

      render(
        <CrossScanDiffBanner comparison={mockComparison} verificationSummary={summary} />
      );

      expect(
        screen.getByText(
          /Verification Note: Scan targets differ between baseline and rescan/i
        )
      ).toBeInTheDocument();
    });

    it('renders explicit Disappeared card and advisory notice when findings disappear without verification', () => {
      const comparisonWithDisappeared: ScanComparison = {
        fromScanId: crypto.randomUUID(),
        toScanId: crypto.randomUUID(),
        generatedAt: new Date().toISOString(),
        isComparable: true,
        verifiedResolved: [],
        disappeared: [mockFinding],
        resolved: [mockFinding],
        unchanged: [],
        newFindings: [],
        uncertainMatches: [],
        metrics: {
          baselineTotal: 1,
          rescanTotal: 0,
          resolvedCount: 1,
          verifiedResolvedCount: 0,
          disappearedCount: 1,
          unchangedCount: 0,
          newCount: 0,
          uncertainCount: 0,
          netProgress: 1,
          verifiedNetProgress: 0,
          improvementScore: 100,
          verifiedImprovementScore: 0,
        },
      };

      render(<CrossScanDiffBanner comparison={comparisonWithDisappeared} />);

      // Must display Disappeared card with count and subtext
      expect(screen.getByText('Disappeared')).toBeInTheDocument();
      expect(screen.getByText('Absent (unverified)')).toBeInTheDocument();

      // Must display Verified card with '0 verified fixes'
      expect(screen.getByText('0 verified fixes')).toBeInTheDocument();

      // Must NEVER display 'Fixed issues'
      expect(screen.queryByText(/Fixed issues/i)).not.toBeInTheDocument();

      // Must display verified score
      expect(screen.getByText(/0% Verified Score/i)).toBeInTheDocument();

      // Must render advisory notice explaining disappearance is not proof of compliance
      expect(
        screen.getByText(/from the page DOM but has not been certified as fixed/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Disappearance is not proof of accessibility compliance/i)
      ).toBeInTheDocument();
    });
  });
});
