import { Search, X, SlidersHorizontal, RotateCcw } from 'lucide-react';
import type { Impact } from '@/domain/finding';
import type {
  ConformanceFilter,
  ReviewStatusFilter,
  FindingSortBy,
} from '@/features/findings/finding-filters';

export type GroupByOption = 'none' | 'room' | 'severity' | 'principle';

export interface FindingFilterBarProps {
  totalCount: number;
  filteredCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedImpact: Impact | 'all';
  onImpactChange: (impact: Impact | 'all') => void;
  conformance: ConformanceFilter;
  onConformanceChange: (conf: ConformanceFilter) => void;
  reviewStatus: ReviewStatusFilter;
  onReviewStatusChange: (status: ReviewStatusFilter) => void;
  groupBy: GroupByOption;
  onGroupByChange: (group: GroupByOption) => void;
  sortBy: FindingSortBy;
  onSortByChange: (sort: FindingSortBy) => void;
  onResetFilters: () => void;
  isFilterActive: boolean;
}

export function FindingFilterBar({
  totalCount,
  filteredCount,
  searchQuery,
  onSearchChange,
  selectedImpact,
  onImpactChange,
  conformance,
  onConformanceChange,
  reviewStatus,
  onReviewStatusChange,
  groupBy,
  onGroupByChange,
  sortBy,
  onSortByChange,
  onResetFilters,
  isFilterActive,
}: FindingFilterBarProps) {
  const impacts: { id: Impact | 'all'; label: string; activeColor: string }[] = [
    { id: 'all', label: 'All Severities', activeColor: 'bg-purple-700 text-white' },
    { id: 'critical', label: 'Critical', activeColor: 'bg-red-700 text-white' },
    { id: 'serious', label: 'Serious', activeColor: 'bg-orange-700 text-white' },
    { id: 'moderate', label: 'Moderate', activeColor: 'bg-amber-600 text-white' },
    { id: 'minor', label: 'Minor', activeColor: 'bg-blue-600 text-white' },
  ];

  return (
    <section
      aria-label="Finding Filter and Sorting Controls"
      className="p-4 rounded-xl bg-surface border border-border-default space-y-3.5 shadow-sm"
    >
      {/* Top Row: Search Input + Sort Dropdown + Grouping Selector */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search input with integrated clear button */}
        <div className="relative flex-1">
          <label htmlFor="finding-search-input" className="sr-only">
            Search findings by rule, description, selector, or reason
          </label>
          <Search
            className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="finding-search-input"
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search rules, selectors, or descriptions..."
            className="w-full pl-9 pr-9 py-2 text-xs rounded-lg bg-surface-raised border border-border-default text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search input"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-0.5 rounded focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Grouping and Sorting dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Group By selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <label htmlFor="group-by-select" className="text-gray-400 shrink-0">
              Group:
            </label>
            <select
              id="group-by-select"
              value={groupBy}
              onChange={(e) => onGroupByChange(e.target.value as GroupByOption)}
              className="px-2.5 py-1.5 rounded-lg bg-surface-raised border border-border-default text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 cursor-pointer"
            >
              <option value="none">Flat List</option>
              <option value="room">By Room</option>
              <option value="severity">By Severity</option>
              <option value="principle">By WCAG Principle</option>
            </select>
          </div>

          {/* Sort By selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <label htmlFor="sort-by-select" className="text-gray-400 shrink-0">
              Sort:
            </label>
            <select
              id="sort-by-select"
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value as FindingSortBy)}
              className="px-2.5 py-1.5 rounded-lg bg-surface-raised border border-border-default text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 cursor-pointer"
            >
              <option value="severity-desc">Severity (High → Low)</option>
              <option value="severity-asc">Severity (Low → High)</option>
              <option value="rule-asc">Rule ID (A → Z)</option>
              <option value="nodes-desc">Affected Nodes (High → Low)</option>
            </select>
          </div>

          {/* Reset Filters button */}
          {isFilterActive && (
            <button
              type="button"
              onClick={onResetFilters}
              aria-label="Reset all filters"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-raised border border-border-default hover:bg-surface-overlay text-purple-300 hover:text-purple-200 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Row: Severity Pills + Conformance Tabs + Review Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border-subtle">
        {/* Severity Pills */}
        <div
          role="group"
          aria-label="Filter by severity impact"
          className="flex flex-wrap items-center gap-1.5 text-xs"
        >
          {impacts.map(({ id, label, activeColor }) => {
            const isSelected = selectedImpact === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onImpactChange(id)}
                aria-pressed={isSelected}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
                  isSelected
                    ? `${activeColor} border-transparent shadow-sm`
                    : 'bg-surface-raised border-border-subtle text-gray-400 hover:text-gray-200 hover:bg-surface-overlay'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Conformance & Review Status toggles */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Conformance Filter */}
          <div
            role="group"
            aria-label="Filter by conformance level"
            className="flex items-center rounded-md border border-border-default bg-surface-raised p-0.5 text-xs"
          >
            {(
              [
                { id: 'all', label: 'All Rules' },
                { id: 'wcag', label: 'WCAG Conformance' },
                { id: 'advisory', label: 'Advisory Only' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onConformanceChange(tab.id)}
                aria-pressed={conformance === tab.id}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  conformance === tab.id
                    ? 'bg-purple-700 text-white font-medium shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Review Status Filter */}
          <div
            role="group"
            aria-label="Filter by review status"
            className="flex items-center rounded-md border border-border-default bg-surface-raised p-0.5 text-xs"
          >
            {(
              [
                { id: 'all', label: 'All Status' },
                { id: 'unreviewed', label: 'Unreviewed' },
                { id: 'reviewed', label: 'Reviewed' },
              ] as const
            ).map((statusTab) => (
              <button
                key={statusTab.id}
                type="button"
                onClick={() => onReviewStatusChange(statusTab.id)}
                aria-pressed={reviewStatus === statusTab.id}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  reviewStatus === statusTab.id
                    ? 'bg-purple-700 text-white font-medium shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {statusTab.label}
              </button>
            ))}
          </div>

          {/* Result counter badge */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono">
            <SlidersHorizontal
              className="w-3.5 h-3.5 text-purple-400"
              aria-hidden="true"
            />
            <span>
              {filteredCount} of {totalCount} finding{totalCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
