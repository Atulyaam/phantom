import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ComparisonSelector, ComparisonBanner } from '@/components/comparison';
import { FindingCard, FindingInspector } from '@/components/findings';
import { ScanHistoryDrawer } from '@/components/history';
import type { ScanSummary, ScanRecord } from '@/domain/scan';
import type { FindingRecord, UncertainFindingMatch } from '@/domain/finding';
import type { ScanComparison } from '@/domain/report';
import { storageService } from '@/lib/storage';

// Helper mock findings
const mockFinding1: FindingRecord = {
  fingerprint: 'fp-11111111-1111-1111-1111-111111111111',
  ruleId: 'button-name',
  impact: 'critical',
  description: 'Buttons must have discernible text',
  help: 'Buttons must have discernible text',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/button-name',
  wcagTags: ['wcag2a', 'wcag412'],
  roomId: 'name-chamber',
  affectedNodeCount: 1,
  nodes: [
    {
      target: ['button#submit'],
      htmlExcerpt: '<button id="submit"></button>',
      failureSummary: 'Fix element name',
    },
  ],
  firstSeenAt: '2026-11-01T12:00:00.000Z',
  reviewed: false,
};

const mockFinding2: FindingRecord = {
  fingerprint: 'fp-22222222-2222-2222-2222-222222222222',
  ruleId: 'color-contrast',
  impact: 'serious',
  description: 'Ensure elements have sufficient color contrast',
  help: 'Elements must meet minimum color contrast ratio',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast',
  wcagTags: ['wcag2aa', 'wcag143'],
  roomId: 'contrast-crypt',
  affectedNodeCount: 1,
  nodes: [
    {
      target: ['p.subtext'],
      htmlExcerpt: '<p class="subtext">Faint text</p>',
      failureSummary: 'Contrast ratio 2.1:1 below threshold',
    },
  ],
  firstSeenAt: '2026-11-01T12:00:00.000Z',
  reviewed: false,
};

const mockFinding3: FindingRecord = {
  fingerprint: 'fp-33333333-3333-3333-3333-333333333333',
  ruleId: 'image-alt',
  impact: 'critical',
  description: 'Images must have alternate text',
  help: 'Images must have alternate text',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/image-alt',
  wcagTags: ['wcag2a', 'wcag111'],
  roomId: 'portrait-gallery',
  affectedNodeCount: 1,
  nodes: [
    {
      target: ['img#ghost'],
      htmlExcerpt: '<img id="ghost" src="ghost.png">',
      failureSummary: 'Missing alt attribute',
    },
  ],
  firstSeenAt: '2026-11-02T12:00:00.000Z',
  reviewed: false,
};

// Helper mock scans
const mockScanA: ScanRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  tabUrl: 'https://mansion.test/corridor',
  hostname: 'mansion.test',
  pageTitle: 'Haunted Mansion — First Wing',
  axeVersion: '4.10.2',
  extensionVersion: '1.0.0',
  scannedAt: '2026-11-01T12:00:00.000Z',
  status: 'completed',
  findings: [mockFinding1, mockFinding2],
  passesCount: 15,
  incompleteChecksCount: 2,
  inapplicableCount: 40,
};

const mockScanB: ScanRecord = {
  id: '22222222-2222-4222-8222-222222222222',
  tabUrl: 'https://mansion.test/corridor',
  hostname: 'mansion.test',
  pageTitle: 'Haunted Mansion — First Wing Rescan',
  axeVersion: '4.10.2',
  extensionVersion: '1.0.0',
  scannedAt: '2026-11-02T12:00:00.000Z',
  status: 'completed',
  findings: [mockFinding2, mockFinding3],
  passesCount: 17,
  incompleteChecksCount: 1,
  inapplicableCount: 40,
};

const mockScanCrossUrl: ScanRecord = {
  id: '33333333-3333-4333-8333-333333333333',
  tabUrl: 'https://mansion.test/crypt',
  hostname: 'mansion.test',
  pageTitle: 'The Crypt Chamber',
  axeVersion: '4.10.2',
  extensionVersion: '1.0.0',
  scannedAt: '2026-11-03T12:00:00.000Z',
  status: 'completed',
  findings: [mockFinding2],
  passesCount: 10,
  incompleteChecksCount: 0,
  inapplicableCount: 30,
};

