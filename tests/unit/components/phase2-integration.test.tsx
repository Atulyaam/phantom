import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import App from '@/entrypoints/dashboard/App';

describe('Phase 2 Integration & User Journey Tests', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('navigates the full inspection journey: map -> room -> finding inspector', async () => {
    // Launch directly in demo mode
    window.history.replaceState({}, '', '/?demo=1');

    await act(async () => {
      render(<App />);
    });

    // 1. Verify Demo Mode Banner is present
    expect(screen.getByText(/demonstration mode active/i)).toBeInTheDocument();

    // 2. Click room to open RoomDetailPanel
    const nameChamberBtn = screen.getByRole('button', {
      name: /the name chamber/i,
    });
    await act(async () => {
      fireEvent.click(nameChamberBtn);
    });

    // 3. Verify RoomDetailPanel opened with findings
    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: /the name chamber taxonomy inspector/i,
        })
      ).toBeInTheDocument();
      expect(screen.getByText(/buttons must have discernible text/i)).toBeInTheDocument();
    });

    // 4. Click Inspect on the first finding to open FindingInspector
    const inspectFindingBtn = screen.getAllByRole('button', {
      name: /^inspect$/i,
    })[0]!;
    await act(async () => {
      fireEvent.click(inspectFindingBtn);
    });

    // 5. Verify FindingInspector opened
    await waitFor(() => {
      expect(screen.getByText(/remediation guidance/i)).toBeInTheDocument();
      expect(screen.getByText(/axe-core rule documentation/i)).toBeInTheDocument();
    });

    // 6. Close FindingInspector
    const closeInspectorBtn = screen.getByRole('button', {
      name: /close finding inspector/i,
    });
    await act(async () => {
      fireEvent.click(closeInspectorBtn);
    });

    // 7. Verify we are back to the RoomDetailPanel
    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: /the name chamber taxonomy inspector/i,
        })
      ).toBeInTheDocument();
    });
  }, 30000);

  it('switches between Mansion Map and List View preserving room selection', async () => {
    await act(async () => {
      render(<App />);
    });

    // Select room in Mansion Map
    const contrastCryptBtn = screen.getByRole('button', {
      name: /the contrast crypt/i,
    });
    await act(async () => {
      fireEvent.click(contrastCryptBtn);
    });

    expect(
      screen.getByRole('heading', {
        name: /the contrast crypt taxonomy inspector/i,
      })
    ).toBeInTheDocument();

    // Switch to List View
    const listTab = screen.getByRole('button', { name: /list view/i });
    await act(async () => {
      fireEvent.click(listTab);
    });

    // Room inspector remains open
    expect(
      screen.getByRole('heading', {
        name: /the contrast crypt taxonomy inspector/i,
      })
    ).toBeInTheDocument();
  });

  it('toggles between Unscanned and Demo modes', async () => {
    await act(async () => {
      render(<App />);
    });

    // Initially in unscanned mode
    expect(screen.getByText('Dormant (Unscanned)')).toBeInTheDocument();

    // Activate Demo Mode
    const loadDemoBtn = screen.getByRole('button', {
      name: /load demo haunted findings/i,
    });
    await act(async () => {
      fireEvent.click(loadDemoBtn);
    });

    // Now in demo mode
    expect(screen.getByText('Haunted Demo (Mock Fixtures)')).toBeInTheDocument();
    expect(screen.getByText(/demonstration mode active/i)).toBeInTheDocument();

    // Switch back to unscanned
    const switchBackBtn = screen.getByRole('button', {
      name: /switch to unscanned state/i,
    });
    await act(async () => {
      fireEvent.click(switchBackBtn);
    });

    expect(screen.getByText('Dormant (Unscanned)')).toBeInTheDocument();
  });
});
