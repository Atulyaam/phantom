import { describe, it, expect, beforeEach } from 'vitest';
import { storageService, DEFAULT_PREFERENCES } from '@/lib/storage';
import type { ScanRecord } from '@/domain/scan';

describe('Storage Service', () => {
  beforeEach(async () => {
    await storageService.clearAllData();
  });

  it('returns default preferences when none are saved', async () => {
    const prefs = await storageService.getPreferences();
    expect(prefs).toEqual(DEFAULT_PREFERENCES);
  });

  it('saves and retrieves updated preferences', async () => {
    await storageService.savePreferences({
      reducedMotion: true,
      theme: 'high-contrast',
      redactExcerptsInExport: true,
    });

    const updated = await storageService.getPreferences();
    expect(updated.reducedMotion).toBe(true);
    expect(updated.theme).toBe('high-contrast');
    expect(updated.redactExcerptsInExport).toBe(true);
  });

  it('persists and retrieves valid scan history', async () => {
    const mockScan: ScanRecord = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      schemaVersion: 1,
      tabUrl: 'https://phantom-audit.test',
      pageTitle: 'Test Page',
      hostname: 'phantom-audit.test',
      scannedAt: new Date().toISOString(),
      axeVersion: '4.10.2',
      extensionVersion: '0.1.0',
      browserName: 'chrome',
      status: 'completed',
      findings: [],
      incompleteChecksCount: 0,
      passesCount: 15,
      inapplicableCount: 3,
    };

    await storageService.saveScan(mockScan);
    const history = await storageService.getScanHistory();
    expect(history.length).toBe(1);
    expect(history[0]?.id).toBe(mockScan.id);
  });

  it('deletes individual scans by ID', async () => {
    const scan1: ScanRecord = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      schemaVersion: 1,
      tabUrl: 'https://site-a.test',
      pageTitle: 'Site A',
      hostname: 'site-a.test',
      scannedAt: new Date().toISOString(),
      axeVersion: '4.10.2',
      extensionVersion: '0.1.0',
      browserName: 'chrome',
      status: 'completed',
      findings: [],
      incompleteChecksCount: 0,
      passesCount: 5,
      inapplicableCount: 1,
    };

    const scan2: ScanRecord = {
      ...scan1,
      id: '550e8400-e29b-41d4-a716-446655440002',
      tabUrl: 'https://site-b.test',
    };

    await storageService.saveScan(scan1);
    await storageService.saveScan(scan2);

    let history = await storageService.getScanHistory();
    expect(history.length).toBe(2);

    await storageService.deleteScan(scan1.id);
    history = await storageService.getScanHistory();
    expect(history.length).toBe(1);
    expect(history[0]?.id).toBe(scan2.id);
  });

  it('clears all preferences, scan history, and remediation data on clearAllData()', async () => {
    await storageService.savePreferences({
      reducedMotion: true,
      theme: 'high-contrast',
      redactExcerptsInExport: true,
    });
    await storageService.updateRemediationStatus('fp-test', 'attempted');

    await storageService.clearAllData();

    expect(await storageService.getPreferences()).toEqual(DEFAULT_PREFERENCES);
    expect(await storageService.getScanHistory()).toEqual([]);
    expect(await storageService.getRemediationRecords()).toEqual({});
  });
});