// Helper mock summaries
const mockSummaries: ScanSummary[] = [
  {
    id: mockScanB.id,
    tabUrl: mockScanB.tabUrl,
    hostname: mockScanB.hostname,
    pageTitle: mockScanB.pageTitle,
    scannedAt: mockScanB.scannedAt,
    status: mockScanB.status,
    totalFindings: mockScanB.findings.length,
    criticalCount: 1,
    seriousCount: 1,
    moderateCount: 0,
    minorCount: 0,
  },
  {
    id: mockScanA.id,
    tabUrl: mockScanA.tabUrl,
    hostname: mockScanA.hostname,
    pageTitle: mockScanA.pageTitle,
    scannedAt: mockScanA.scannedAt,
    status: mockScanA.status,
    totalFindings: mockScanA.findings.length,
    criticalCount: 1,
    seriousCount: 1,
    moderateCount: 0,
    minorCount: 0,
  },
  {
    id: mockScanCrossUrl.id,
    tabUrl: mockScanCrossUrl.tabUrl,
    hostname: mockScanCrossUrl.hostname,
    pageTitle: mockScanCrossUrl.pageTitle,
    scannedAt: mockScanCrossUrl.scannedAt,
    status: mockScanCrossUrl.status,
    totalFindings: mockScanCrossUrl.findings.length,
    criticalCount: 0,
    seriousCount: 1,
    moderateCount: 0,
    minorCount: 0,
  },
];

