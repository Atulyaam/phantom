import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState, DemoBanner } from '@/components/states';

describe('Application States & Notice Components', () => {
  describe('EmptyState', () => {
    it('renders dormant state with action button', () => {
      const handleAction = vi.fn();
      render(
        <EmptyState type="no-scan" onAction={handleAction} actionLabel="Awaken Mansion" />
      );

      expect(screen.getByText(/the mansion lies dormant/i)).toBeInTheDocument();
      const actionBtn = screen.getByRole('button', { name: /awaken mansion/i });
      fireEvent.click(actionBtn);
      expect(handleAction).toHaveBeenCalledTimes(1);
    });

    it('renders clean audit peaceful state', () => {
      render(<EmptyState type="clean-audit" />);
      expect(screen.getByText(/the mansion is peaceful/i)).toBeInTheDocument();
    });

    it('renders error state with custom message', () => {
      render(<EmptyState type="error" errorMessage="Custom script evaluation failure" />);
      expect(screen.getByText('Custom script evaluation failure')).toBeInTheDocument();
    });

    it('renders unsupported page state', () => {
      render(<EmptyState type="unsupported" />);
      expect(screen.getByText(/forbidden territory/i)).toBeInTheDocument();
    });
  });

  describe('DemoBanner', () => {
    it('renders warning notice and triggers clear and dismiss callbacks', () => {
      const handleClear = vi.fn();
      const handleDismiss = vi.fn();

      render(<DemoBanner onClearDemo={handleClear} onDismiss={handleDismiss} />);

      expect(screen.getByText(/demonstration mode active/i)).toBeInTheDocument();
      expect(screen.getByText(/mock data/i)).toBeInTheDocument();

      const clearBtn = screen.getByRole('button', { name: /clear demo/i });
      fireEvent.click(clearBtn);
      expect(handleClear).toHaveBeenCalledTimes(1);

      const dismissBtn = screen.getByRole('button', {
        name: /dismiss demo notice/i,
      });
      fireEvent.click(dismissBtn);
      expect(handleDismiss).toHaveBeenCalledTimes(1);
    });
  });
});
