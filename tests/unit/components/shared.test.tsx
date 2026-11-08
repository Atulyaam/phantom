import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button, Card, Badge, SeverityBadge, RoomStatusBadge } from '@/components/shared';
import type { Impact } from '@/domain/finding';
import type { RoomState } from '@/domain/room';

describe('Phase 2 Shared Design System Components', () => {
  describe('Button', () => {
    it('renders with different variants and handles clicks', () => {
      const handleClick = vi.fn();
      render(
        <Button variant="primary" size="md" onClick={handleClick}>
          Click Me
        </Button>
      );
      const button = screen.getByRole('button', { name: /click me/i });
      expect(button).toBeInTheDocument();
      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('respects disabled attribute', () => {
      const handleClick = vi.fn();
      render(
        <Button disabled onClick={handleClick}>
          Disabled Button
        </Button>
      );
      const button = screen.getByRole('button', { name: /disabled button/i });
      expect(button).toBeDisabled();
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Card', () => {
    it('renders card content with proper classes', () => {
      render(
        <Card variant="raised" interactive>
          <p>Card content</p>
        </Card>
      );
      expect(screen.getByText('Card content')).toBeInTheDocument();
    });
  });

  describe('Badge', () => {
    it('renders children with custom variant', () => {
      render(<Badge variant="purple">Spectral</Badge>);
      expect(screen.getByText('Spectral')).toBeInTheDocument();
    });
  });

  describe('SeverityBadge (WCAG 1.4.1 Non-Color Dual Encoding)', () => {
    const impacts: Impact[] = ['critical', 'serious', 'moderate', 'minor', 'unknown'];

    it.each(impacts)('renders dual-encoded badge for %s impact', (impact) => {
      render(<SeverityBadge impact={impact} />);
      // Must contain screen reader severity text
      expect(screen.getByText(new RegExp(`${impact} severity`, 'i'))).toBeInTheDocument();
      // Must contain visible label text
      expect(screen.getByText(new RegExp(`^${impact}$`, 'i'))).toBeInTheDocument();
    });

    it('supports hidden label mode while preserving accessible name', () => {
      render(<SeverityBadge impact="critical" showLabel={false} />);
      expect(screen.getByText(/critical severity/i)).toBeInTheDocument();
    });
  });

  describe('RoomStatusBadge', () => {
    const states: Array<{ state: RoomState; label: string }> = [
      { state: 'haunted', label: 'Haunted' },
      { state: 'quiet', label: 'Quiet' },
      { state: 'not-checked', label: 'Not Checked' },
      { state: 'manual-review', label: 'Needs Review' },
    ];

    it.each(states)('renders $state state as $label', ({ state, label }) => {
      render(<RoomStatusBadge state={state} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });
});
