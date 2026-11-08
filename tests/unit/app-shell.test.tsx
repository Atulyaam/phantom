import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import App from '@/entrypoints/dashboard/App';

describe('Dashboard Application Shell', () => {
  beforeEach(() => {
    // Reset window query string before each test
    window.history.replaceState({}, '', '/');
  });

  it('renders application branding, header, and compliance footer', async () => {
    await act(async () => {
      render(<App />);
    });

    expect(
      screen.getByRole('heading', { level: 1, name: /phantom audit/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/haunted mansion accessibility auditor/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(
      screen.getByText(/zero automated findings does not certify wcag 2.2 conformance/i)
    ).toBeInTheDocument();
  });

  it('provides a skip-to-content accessible link for keyboard users', async () => {
    await act(async () => {
      render(<App />);
    });
    const skipLink = screen.getByRole('link', { name: /skip to main content/i });
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  it('toggles reduced motion mode when user clicks the toggle', async () => {
    await act(async () => {
      render(<App />);
    });
    const toggleButton = screen.getByRole('button', {
      name: /reduced motion: disabled/i,
    });
    expect(toggleButton).toHaveAttribute('aria-pressed', 'false');

    await act(async () => {
      fireEvent.click(toggleButton);
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /reduced motion: enabled/i })
      ).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('toggles between Mansion Map and List View representation', async () => {
    await act(async () => {
      render(<App />);
    });

    const mansionTab = screen.getByRole('button', { name: /mansion map/i });
    const listTab = screen.getByRole('button', { name: /list view/i });

    expect(mansionTab).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('region', { name: /haunted mansion 2d map/i })
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(listTab);
    });

    expect(listTab).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('region', { name: /mansion room taxonomy list/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('renders unsupported page alert when unsupported=1 query parameter is set', async () => {
    window.history.replaceState(
      {},
      '',
      '/?tabId=12&unsupported=1&url=chrome%3A%2F%2Fextensions&title=Extensions'
    );
    await act(async () => {
      render(<App />);
    });

    expect(
      screen.getByRole('heading', { name: /ineligible inspection target/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/cannot inspect browser-internal pages/i)
    ).toBeInTheDocument();
  });

  it('inspects room taxonomy when a mansion room card is clicked', async () => {
    await act(async () => {
      render(<App />);
    });

    const nameChamberCard = screen.getByText('The Name Chamber');
    await act(async () => {
      fireEvent.click(nameChamberCard);
    });

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /the name chamber taxonomy inspector/i })
      ).toBeInTheDocument();
      expect(screen.getByText('button-name')).toBeInTheDocument();
    });

    const closeButton = screen.getByRole('button', { name: /close inspector/i });
    await act(async () => {
      fireEvent.click(closeButton);
    });

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: /the name chamber taxonomy inspector/i })
      ).not.toBeInTheDocument();
    });
  });
});
