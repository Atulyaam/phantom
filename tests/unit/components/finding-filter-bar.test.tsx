import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FindingFilterBar } from '@/components/findings/FindingFilterBar';
import { GroupedFindingList } from '@/components/findings/GroupedFindingList';
import type { FindingRecord } from '@/domain/finding';

const mockFinding1: FindingRecord = {
  fingerprint: 'v1:button-name:button#submit',
  ruleId: 'button-name',
  impact: 'critical',
  description: 'Button requires accessible name',
  help: 'Buttons must have discernible text',
  wcagTags: ['wcag2a'],
  roomId: 'name-chamber',
  affectedNodeCount: 1,
  nodes: [
    {
      target: ['button#submit'],
      htmlExcerpt: '<button id="submit"></button>',
      failureSummary: 'Element has no title or text',
    },
  ],
  firstSeenAt: new Date().toISOString(),
  reviewed: false,
};

const mockFinding2: FindingRecord = {
  fingerprint: 'v1:color-contrast:p.text',
  ruleId: 'color-contrast',
  impact: 'serious',
  description: 'Contrast ratio insufficient',
  help: 'Elements must have sufficient color contrast',
  wcagTags: ['wcag2aa'],
  roomId: 'contrast-crypt',
  affectedNodeCount: 2,
  nodes: [
    {
      target: ['p.text'],
      htmlExcerpt: '<p class="text">Muted</p>',
      failureSummary: 'Expected 4.5:1, got 2.1:1',
    },
  ],
  firstSeenAt: new Date().toISOString(),
  reviewed: true,
};

describe('FindingFilterBar Component', () => {
  it('renders all filter controls and handles interactions', () => {
    const onSearchChange = vi.fn();
    const onImpactChange = vi.fn();
    const onConformanceChange = vi.fn();
    const onReviewStatusChange = vi.fn();
    const onGroupByChange = vi.fn();
    const onSortByChange = vi.fn();
    const onResetFilters = vi.fn();

    render(
      <FindingFilterBar
        totalCount={10}
        filteredCount={5}
        searchQuery="button"
        onSearchChange={onSearchChange}
        selectedImpact="critical"
        onImpactChange={onImpactChange}
        conformance="all"
        onConformanceChange={onConformanceChange}
        reviewStatus="all"
        onReviewStatusChange={onReviewStatusChange}
        groupBy="none"
        onGroupByChange={onGroupByChange}
        sortBy="severity-desc"
        onSortByChange={onSortByChange}
        onResetFilters={onResetFilters}
        isFilterActive={true}
      />
    );

    // Check count display
    expect(screen.getByText(/5 of 10 findings/i)).toBeInTheDocument();

    // Search input change
    const searchInput = screen.getByPlaceholderText(/search rules, selectors/i);
    expect(searchInput).toHaveValue('button');
    fireEvent.change(searchInput, { target: { value: 'contrast' } });
    expect(onSearchChange).toHaveBeenCalledWith('contrast');

    // Click severity chip
    const seriousChip = screen.getByRole('button', { name: /^serious$/i });
    fireEvent.click(seriousChip);
    expect(onImpactChange).toHaveBeenCalledWith('serious');

    // Click conformance tab
    const advisoryTab = screen.getByRole('button', { name: /advisory only/i });
    fireEvent.click(advisoryTab);
    expect(onConformanceChange).toHaveBeenCalledWith('advisory');

    // Click review status tab
    const reviewedTab = screen.getByRole('button', { name: /^reviewed$/i });
    fireEvent.click(reviewedTab);
    expect(onReviewStatusChange).toHaveBeenCalledWith('reviewed');

    // Reset button clicked
    const resetBtn = screen.getByRole('button', { name: /reset all filters/i });
    fireEvent.click(resetBtn);
    expect(onResetFilters).toHaveBeenCalled();
  });
});

describe('GroupedFindingList Component', () => {
  it('renders flat list correctly when groupBy is none', () => {
    render(<GroupedFindingList findings={[mockFinding1, mockFinding2]} groupBy="none" />);

    expect(screen.getByText('button-name')).toBeInTheDocument();
    expect(screen.getByText('color-contrast')).toBeInTheDocument();
  });

  it('renders grouped sections when groupBy is room', () => {
    render(<GroupedFindingList findings={[mockFinding1, mockFinding2]} groupBy="room" />);

    expect(screen.getByText(/The Name Chamber/i)).toBeInTheDocument();
    expect(screen.getByText(/The Contrast Crypt/i)).toBeInTheDocument();
  });

  it('renders grouped sections when groupBy is severity', () => {
    render(
      <GroupedFindingList findings={[mockFinding1, mockFinding2]} groupBy="severity" />
    );

    expect(
      screen.getByRole('heading', { name: /critical severity/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /serious severity/i })
    ).toBeInTheDocument();
  });

  it('renders accessible empty state when 0 findings match', () => {
    const onReset = vi.fn();
    render(<GroupedFindingList findings={[]} groupBy="none" onResetFilters={onReset} />);

    expect(screen.getByText(/no matching accessibility findings/i)).toBeInTheDocument();

    const resetBtn = screen.getByRole('button', { name: /reset active filters/i });
    fireEvent.click(resetBtn);
    expect(onReset).toHaveBeenCalled();
  });
});
