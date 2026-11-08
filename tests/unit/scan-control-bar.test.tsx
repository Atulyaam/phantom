import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScanControlBar, ActiveTabExplainer } from '@/components/scan';

describe('Phase 3 ScanControlBar & ActiveTabExplainer', () => {
  const defaultEligibility = {
    isEligible: true,
    title: 'Eligible Target Page',
    normalizedUrl: 'https://example.com',
  };

  it('renders connected live status and allows starting an audit', () => {
    const handleStart = vi.fn();
    const handleRefresh = vi.fn();

    render(
      <ScanControlBar
        tabId={42}
        targetUrl="https://example.com"
        connectionStatus="connected"
        eligibility={defaultEligibility}
        isPreparingScan={false}
        scanHandshakeMessage={null}
        errorMessage={null}
        onStartAudit={handleStart}
        onRefreshStatus={handleRefresh}
      />
    );

    expect(screen.getByText('Target Tab Live')).toBeInTheDocument();
    const startBtn = screen.getByRole('button', {
      name: /start accessibility audit/i,
    });
    expect(startBtn).toBeEnabled();

    fireEvent.click(startBtn);
    expect(handleStart).toHaveBeenCalledTimes(1);

    const checkTabBtn = screen.getByRole('button', { name: /check tab/i });
    fireEvent.click(checkTabBtn);
    expect(handleRefresh).toHaveBeenCalledTimes(1);
  });

  it('disables audit button when target tab is ineligible', () => {
    const ineligible = {
      isEligible: false,
      reason: 'chrome-internal' as const,
      title: 'Chrome Internal Page Restricted',
      guidance: 'Cannot inspect internal pages',
      normalizedUrl: 'chrome://settings',
    };

    render(
      <ScanControlBar
        tabId={1}
        targetUrl="chrome://settings"
        connectionStatus="ineligible"
        eligibility={ineligible}
        isPreparingScan={false}
        scanHandshakeMessage={null}
        errorMessage={null}
        onStartAudit={vi.fn()}
        onRefreshStatus={vi.fn()}
      />
    );

    expect(screen.getByText('Ineligible Target')).toBeInTheDocument();
    const startBtn = screen.getByRole('button', {
      name: /start accessibility audit/i,
    });
    expect(startBtn).toBeDisabled();
  });

  it('disables audit button when target tab was closed', () => {
    render(
      <ScanControlBar
        tabId={55}
        targetUrl="https://example.com"
        connectionStatus="closed"
        eligibility={defaultEligibility}
        isPreparingScan={false}
        scanHandshakeMessage={null}
        errorMessage="Target tab was closed in the browser."
        onStartAudit={vi.fn()}
        onRefreshStatus={vi.fn()}
      />
    );

    expect(screen.getByText('Target Tab Closed')).toBeInTheDocument();
    expect(screen.getByText('Target tab was closed in the browser.')).toBeInTheDocument();
    const startBtn = screen.getByRole('button', {
      name: /start accessibility audit/i,
    });
    expect(startBtn).toBeDisabled();
  });

  it('opens and closes the activeTab permission explainer modal', () => {
    render(
      <ScanControlBar
        tabId={10}
        targetUrl="https://example.com"
        connectionStatus="connected"
        eligibility={defaultEligibility}
        isPreparingScan={false}
        scanHandshakeMessage={null}
        errorMessage={null}
        onStartAudit={vi.fn()}
        onRefreshStatus={vi.fn()}
      />
    );

    const privacyBtn = screen.getByRole('button', {
      name: /activetab privacy/i,
    });
    fireEvent.click(privacyBtn);

    expect(
      screen.getByRole('dialog', { name: /privacy-first page access/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/user-gesture required/i)).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', {
      name: /close privacy dialog/i,
    });
    fireEvent.click(closeBtn);

    expect(
      screen.queryByRole('dialog', { name: /privacy-first page access/i })
    ).not.toBeInTheDocument();
  });

  it('renders ActiveTabExplainer standalone with understood button', () => {
    const handleClose = vi.fn();
    render(<ActiveTabExplainer isOpen={true} onClose={handleClose} />);

    expect(
      screen.getByRole('dialog', { name: /privacy-first page access/i })
    ).toBeInTheDocument();
    const understoodBtn = screen.getByRole('button', { name: /understood/i });
    fireEvent.click(understoodBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('supports Escape key dismissal and focus restoration to triggerRef (DEF-934 & DEF-935)', async () => {
    const handleClose = vi.fn();
    const triggerBtn = document.createElement('button');
    document.body.appendChild(triggerBtn);
    triggerBtn.focus();
    const triggerRef = { current: triggerBtn };

    const { unmount } = render(
      <ActiveTabExplainer isOpen={true} onClose={handleClose} triggerRef={triggerRef} />
    );

    // Test Escape key dismiss
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);

    // Unmount modal to trigger focus restoration
    unmount();
    expect(document.activeElement).toBe(triggerBtn);
    document.body.removeChild(triggerBtn);
  });

  it('traps Tab focus inside ActiveTabExplainer modal', () => {
    const handleClose = vi.fn();
    render(<ActiveTabExplainer isOpen={true} onClose={handleClose} />);

    const closeBtn = screen.getByRole('button', { name: /close privacy dialog/i });
    const understoodBtn = screen.getByRole('button', { name: /understood/i });

    // Focus last element and press Tab -> should wrap to first element
    understoodBtn.focus();
    expect(document.activeElement).toBe(understoodBtn);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(closeBtn);

    // Focus first element and press Shift+Tab -> should wrap to last element
    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(understoodBtn);
  });

  it('dismisses modal on backdrop click but preserves modal when clicking dialog panel', () => {
    const handleClose = vi.fn();
    render(<ActiveTabExplainer isOpen={true} onClose={handleClose} />);

    const presentationBackdrop = screen.getByRole('presentation');
    const dialog = screen.getByRole('dialog');

    // Click inside dialog panel -> should not dismiss
    fireEvent.click(dialog);
    expect(handleClose).not.toHaveBeenCalled();

    // Click backdrop -> should dismiss
    fireEvent.click(presentationBackdrop);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
