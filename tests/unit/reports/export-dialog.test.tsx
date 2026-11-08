import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ScanRecord } from '@/domain/scan';
import { ExportReportDialog } from '@/features/reports/components/ExportReportDialog';
import * as htmlGenModule from '@/features/reports/html-generator';
import * as jsonRedactorModule from '@/features/reports/report-redactor';
import * as downloadModule from '@/features/reports/download-report';

const createMockScan = (overrides: Partial<ScanRecord> = {}): ScanRecord => ({
  id: '880e8400-e29b-41d4-a716-446655440000',
  schemaVersion: 1,
  tabUrl: 'https://haunted-manor.example.com:8443/ballroom?page=1',
  pageTitle: 'Haunted Ballroom',
  hostname: 'haunted-manor.example.com',
  scannedAt: '2026-10-31T20:00:00.000Z',
  completedAt: '2026-10-31T20:00:05.000Z',
  axeVersion: '4.14.0',
  extensionVersion: '0.1.0',
  browserName: 'chrome',
  status: 'completed',
  findings: [
    {
      fingerprint: 'fp-btn-1',
      ruleId: 'button-name',
      impact: 'critical',
      description: 'Button has no accessible name',
      help: 'Buttons must have discernible text',
      wcagTags: ['wcag2a'],
      roomId: 'name-chamber',
      affectedNodeCount: 1,
      nodes: [
        {
          target: ['button.spectral'],
          htmlExcerpt: '<button class="spectral"></button>',
          failureSummary: 'Missing name',
        },
      ],
      firstSeenAt: '2026-10-31T20:00:00.000Z',
      reviewed: false,
    },
  ],
  incompleteChecksCount: 0,
  passesCount: 10,
  inapplicableCount: 5,
  ...overrides,
});

