import { describe, it, expect, beforeEach } from 'vitest';
import {
  storageService,
  pruneRemediationRecords,
  RemediationQuotaExceededError,
  MAX_REMEDIATION_RECORDS,
  REMEDIATION_KEY,
} from '@/lib/storage';
import type {
  StoredRemediationRecord,
  RemediationStoragePayload,
} from '@/domain/remediation';
import type { ScanRecord } from '@/domain/scan';

describe('Remediation Persistence & Eviction Engine', () => {
  async function setRawStorage(key: string, value: unknown): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [key]: value });
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  beforeEach(async () => {
    await storageService.clearAllData();
  });

  describe('Basic CRUD Operations', () => {
    it('returns empty payload when no remediation records are saved', async () => {
      const records = await storageService.getRemediationRecords();
      expect(records).toEqual({});
    });

    it('persists and retrieves a validated remediation record', async () => {
      const record: StoredRemediationRecord = {
        fingerprint: 'v1:button-name:button#submit',
        status: 'suggested',
        updatedAt: '2026-11-06T18:00:00.000Z',
      };

      await storageService.saveRemediationRecord(record);

      const retrieved = await storageService.getRemediationRecord(
        'v1:button-name:button#submit'
      );
      expect(retrieved).toEqual(record);

      const all = await storageService.getRemediationRecords();
      expect(Object.keys(all)).toHaveLength(1);
      expect(all['v1:button-name:button#submit']).toEqual(record);
    });

    it('returns null for unrecorded or invalid fingerprints', async () => {
      expect(await storageService.getRemediationRecord('non-existent-fp')).toBeNull();
      // @ts-expect-error testing runtime edge cases
      expect(await storageService.getRemediationRecord(null)).toBeNull();
      expect(await storageService.getRemediationRecord('')).toBeNull();
    });

    it('updates remediation status and records attemptedAt timestamp', async () => {
      const fp = 'v1:label:input#email';
      const record1 = await storageService.updateRemediationStatus(fp, 'suggested');
      expect(record1.status).toBe('suggested');
      expect(record1.fingerprint).toBe(fp);

      const record2 = await storageService.updateRemediationStatus(fp, 'attempted', {
        notes: 'Wrapped in <label>',
      });
      expect(record2.status).toBe('attempted');
      expect(record2.attemptedAt).toBeDefined();
      expect(record2.notes).toBe('Wrapped in <label>');
    });

    it('attaches verifiedAtScanId when verified and clears it on regression', async () => {
      const fp = 'v1:color-contrast:p.subtitle';
      const scanId = '550e8400-e29b-41d4-a716-446655440000';

      const verifiedRecord = await storageService.updateRemediationStatus(
        fp,
        'verified',
        {
          verifiedAtScanId: scanId,
        }
      );
      expect(verifiedRecord.status).toBe('verified');
      expect(verifiedRecord.verifiedAtScanId).toBe(scanId);

      // Regression occurs: status transitions to unresolved -> scanId should be cleared
      const regressedRecord = await storageService.updateRemediationStatus(
        fp,
        'unresolved'
      );
      expect(regressedRecord.status).toBe('unresolved');
      expect(regressedRecord.verifiedAtScanId).toBeUndefined();
    });

    it('enforces notes length ceiling of 500 characters', async () => {
      const fp = 'v1:image-alt:img#hero';
      const longNote = 'a'.repeat(600);

      const record = await storageService.updateRemediationStatus(fp, 'suggested', {
        notes: longNote,
      });
      expect(record.notes?.length).toBe(500);
    });

    it('clears remediation data without touching scan history or preferences', async () => {
      // 1. Setup scan history and preferences
      const mockScan: ScanRecord = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        schemaVersion: 1,
        tabUrl: 'https://phantom.test',
        pageTitle: 'Test',
        hostname: 'phantom.test',
        scannedAt: new Date().toISOString(),
        axeVersion: '4.14.0',
        extensionVersion: '0.1.0',
        browserName: 'chrome',
        status: 'completed',
        findings: [],
        incompleteChecksCount: 0,
        passesCount: 10,
        inapplicableCount: 2,
      };
      await storageService.saveScan(mockScan);
      await storageService.savePreferences({
        reducedMotion: true,
        theme: 'high-contrast',
        redactExcerptsInExport: true,
      });

      // 2. Setup remediation record
      await storageService.updateRemediationStatus('v1:rule:target', 'attempted');
      expect(Object.keys(await storageService.getRemediationRecords())).toHaveLength(1);

      // 3. Clear remediation data only
      await storageService.clearRemediationData();

      // 4. Verify remediation data is wiped
      expect(await storageService.getRemediationRecords()).toEqual({});

      // 5. Verify scan history and preferences remain intact
      const history = await storageService.getScanHistory();
      expect(history).toHaveLength(1);
      expect(history[0]?.id).toBe(mockScan.id);

      const prefs = await storageService.getPreferences();
      expect(prefs.reducedMotion).toBe(true);
      expect(prefs.theme).toBe('high-contrast');
    });

    it('safely skips malformed or corrupt records in storage', async () => {
      // Simulate corrupt JSON in storage
      const corruptPayload = {
        'valid-fp': {
          fingerprint: 'valid-fp',
          status: 'suggested',
          updatedAt: '2026-11-06T18:00:00.000Z',
        },
        'corrupt-fp-1': {
          fingerprint: 'corrupt-fp-1',
          status: 'invalid-status', // Invalid status
          updatedAt: 'invalid-date',
        },
        'corrupt-fp-2': 'not-an-object',
      };

      await setRawStorage(REMEDIATION_KEY, corruptPayload);

      const records = await storageService.getRemediationRecords();
      expect(Object.keys(records)).toEqual(['valid-fp']);
      expect(records['valid-fp']?.status).toBe('suggested');
    });
  });

  describe('Storage Limits & Deterministic Eviction Policy', () => {
    it('does not evict when records are below or equal to limit', () => {
      const records: RemediationStoragePayload = {
        'fp-1': {
          fingerprint: 'fp-1',
          status: 'suggested',
          updatedAt: '2026-11-06T18:00:00.000Z',
        },
        'fp-2': {
          fingerprint: 'fp-2',
          status: 'attempted',
          updatedAt: '2026-11-06T18:05:00.000Z',
        },
      };

      const result = pruneRemediationRecords(records, 5);
      expect(result.evictedFingerprints).toEqual([]);
      expect(Object.keys(result.payload)).toHaveLength(2);
    });

    it('evicts oldest verified records first when over capacity', () => {
      const records: RemediationStoragePayload = {
        'verified-old': {
          fingerprint: 'verified-old',
          status: 'verified',
          updatedAt: '2026-11-06T10:00:00.000Z',
        },
        'verified-new': {
          fingerprint: 'verified-new',
          status: 'verified',
          updatedAt: '2026-11-06T15:00:00.000Z',
        },
        'active-unresolved': {
          fingerprint: 'active-unresolved',
          status: 'unresolved',
          updatedAt: '2026-11-06T09:00:00.000Z',
        },
      };

      // Limit to 2: excess is 1
      const result = pruneRemediationRecords(records, 2);
      expect(result.evictedFingerprints).toEqual(['verified-old']);
      expect(result.payload['verified-old']).toBeUndefined();
      expect(result.payload['verified-new']).toBeDefined();
      expect(result.payload['active-unresolved']).toBeDefined();
    });

    it('evicts oldest suggested records with no notes if verified pool is exhausted', () => {
      const records: RemediationStoragePayload = {
        'suggested-old-no-notes': {
          fingerprint: 'suggested-old-no-notes',
          status: 'suggested',
          updatedAt: '2026-11-06T11:00:00.000Z',
        },
        'suggested-new-no-notes': {
          fingerprint: 'suggested-new-no-notes',
          status: 'suggested',
          updatedAt: '2026-11-06T14:00:00.000Z',
        },
        'suggested-with-notes': {
          fingerprint: 'suggested-with-notes',
          status: 'suggested',
          updatedAt: '2026-11-06T08:00:00.000Z', // Oldest, but has notes!
          notes: 'Crucial developer note',
        },
        'active-attempted': {
          fingerprint: 'active-attempted',
          status: 'attempted',
          updatedAt: '2026-11-06T12:00:00.000Z',
        },
      };

      // Limit to 3: excess is 1
      const result = pruneRemediationRecords(records, 3);
      // 'suggested-old-no-notes' should be evicted, NOT 'suggested-with-notes'
      expect(result.evictedFingerprints).toEqual(['suggested-old-no-notes']);
      expect(result.payload['suggested-with-notes']).toBeDefined();
      expect(result.payload['active-attempted']).toBeDefined();
    });

    it('NEVER evicts active unresolved, attempted, or noted records', () => {
      const records: RemediationStoragePayload = {
        'unresolved-1': {
          fingerprint: 'unresolved-1',
          status: 'unresolved',
          updatedAt: '2026-11-06T01:00:00.000Z',
        },
        'attempted-1': {
          fingerprint: 'attempted-1',
          status: 'attempted',
          updatedAt: '2026-11-06T02:00:00.000Z',
        },
        'suggested-noted': {
          fingerprint: 'suggested-noted',
          status: 'suggested',
          updatedAt: '2026-11-06T03:00:00.000Z',
          notes: 'Do not lose this note',
        },
      };

      // Asking to prune 3 records down to 2 when all 3 are non-evictable must throw!
      expect(() => pruneRemediationRecords(records, 2)).toThrowError(
        RemediationQuotaExceededError
      );
    });

    it('automatically maintains the 200 record ceiling during save operations', async () => {
      // Pre-fill 200 verified records with valid ISO-8601 timestamps
      const initialRecords: RemediationStoragePayload = {};
      const baseTime = Date.UTC(2026, 10, 6, 12, 0, 0);
      for (let i = 0; i < MAX_REMEDIATION_RECORDS; i++) {
        const fp = `fp-verified-${i.toString().padStart(3, '0')}`;
        initialRecords[fp] = {
          fingerprint: fp,
          status: 'verified',
          updatedAt: new Date(baseTime + i * 1000).toISOString(),
        };
      }
      await setRawStorage(REMEDIATION_KEY, initialRecords);

      // Now save the 201st record
      const newRecord: StoredRemediationRecord = {
        fingerprint: 'fp-new-attempted',
        status: 'attempted',
        updatedAt: '2026-11-06T19:00:00.000Z',
      };
      await storageService.saveRemediationRecord(newRecord);

      const all = await storageService.getRemediationRecords();
      expect(Object.keys(all).length).toBe(MAX_REMEDIATION_RECORDS);
      // The new attempted record must be present
      expect(all['fp-new-attempted']).toBeDefined();
      // The oldest verified record (fp-verified-000) must have been evicted
      expect(all['fp-verified-000']).toBeUndefined();
    });
  });
});