describe('Phase 7 Workstream 4: Cross-Scan Comparison UI & Diff Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ComparisonSelector Component', () => {
    it('renders an advisory empty state when fewer than 2 summaries are available', () => {
      const onCompare = vi.fn();
      const onCancel = vi.fn();

      render(
        <ComparisonSelector
          summaries={[mockSummaries[0]]}
          onCompare={onCompare}
          onCancel={onCancel}
        />
      );

      expect(
        screen.getByText(/Insufficient Hauntings for Comparison/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Cross-scan comparison requires at least/i)
      ).toBeInTheDocument();

      const backBtn = screen.getByRole('button', { name: /Back to Archive/i });
      fireEvent.click(backBtn);
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onCompare).not.toHaveBeenCalled();
    });

    it('renders baseline and target selectors with formatted scan summary options', () => {
      const onCompare = vi.fn();

      render(<ComparisonSelector summaries={mockSummaries} onCompare={onCompare} />);

      expect(screen.getByLabelText(/Baseline Haunting \(Before\)/i)).toBeInTheDocument();
      expect(
        screen.getByLabelText(/Target Haunting \(After \/ Rescan\)/i)
      ).toBeInTheDocument();

      const runButton = screen.getByRole('button', {
        name: /Run Comparison/i,
      });
      expect(runButton).toBeEnabled();
    });

    it('detects identical scan selection and disables comparison submission with error notice', () => {
      const onCompare = vi.fn();

      render(
        <ComparisonSelector
          summaries={mockSummaries}
          initialBaselineId={mockScanA.id}
          initialTargetId={mockScanA.id}
          onCompare={onCompare}
        />
      );

      // Warning alert should be shown
      expect(screen.getByText(/Identical Snapshots Selected/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Baseline and Target hauntings must be different snapshots/i)
      ).toBeInTheDocument();

      // Submit button must be disabled
      const runButton = screen.getByRole('button', {
        name: /Run Comparison/i,
      });
      expect(runButton).toBeDisabled();

      fireEvent.click(runButton);
      expect(onCompare).not.toHaveBeenCalled();
    });

    it('swaps baseline and target scans when swap button is clicked', () => {
      const onCompare = vi.fn();

      render(
        <ComparisonSelector
          summaries={mockSummaries}
          initialBaselineId={mockScanA.id}
          initialTargetId={mockScanB.id}
          onCompare={onCompare}
        />
      );

      const baselineSelect = screen.getByLabelText(
        /Baseline Haunting \(Before\)/i
      ) as HTMLSelectElement;
      const targetSelect = screen.getByLabelText(
        /Target Haunting \(After \/ Rescan\)/i
      ) as HTMLSelectElement;

      expect(baselineSelect.value).toBe(mockScanA.id);
      expect(targetSelect.value).toBe(mockScanB.id);

      const swapBtn = screen.getByRole('button', {
        name: /Swap baseline and target/i,
      });
      fireEvent.click(swapBtn);

      expect(baselineSelect.value).toBe(mockScanB.id);
      expect(targetSelect.value).toBe(mockScanA.id);
    });

    it('shows cross-page warning notice when baseline and target URLs differ', () => {
      render(
        <ComparisonSelector
          summaries={mockSummaries}
          initialBaselineId={mockScanA.id}
          initialTargetId={mockScanCrossUrl.id}
          onCompare={vi.fn()}
        />
      );

      expect(screen.getByText(/Cross-Page Target Notice/i)).toBeInTheDocument();
      expect(
        screen.getByText(/The comparison engine enforces strict URL comparability/i)
      ).toBeInTheDocument();
    });

    it('triggers onCompare with selected IDs when valid comparison form is submitted', () => {
      const onCompare = vi.fn();

      render(
        <ComparisonSelector
          summaries={mockSummaries}
          initialBaselineId={mockScanA.id}
          initialTargetId={mockScanB.id}
          onCompare={onCompare}
        />
      );

      const runButton = screen.getByRole('button', {
        name: /Run Comparison/i,
      });
      fireEvent.click(runButton);

      expect(onCompare).toHaveBeenCalledWith(mockScanA.id, mockScanB.id);
    });
  });

  describe('ComparisonBanner Component', () => {
    it('renders prominent notice and zero progress claim when scans are incomparable', () => {
      const incomparableDiff: ScanComparison = {
        fromScanId: mockScanA.id,
        toScanId: mockScanCrossUrl.id,
        generatedAt: '2026-11-03T12:00:00.000Z',
        isComparable: false,
        incomparableReason:
          "Scan targets differ: baseline 'https://mansion.test/corridor' vs rescan 'https://mansion.test/crypt'. Cannot verify fixes across different pages.",
        verifiedResolved: [],
        disappeared: [],
        resolved: [],
        unchanged: [],
        newFindings: [],
        uncertainMatches: [],
        metrics: {
          baselineTotal: 2,
          rescanTotal: 1,
          resolvedCount: 0,
          verifiedResolvedCount: 0,
          disappearedCount: 0,
          unchangedCount: 0,
          newCount: 0,
          uncertainCount: 0,
          netProgress: 0,
          verifiedNetProgress: 0,
          improvementScore: 0,
          verifiedImprovementScore: 0,
        },
      };

      const onSelectCategory = vi.fn();
      const onChangeComparison = vi.fn();
      const onExitComparison = vi.fn();

      render(
        <ComparisonBanner
          baselineScan={mockScanA}
          targetScan={mockScanCrossUrl}
          comparison={incomparableDiff}
          activeCategory="all"
          onSelectCategory={onSelectCategory}
          onChangeComparison={onChangeComparison}
          onExitComparison={onExitComparison}
        />
      );

      expect(screen.getByText(/Incomparable Hauntings/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Remediation Verification Inapplicable/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Zero verified progress is claimed/i)).toBeInTheDocument();

      // Change comparison button
      const changeBtn = screen.getByRole('button', { name: /Change Scans/i });
      fireEvent.click(changeBtn);
      expect(onChangeComparison).toHaveBeenCalledTimes(1);

      // Exit comparison button
      const exitBtn = screen.getByRole('button', {
        name: /Exit cross-scan comparison/i,
      });
      fireEvent.click(exitBtn);
      expect(onExitComparison).toHaveBeenCalledTimes(1);
    });

    it('renders comparison metrics across all 5 canonical categories and handles filter selection', () => {
      const mockUncertainMatch: UncertainFindingMatch = {
        baselineFinding: mockFinding1,
        candidateRescanFinding: {
          ...mockFinding1,
          nodes: [
            {
              target: ['button.btn-primary'],
              htmlExcerpt: '<button class="btn-primary"></button>',
              failureSummary: 'Fix element name',
            },
          ],
        },
        confidence: 'high',
        reason:
          "Rule 'button-name' continues to fail on a matching <button> element, although selector path shifted.",
      };

      const comparableDiff: ScanComparison = {
        fromScanId: mockScanA.id,
        toScanId: mockScanB.id,
        generatedAt: '2026-11-02T12:00:00.000Z',
        isComparable: true,
        verifiedResolved: [mockFinding1],
        disappeared: [mockFinding2],
        resolved: [mockFinding1, mockFinding2],
        unchanged: [],
        newFindings: [mockFinding3],
        uncertainMatches: [mockUncertainMatch],
        metrics: {
          baselineTotal: 2,
          rescanTotal: 2,
          resolvedCount: 2,
          verifiedResolvedCount: 1,
          disappearedCount: 1,
          unchangedCount: 0,
          newCount: 1,
          uncertainCount: 1,
          netProgress: 1,
          verifiedNetProgress: 0,
          improvementScore: 100,
          verifiedImprovementScore: 50,
        },
      };

      const onSelectCategory = vi.fn();

      render(
        <ComparisonBanner
          baselineScan={mockScanA}
          targetScan={mockScanB}
          comparison={comparableDiff}
          activeCategory="all"
          onSelectCategory={onSelectCategory}
          onChangeComparison={vi.fn()}
          onExitComparison={vi.fn()}
        />
      );

      // Verified score
      expect(screen.getByText(/50% Verified Score/i)).toBeInTheDocument();

      // Disappeared callout
      expect(
        screen.getByText(/1 Disappeared Finding \(Unverified\):/i)
      ).toBeInTheDocument();

      // Metric buttons
      const verifiedFixesBtn = screen.getByRole('button', {
        name: /Verified Fixes/i,
      });
      fireEvent.click(verifiedFixesBtn);
      expect(onSelectCategory).toHaveBeenCalledWith('verified-fix');

      const disappearedBtn = screen.getByRole('button', {
        name: /Disappeared/i,
      });
      fireEvent.click(disappearedBtn);
      expect(onSelectCategory).toHaveBeenCalledWith('disappeared');

      const newBtn = screen.getByRole('button', { name: /New Issues/i });
      fireEvent.click(newBtn);
      expect(onSelectCategory).toHaveBeenCalledWith('new');

      const uncertainBtn = screen.getByRole('button', {
        name: /Filter by Uncertain matches/i,
      });
      fireEvent.click(uncertainBtn);
      expect(onSelectCategory).toHaveBeenCalledWith('uncertain');

      // Expand uncertain match accordion
      const uncertainAccordionBtn = screen.getByRole('button', {
        name: /Inspect 1 Uncertain Match/i,
      });
      fireEvent.click(uncertainAccordionBtn);
      expect(screen.getByText(/although selector path shifted/i)).toBeInTheDocument();
      expect(screen.getByText(/high confidence/i)).toBeInTheDocument();
    });
  });

  describe('FindingCard Component in Comparison Mode', () => {
    it('renders VERIFIED FIX badge when comparisonCategory is verified-fix', () => {
      render(
        <FindingCard finding={{ ...mockFinding1, comparisonCategory: 'verified-fix' }} />
      );

      expect(screen.getByText(/Verified Fix/i)).toBeInTheDocument();
    });

    it('renders DISAPPEARED (UNVERIFIED) badge when comparisonCategory is disappeared', () => {
      render(
        <FindingCard finding={{ ...mockFinding2, comparisonCategory: 'disappeared' }} />
      );

      expect(screen.getByText(/Disappeared \(Unverified\)/i)).toBeInTheDocument();
    });

    it('renders UNCHANGED badge when comparisonCategory is unchanged', () => {
      render(
        <FindingCard finding={{ ...mockFinding2, comparisonCategory: 'unchanged' }} />
      );

      expect(screen.getByText(/Unchanged/i)).toBeInTheDocument();
    });

    it('renders NEW ISSUE badge when comparisonCategory is new', () => {
      render(<FindingCard finding={{ ...mockFinding3, comparisonCategory: 'new' }} />);

      expect(screen.getByText(/New Issue/i)).toBeInTheDocument();
    });

    it('renders UNCERTAIN MATCH badge and reason note when comparisonCategory is uncertain', () => {
      const reasonText = "Rule 'button-name' persists on <button> despite selector shift";
      render(
        <FindingCard
          finding={{
            ...mockFinding1,
            comparisonCategory: 'uncertain',
            uncertainReason: reasonText,
          }}
        />
      );

      expect(screen.getByText(/Uncertain Match/i)).toBeInTheDocument();
      expect(screen.getByText(reasonText)).toBeInTheDocument();
    });
  });

  describe('FindingInspector Component in Comparison Mode', () => {
    it('renders Comparison Diff badge and disables remediation editing in comparison mode', async () => {
      const onStatusChange = vi.fn();

      render(
        <FindingInspector
          finding={{ ...mockFinding1, comparisonCategory: 'verified-fix' }}
          onClose={vi.fn()}
          isComparison={true}
          onRemediationStatusChange={onStatusChange}
        />
      );

      expect(screen.getByText(/Comparison Diff/i)).toBeInTheDocument();
      expect(screen.getByText(/verified fix/i)).toBeInTheDocument();

      // Status change buttons should be hidden/disabled in comparison mode
      expect(screen.queryByText(/Mark as Attempted/i)).not.toBeInTheDocument();
    });
  });

  describe('ScanHistoryDrawer Tab & Comparison Integration', () => {
    it('switches to compare tab and pre-selects baseline when quick compare button is clicked', async () => {
      vi.spyOn(storageService, 'getScanSummaries').mockResolvedValue(mockSummaries);
      const onStartComparison = vi.fn();

      render(
        <ScanHistoryDrawer
          isOpen={true}
          onClose={vi.fn()}
          onSelectSnapshot={vi.fn()}
          onStartComparison={onStartComparison}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Haunted Mansion — First Wing')).toBeInTheDocument();
      });

      // Click the quick compare button on First Wing
      const compareButtons = screen.getAllByTitle(/Compare this snapshot/i);
      expect(compareButtons.length).toBeGreaterThan(0);
      fireEvent.click(compareButtons[1]); // First Wing

      // Should have switched to compare tab
      expect(screen.getByRole('tab', { name: /Compare Hauntings/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByText(/Cross-Scan Comparison Engine/i)).toBeInTheDocument();
    });

    it('loads full scans and invokes onStartComparison upon submitting valid comparison from drawer', async () => {
      vi.spyOn(storageService, 'getScanSummaries').mockResolvedValue(mockSummaries);
      vi.spyOn(storageService, 'getScanById').mockImplementation(async (id: string) => {
        if (id === mockScanA.id) return mockScanA;
        if (id === mockScanB.id) return mockScanB;
        return null;
      });

      const onStartComparison = vi.fn();
      const onClose = vi.fn();

      render(
        <ScanHistoryDrawer
          isOpen={true}
          onClose={onClose}
          onSelectSnapshot={vi.fn()}
          onStartComparison={onStartComparison}
          initialTab="compare"
          initialCompareBaselineId={mockScanA.id}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByLabelText(/Baseline Haunting \(Before\)/i)
        ).toBeInTheDocument();
      });

      const baselineSelect = screen.getByLabelText(
        /Baseline Haunting \(Before\)/i
      ) as HTMLSelectElement;
      const targetSelect = screen.getByLabelText(
        /Target Haunting \(After \/ Rescan\)/i
      ) as HTMLSelectElement;

      fireEvent.change(baselineSelect, { target: { value: mockScanA.id } });
      fireEvent.change(targetSelect, { target: { value: mockScanB.id } });

      const runButton = screen.getByRole('button', {
        name: /Run Comparison/i,
      });
      fireEvent.click(runButton);

      await waitFor(() => {
        expect(onStartComparison).toHaveBeenCalledWith(mockScanA, mockScanB);
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('Workstream 4 Final Independent Audit & Defect Regression Tests (DEF-711 to DEF-715)', () => {
    it('DEF-711: FindingCard does not render review toggle button when onToggleReviewed is undefined in comparison mode', () => {
      render(
        <FindingCard
          finding={mockFinding1}
          comparisonCategory="verified-fix"
          onToggleReviewed={undefined}
        />
      );

      expect(
        screen.queryByRole('button', { name: /Mark button-name as/i })
      ).not.toBeInTheDocument();
      expect(screen.getByText('Verified Fix')).toBeInTheDocument();
    });

    it('DEF-712: ComparisonSelector does not show cross-page warning for URLs equivalent under normalizeUrlForComparison', () => {
      const summaryTrailingSlash: ScanSummary = {
        ...mockSummaries[0],
        id: 'scan-trailing',
        tabUrl: 'https://example.com/about/',
      };
      const summaryNoTrailingSlash: ScanSummary = {
        ...mockSummaries[1],
        id: 'scan-notrailing',
        tabUrl: 'https://example.com/about',
      };

      render(
        <ComparisonSelector
          summaries={[summaryTrailingSlash, summaryNoTrailingSlash]}
          initialBaselineId="scan-trailing"
          initialTargetId="scan-notrailing"
          onCompare={vi.fn()}
        />
      );

      // Warning note should NOT be rendered since normalizeUrlForComparison strips trailing slashes on non-root paths
      expect(screen.queryByText(/Cross-Page Target Notice/i)).not.toBeInTheDocument();
    });

    it('DEF-714: ComparisonSelector syncs baselineId when initialBaselineId prop updates', () => {
      const { rerender } = render(
        <ComparisonSelector
          summaries={mockSummaries}
          initialBaselineId={mockSummaries[1].id}
          onCompare={vi.fn()}
        />
      );

      const baselineSelect = screen.getByLabelText(
        /Baseline Haunting \(Before\)/i
      ) as HTMLSelectElement;
      expect(baselineSelect.value).toBe(mockSummaries[1].id);

      // Rerender with new initialBaselineId
      rerender(
        <ComparisonSelector
          summaries={mockSummaries}
          initialBaselineId={mockSummaries[0].id}
          onCompare={vi.fn()}
        />
      );

      expect(baselineSelect.value).toBe(mockSummaries[0].id);
    });

    it('DEF-714: ComparisonSelector recovers safely when selected snapshot is deleted from summaries', () => {
      const { rerender } = render(
        <ComparisonSelector
          summaries={mockSummaries}
          initialBaselineId={mockSummaries[0].id}
          initialTargetId={mockSummaries[1].id}
          onCompare={vi.fn()}
        />
      );

      // Simulate deletion of mockSummaries[0]
      const remainingSummaries = [
        mockSummaries[1],
        { ...mockSummaries[0], id: 'scan-3', pageTitle: 'Third Snapshot' },
      ];

      rerender(<ComparisonSelector summaries={remainingSummaries} onCompare={vi.fn()} />);

      const baselineSelect = screen.getByLabelText(
        /Baseline Haunting \(Before\)/i
      ) as HTMLSelectElement;
      // Should not hold the deleted id
      expect(baselineSelect.value).not.toBe(mockSummaries[0].id);
      expect(remainingSummaries.some((s) => s.id === baselineSelect.value)).toBe(true);
    });

    it('DEF-715: FindingInspector displays uncertainReason in dedicated callout when inspecting uncertain match', () => {
      const uncertainFinding: FindingRecord = {
        ...mockFinding1,
        comparisonCategory: 'uncertain',
        uncertainReason:
          'Selector drift detected: matching button-name rule but button shifted from .header to .nav',
      };

      render(
        <FindingInspector
          finding={uncertainFinding}
          onClose={vi.fn()}
          isComparison={true}
        />
      );

      expect(
        screen.getByRole('note', { name: /Uncertain match explanation/i })
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /Selector drift detected: matching button-name rule but button shifted from \.header to \.nav/i
        )
      ).toBeInTheDocument();
    });

    it('DEF-715: FindingCard renders MinusCircle icon and Unchanged badge', () => {
      render(<FindingCard finding={mockFinding1} comparisonCategory="unchanged" />);

      expect(screen.getByText('Unchanged')).toBeInTheDocument();
      // Icon is rendered inside parent badge span
      const badge = screen.getByText('Unchanged').parentElement;
      expect(badge?.querySelector('svg')).toBeInTheDocument();
    });
  });
});