describe('Phase 8 Workstream 4: ExportReportDialog UI & Interaction', () => {
  let downloadSpy: ReturnType<typeof vi.spyOn>;
  let htmlExportSpy: ReturnType<typeof vi.spyOn>;
  let jsonExportSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    downloadSpy = vi
      .spyOn(downloadModule, 'downloadReportBlob')
      .mockImplementation(() => {});
    htmlExportSpy = vi
      .spyOn(htmlGenModule, 'exportReportToHtml')
      .mockReturnValue('<!DOCTYPE html><html></html>');
    jsonExportSpy = vi
      .spyOn(jsonRedactorModule, 'exportReportToJson')
      .mockReturnValue('{"report": true}');
  });

  it('renders nothing when isOpen is false', () => {
    const scan = createMockScan();
    const { container } = render(
      <ExportReportDialog isOpen={false} onClose={vi.fn()} scan={scan} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders accessible modal dialog with headings, descriptions, and disclaimers', () => {
    const scan = createMockScan();
    render(<ExportReportDialog isOpen={true} onClose={vi.fn()} scan={scan} />);

    // Verify dialog semantics
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    // Title and target hostname
    expect(screen.getByText('Export Accessibility Report')).toBeDefined();
    expect(screen.getByText('haunted-manor.example.com')).toBeDefined();

    // Sections
    expect(screen.getByText('1. Report Format')).toBeDefined();
    expect(screen.getByText('2. Target URL Privacy Scope')).toBeDefined();
    expect(screen.getByText('3. Privacy & Content Options')).toBeDefined();

    // Security banner
    expect(screen.getByText('Automated Redaction Guarantee')).toBeDefined();
  });

  it('defaults to HTML format, Full Sanitized URL, Excerpts Omitted, and Remediation Included', () => {
    const scan = createMockScan();
    render(<ExportReportDialog isOpen={true} onClose={vi.fn()} scan={scan} />);

    // Format radio
    const htmlRadio = screen.getByLabelText(/HTML Document/i) as HTMLInputElement;
    const jsonRadio = screen.getByLabelText(/JSON Payload/i) as HTMLInputElement;
    expect(htmlRadio.checked).toBe(true);
    expect(jsonRadio.checked).toBe(false);

    // URL scope
    const fullRadio = screen.getByLabelText(/Full Sanitized URL/i) as HTMLInputElement;
    expect(fullRadio.checked).toBe(true);

    // Checkboxes
    const excerptCheck = screen.getByLabelText(
      /Include HTML DOM Excerpts/i
    ) as HTMLInputElement;
    const remediationCheck = screen.getByLabelText(
      /Include Remediation Code Guidance/i
    ) as HTMLInputElement;
    expect(excerptCheck.checked).toBe(false); // Omitted by default for privacy
    expect(remediationCheck.checked).toBe(true); // Included by default
  });

  it('updates live URL preview dynamically when URL scope radio changes', () => {
    const scan = createMockScan();
    render(<ExportReportDialog isOpen={true} onClose={vi.fn()} scan={scan} />);

    // Default Full Sanitized URL
    expect(
      screen.getByText(/haunted-manor\.example\.com:8443\/ballroom\?page=1/)
    ).toBeDefined();

    // Select Path Only
    const pathOnlyRadio = screen.getByLabelText(/Path Only/i);
    fireEvent.click(pathOnlyRadio);
    expect(screen.getByText(/haunted-manor\.example\.com:8443\/ballroom$/)).toBeDefined();

    // Select Hostname Only
    const hostOnlyRadio = screen.getByLabelText(/Hostname Only/i);
    fireEvent.click(hostOnlyRadio);
    expect(screen.getByText(/https:\/\/haunted-manor\.example\.com:8443$/)).toBeDefined();
  });

  it('closes dialog and calls onClose when Cancel or X button is clicked', () => {
    const onClose = vi.fn();
    const scan = createMockScan();
    render(<ExportReportDialog isOpen={true} onClose={onClose} scan={scan} />);

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelButton);
    expect(onClose).toHaveBeenCalledTimes(1);

    const closeButton = screen.getByLabelText('Close Export Dialog');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('closes dialog on Escape key press', () => {
    const onClose = vi.fn();
    const scan = createMockScan();
    render(<ExportReportDialog isOpen={true} onClose={onClose} scan={scan} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('restores focus to trigger element when dialog closes', () => {
    const triggerBtn = document.createElement('button');
    document.body.appendChild(triggerBtn);
    const triggerRef = { current: triggerBtn };

    const onClose = vi.fn();
    const scan = createMockScan();
    const { unmount } = render(
      <ExportReportDialog
        isOpen={true}
        onClose={onClose}
        scan={scan}
        triggerRef={triggerRef}
      />
    );

    const focusSpy = vi.spyOn(triggerBtn, 'focus');
    unmount();

    expect(focusSpy).toHaveBeenCalled();
    document.body.removeChild(triggerBtn);
  });

  it('executes HTML report export and triggers downloadReportBlob with html format', async () => {
    const onClose = vi.fn();
    const scan = createMockScan();
    render(<ExportReportDialog isOpen={true} onClose={onClose} scan={scan} />);

    const downloadBtn = screen.getByRole('button', { name: /Download HTML/i });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(htmlExportSpy).toHaveBeenCalledWith(
        scan,
        expect.objectContaining({
          format: 'html',
          urlRedactionLevel: 'full',
          includeHtmlExcerpts: false,
          includeRemediationGuidance: true,
        }),
        undefined
      );
      expect(downloadSpy).toHaveBeenCalledWith(
        '<!DOCTYPE html><html></html>',
        expect.stringMatching(
          /^phantom-audit-haunted-manor-example-com-\d{4}-\d{2}-\d{2}\.html$/
        ),
        'html'
      );
    });
  });

  it('executes JSON report export when JSON format is selected', async () => {
    const onClose = vi.fn();
    const scan = createMockScan();
    render(<ExportReportDialog isOpen={true} onClose={onClose} scan={scan} />);

    // Switch to JSON
    const jsonRadio = screen.getByLabelText(/JSON Payload/i);
    fireEvent.click(jsonRadio);

    const downloadBtn = screen.getByRole('button', { name: /Download JSON/i });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(jsonExportSpy).toHaveBeenCalledWith(
        scan,
        expect.objectContaining({
          format: 'json',
          urlRedactionLevel: 'full',
          includeHtmlExcerpts: false,
          includeRemediationGuidance: true,
        }),
        undefined
      );
      expect(downloadSpy).toHaveBeenCalledWith(
        '{"report": true}',
        expect.stringMatching(
          /^phantom-audit-haunted-manor-example-com-\d{4}-\d{2}-\d{2}\.json$/
        ),
        'json'
      );
    });
  });

  it('displays error alert if report generation throws', async () => {
    htmlExportSpy.mockImplementation(() => {
      throw new Error('Disk quota exceeded in Blob creation');
    });

    const scan = createMockScan();
    render(<ExportReportDialog isOpen={true} onClose={vi.fn()} scan={scan} />);

    const downloadBtn = screen.getByRole('button', { name: /Download HTML/i });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText('Disk quota exceeded in Blob creation')).toBeDefined();
    });
  });

  it('rejects exporting non-completed scans and surfaces a clear error (DEF-843)', async () => {
    const incompleteScan = createMockScan({ status: 'failed' });
    render(<ExportReportDialog isOpen={true} onClose={vi.fn()} scan={incompleteScan} />);

    const downloadBtn = screen.getByRole('button', { name: /Download HTML/i });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(
        screen.getByText('Only completed accessibility audits can be exported.')
      ).toBeDefined();
    });

    expect(htmlExportSpy).not.toHaveBeenCalled();
    expect(downloadSpy).not.toHaveBeenCalled();
  });

  it('drops concurrent re-entrant clicks when an export is already active (DEF-843)', async () => {
    // Artificial slow export
    htmlExportSpy.mockImplementation(() => {
      return 'slow-html';
    });

    const scan = createMockScan();
    render(<ExportReportDialog isOpen={true} onClose={vi.fn()} scan={scan} />);

    const downloadBtn = screen.getByRole('button', { name: /Download HTML/i });

    // Fire 3 clicks rapidly
    fireEvent.click(downloadBtn);
    fireEvent.click(downloadBtn);
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(htmlExportSpy).toHaveBeenCalledTimes(1);
      expect(downloadSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('resets privacy options to safe defaults when reopened (DEF-844)', async () => {
    const scan = createMockScan();
    const { rerender } = render(
      <ExportReportDialog isOpen={true} onClose={vi.fn()} scan={scan} />
    );

    // Auditor checks "Include Raw HTML Excerpts" and switches to JSON
    const excerptCheckbox = screen.getByLabelText(/Include HTML DOM Excerpts/i);
    fireEvent.click(excerptCheckbox);
    expect(excerptCheckbox).toBeChecked();

    const jsonRadio = screen.getByLabelText(/JSON Payload/i);
    fireEvent.click(jsonRadio);
    expect(jsonRadio).toBeChecked();

    // Close modal
    rerender(<ExportReportDialog isOpen={false} onClose={vi.fn()} scan={scan} />);

    // Reopen modal for a new audit or next inspection
    rerender(<ExportReportDialog isOpen={true} onClose={vi.fn()} scan={scan} />);

    // Verify excerpts are unchecked (privacy-safe default: false) and format is back to HTML
    const reopenedExcerptCheckbox = screen.getByLabelText(/Include HTML DOM Excerpts/i);
    expect(reopenedExcerptCheckbox).not.toBeChecked();

    const reopenedHtmlRadio = screen.getByLabelText(/HTML Document/i);
    expect(reopenedHtmlRadio).toBeChecked();
  });
});
