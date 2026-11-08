import type { ScanRecord, ScanSummary } from '../../domain/scan';
import type {
  RemediationStatus,
  StoredRemediationRecord,
  RemediationStoragePayload,
} from '../../domain/remediation';
import {
  ScanRecordSchema,
  ScanSummarySchema,
  StoredRemediationRecordSchema,
} from '../validation/schemas';

export const SCAN_HISTORY_KEY = 'phantom_scan_history_v1';
export const SCAN_SUMMARIES_KEY = 'phantom_scan_summaries_v1';
export const PREFERENCES_KEY = 'phantom_user_preferences_v1';
export const REMEDIATION_KEY = 'phantom_remediation_v1';
export const MAX_SCAN_SNAPSHOTS = 50;
export const MAX_REMEDIATION_RECORDS = 200;

/**
 * Set of known sensitive query parameter keys representing credentials,
 * tokens, session identifiers, or authorization secrets.
 */
export const SENSITIVE_QUERY_KEYS = new Set([
  'token',
  'access_token',
  'id_token',
  'refresh_token',
  'jwt',
  'bearer',
  'auth',
  'authorization',
  'key',
  'apikey',
  'api_key',
  'secret',
  'client_secret',
  'password',
  'pass',
  'pwd',
  'session',
  'session_id',
  'sessionid',
  'sid',
  'code',
  'state',
  'signature',
  'sig',
  'credential',
  'credentials',
]);

/**
 * Determines whether a query parameter key contains sensitive or credential-bearing data.
 */
export function isSensitiveQueryParam(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const lower = key.trim().toLowerCase();

  let decoded = lower;
  try {
    decoded = decodeURIComponent(decoded).toLowerCase();
    if (decoded.includes('%')) {
      decoded = decodeURIComponent(decoded).toLowerCase();
    }
  } catch {
    // ignore malformed URI encoding
  }

  const check = (k: string) => {
    if (SENSITIVE_QUERY_KEYS.has(k)) return true;
    return (
      k.endsWith('_token') ||
      k.startsWith('token_') ||
      k.endsWith('-token') ||
      k.startsWith('token-') ||
      k.endsWith('_secret') ||
      k.startsWith('secret_') ||
      k.endsWith('_key') ||
      k.startsWith('api_') ||
      k.endsWith('_auth') ||
      k.startsWith('auth_') ||
      k.endsWith('_password') ||
      k.endsWith('pwd_')
    );
  };

  return check(lower) || check(decoded);
}

/**
 * Sanitizes a URL for safe local storage persistence:
 * 1. Strips credentials from userinfo (username:password@...).
 * 2. Strips sensitive query parameters (token, auth, password, etc.).
 * 3. Preserves non-sensitive functional query parameters (page, search, filter, lang, etc.).
 * 4. Preserves meaningful SPA route fragments (#/settings, #!/dashboard).
 * 5. Sanitizes query parameters embedded within SPA hash routes (e.g., #/route?token=xyz).
 *
 * Idempotency guaranteed: sanitizeUrlForStorage(sanitizeUrlForStorage(url)) === sanitizeUrlForStorage(url).
 */
export function sanitizeUrlForStorage(urlStr: string): string {
  if (!urlStr || typeof urlStr !== 'string') return '';
  const trimmed = urlStr.trim();

  try {
    const url = new URL(trimmed);

    // 1. Remove HTTP userinfo credentials (e.g. user:pass@host)
    url.username = '';
    url.password = '';

    // 2. Sanitize search query parameters
    if (url.search) {
      const searchParams = new URLSearchParams(url.search);
      const cleanSearchParams = new URLSearchParams();
      for (const [key, val] of searchParams.entries()) {
        if (!isSensitiveQueryParam(key)) {
          cleanSearchParams.append(key, val);
        }
      }
      url.search = cleanSearchParams.toString() ? `?${cleanSearchParams.toString()}` : '';
    }

    // 3. Sanitize hash fragments (handling both SPA route query params and OAuth hash tokens)
    if (url.hash) {
      if (url.hash.includes('?')) {
        const qIdx = url.hash.indexOf('?');
        const hashRoute = url.hash.slice(0, qIdx);
        const hashQuery = url.hash.slice(qIdx + 1);
        const hashParams = new URLSearchParams(hashQuery);
        const cleanHashParams = new URLSearchParams();
        for (const [key, val] of hashParams.entries()) {
          if (!isSensitiveQueryParam(key)) {
            cleanHashParams.append(key, val);
          }
        }
        const cleanHashQueryStr = cleanHashParams.toString();
        url.hash = cleanHashQueryStr ? `${hashRoute}?${cleanHashQueryStr}` : hashRoute;
      } else if (url.hash.includes('=')) {
        // OAuth2 implicit grant / OIDC hash fragment (e.g. #access_token=xyz&state=abc)
        const hashBody = url.hash.slice(1);
        const hashParams = new URLSearchParams(hashBody);
        const cleanHashParams = new URLSearchParams();
        let hasSensitive = false;
        for (const [key, val] of hashParams.entries()) {
          if (isSensitiveQueryParam(key)) {
            hasSensitive = true;
          } else {
            cleanHashParams.append(key, val);
          }
        }
        if (hasSensitive) {
          const cleanStr = cleanHashParams.toString();
          url.hash = cleanStr ? `#${cleanStr}` : '';
        }
      }
    }

    return url.toString();
  } catch {
    // If not a parseable URL, fallback regex cleanup
    return trimmed.replace(
      /([?&])(access_token|refresh_token|id_token|token|auth|key|apikey|api_key|secret|password|pwd|session|session_id|sid|code|state)=[^&#]*/gi,
      ''
    );
  }
}

/**
 * Computes a lightweight ScanSummary from a full ScanRecord.
 */
export function computeScanSummary(scan: ScanRecord): ScanSummary {
  let criticalCount = 0;
  let seriousCount = 0;
  let moderateCount = 0;
  let minorCount = 0;

  for (const f of scan.findings || []) {
    if (f.impact === 'critical') criticalCount++;
    else if (f.impact === 'serious') seriousCount++;
    else if (f.impact === 'moderate') moderateCount++;
    else if (f.impact === 'minor') minorCount++;
  }

  return {
    id: scan.id,
    schemaVersion: 1,
    tabUrl: sanitizeUrlForStorage(scan.tabUrl),
    pageTitle: scan.pageTitle,
    hostname: scan.hostname,
    scannedAt: scan.scannedAt,
    completedAt: scan.completedAt,
    status: scan.status,
    totalFindings: (scan.findings || []).length,
    criticalCount,
    seriousCount,
    moderateCount,
    minorCount,
    passesCount: scan.passesCount,
    incompleteChecksCount: scan.incompleteChecksCount,
  };
}

export class RemediationQuotaExceededError extends Error {
  constructor(
    message = 'Remediation storage quota (200 records) exceeded. Cannot safely evict active attempted or unresolved records.'
  ) {
    super(message);
    this.name = 'RemediationQuotaExceededError';
  }
}

export interface EvictionResult {
  payload: RemediationStoragePayload;
  evictedFingerprints: string[];
}

/**
 * Deterministically prunes remediation records down to the maximum storage limit.
 *
 * Eviction Priority:
 * 1. Oldest verified records (sorted by updatedAt ascending).
 * 2. Oldest suggested records that have NO user notes attached.
 *
 * Non-Evictable:
 * - Active unresolved records (unresolved findings or regressions).
 * - Active attempted records (in-flight fixes).
 * - Records with user notes attached.
 *
 * If capacity cannot safely be maintained, throws RemediationQuotaExceededError.
 */
export function pruneRemediationRecords(
  records: RemediationStoragePayload,
  limit = MAX_REMEDIATION_RECORDS
): EvictionResult {
  const entries = Object.entries(records);
  if (entries.length <= limit) {
    return { payload: { ...records }, evictedFingerprints: [] };
  }

  const excess = entries.length - limit;
  const evictedFingerprints: string[] = [];

  // Priority 1: Oldest verified records
  const verifiedCandidates = entries
    .filter(([_, rec]) => rec.status === 'verified')
    .sort(
      (a, b) =>
        (new Date(a[1].updatedAt).getTime() || 0) -
        (new Date(b[1].updatedAt).getTime() || 0)
    );

  for (const [fp] of verifiedCandidates) {
    if (evictedFingerprints.length < excess) {
      evictedFingerprints.push(fp);
    } else {
      break;
    }
  }

  // Priority 2: Oldest suggested records with no notes
  if (evictedFingerprints.length < excess) {
    const suggestedCandidates = entries
      .filter(
        ([fp, rec]) =>
          rec.status === 'suggested' &&
          (!rec.notes || rec.notes.trim() === '') &&
          !evictedFingerprints.includes(fp)
      )
      .sort(
        (a, b) =>
          (new Date(a[1].updatedAt).getTime() || 0) -
          (new Date(b[1].updatedAt).getTime() || 0)
      );

    for (const [fp] of suggestedCandidates) {
      if (evictedFingerprints.length < excess) {
        evictedFingerprints.push(fp);
      } else {
        break;
      }
    }
  }

  if (evictedFingerprints.length < excess) {
    throw new RemediationQuotaExceededError(
      `Remediation storage quota (${limit} records) exceeded. Cannot safely evict active attempted or unresolved records.`
    );
  }

  const prunedPayload: RemediationStoragePayload = {};
  for (const [fp, rec] of entries) {
    if (!evictedFingerprints.includes(fp)) {
      prunedPayload[fp] = rec;
    }
  }

  return {
    payload: prunedPayload,
    evictedFingerprints,
  };
}

export interface UserPreferences {
  reducedMotion: boolean;
  theme: 'gothic-dark' | 'high-contrast';
  redactExcerptsInExport: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  reducedMotion: false,
  theme: 'gothic-dark',
  redactExcerptsInExport: false,
};

export class StorageService {
  private writeLock: Promise<void> = Promise.resolve();

  private isExtensionEnv(): boolean {
    return (
      typeof chrome !== 'undefined' &&
      typeof chrome.storage !== 'undefined' &&
      typeof chrome.storage.local !== 'undefined'
    );
  }

  /**
   * Serializes write operations to prevent race conditions and concurrent write corruption.
   */
  private async withWriteLock<T>(op: () => Promise<T>): Promise<T> {
    const previousLock = this.writeLock;
    let resolveLock!: () => void;
    this.writeLock = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });

    try {
      await previousLock;
      return await op();
    } finally {
      resolveLock();
    }
  }

  async getPreferences(): Promise<UserPreferences> {
    if (!this.isExtensionEnv()) {
      const item = localStorage.getItem(PREFERENCES_KEY);
      return item ? (JSON.parse(item) as UserPreferences) : DEFAULT_PREFERENCES;
    }
    const result = await chrome.storage.local.get(PREFERENCES_KEY);
    return (result[PREFERENCES_KEY] as UserPreferences) || DEFAULT_PREFERENCES;
  }

  async savePreferences(prefs: UserPreferences): Promise<void> {
    if (!this.isExtensionEnv()) {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
      return;
    }
    await chrome.storage.local.set({ [PREFERENCES_KEY]: prefs });
  }

  /**
   * Retrieves all full ScanRecords from local storage.
   * Corrupted or invalid items are safely filtered out.
   */
  async getScanHistory(): Promise<ScanRecord[]> {
    let raw: unknown[];
    try {
      if (!this.isExtensionEnv()) {
        const item = localStorage.getItem(SCAN_HISTORY_KEY);
        raw = item ? JSON.parse(item) : [];
      } else {
        const result = await chrome.storage.local.get(SCAN_HISTORY_KEY);
        raw = result[SCAN_HISTORY_KEY] || [];
      }
    } catch {
      return [];
    }

    if (!Array.isArray(raw)) return [];
    const validScans: ScanRecord[] = [];
    for (const item of raw) {
      const parsed = ScanRecordSchema.safeParse(item);
      if (parsed.success) {
        validScans.push(parsed.data as ScanRecord);
      }
    }
    return validScans;
  }

  /**
   * Retrieves lightweight ScanSummary items for fast history listing without loading full node graphs.
   * If the summary index is missing, it is dynamically computed and backfilled from scan history.
   */
  async getScanSummaries(): Promise<ScanSummary[]> {
    let raw: unknown[];
    try {
      if (!this.isExtensionEnv()) {
        const item = localStorage.getItem(SCAN_SUMMARIES_KEY);
        raw = item ? JSON.parse(item) : [];
      } else {
        const result = await chrome.storage.local.get(SCAN_SUMMARIES_KEY);
        raw = result[SCAN_SUMMARIES_KEY] || [];
      }
    } catch {
      raw = [];
    }

    if (Array.isArray(raw) && raw.length > 0) {
      const validSummaries: ScanSummary[] = [];
      for (const item of raw) {
        const parsed = ScanSummarySchema.safeParse(item);
        if (parsed.success) {
          validSummaries.push(parsed.data as ScanSummary);
        }
      }
      if (validSummaries.length > 0) {
        return validSummaries;
      }
    }

    // Dynamic backfill from full scan history if summary cache is empty/absent
    const fullScans = await this.getScanHistory();
    const derivedSummaries = fullScans.map(computeScanSummary);
    if (derivedSummaries.length > 0) {
      try {
        if (!this.isExtensionEnv()) {
          localStorage.setItem(SCAN_SUMMARIES_KEY, JSON.stringify(derivedSummaries));
        } else {
          await chrome.storage.local.set({
            [SCAN_SUMMARIES_KEY]: derivedSummaries,
          });
        }
      } catch {
        // Tolerable cache write failure; return in-memory derived summaries
      }
    }
    return derivedSummaries;
  }

  /**
   * Retrieves a single ScanRecord snapshot by UUID, or null if not found.
   */
  async getScanById(scanId: string): Promise<ScanRecord | null> {
    if (!scanId || typeof scanId !== 'string') return null;
    const history = await this.getScanHistory();
    return history.find((s) => s.id === scanId) || null;
  }

  /**
   * Verifies whether a specific scan snapshot exists in local storage.
   */
  async hasScan(scanId: string): Promise<boolean> {
    if (!scanId || typeof scanId !== 'string') return false;
    const scan = await this.getScanById(scanId);
    return scan !== null;
  }

  /**
   * Persists a full ScanRecord snapshot and updates the lightweight summary index.
   * - Sanitizes sensitive URL parameters (tokens, credentials, etc.).
   * - Applies a strict FIFO ceiling of 50 snapshots.
   * - Ensures atomic, serialized write operations.
   */
  async saveScan(scan: ScanRecord): Promise<void> {
    return this.withWriteLock(async () => {
      const validated = ScanRecordSchema.parse(scan);
      const sanitizedUrl = sanitizeUrlForStorage(validated.tabUrl);
      const sanitizedScan: ScanRecord = {
        ...validated,
        tabUrl: sanitizedUrl,
      };

      const summary = computeScanSummary(sanitizedScan);

      const existingScans = await this.getScanHistory();
      const updatedScans = [
        sanitizedScan,
        ...existingScans.filter((s) => s.id !== sanitizedScan.id),
      ].slice(0, MAX_SCAN_SNAPSHOTS);

      const existingSummaries = await this.getScanSummaries();
      const updatedSummaries = [
        summary,
        ...existingSummaries.filter((s) => s.id !== summary.id),
      ].slice(0, MAX_SCAN_SNAPSHOTS);

      if (!this.isExtensionEnv()) {
        const prevScans = localStorage.getItem(SCAN_HISTORY_KEY);
        const prevSummaries = localStorage.getItem(SCAN_SUMMARIES_KEY);
        try {
          localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(updatedScans));
          localStorage.setItem(SCAN_SUMMARIES_KEY, JSON.stringify(updatedSummaries));
        } catch (err) {
          // Rollback to prior state if writing failed to preserve consistency
          if (prevScans !== null) {
            localStorage.setItem(SCAN_HISTORY_KEY, prevScans);
          } else {
            localStorage.removeItem(SCAN_HISTORY_KEY);
          }
          if (prevSummaries !== null) {
            localStorage.setItem(SCAN_SUMMARIES_KEY, prevSummaries);
          } else {
            localStorage.removeItem(SCAN_SUMMARIES_KEY);
          }
          throw err;
        }
        return;
      }

      await chrome.storage.local.set({
        [SCAN_HISTORY_KEY]: updatedScans,
        [SCAN_SUMMARIES_KEY]: updatedSummaries,
      });
    });
  }

  /**
   * Deletes an individual scan snapshot by ID and updates the summary index.
   */
  async deleteScan(scanId: string): Promise<void> {
    if (!scanId || typeof scanId !== 'string') return;
    return this.withWriteLock(async () => {
      const existingScans = await this.getScanHistory();
      const filteredScans = existingScans.filter((s) => s.id !== scanId);

      const existingSummaries = await this.getScanSummaries();
      const filteredSummaries = existingSummaries.filter((s) => s.id !== scanId);

      if (!this.isExtensionEnv()) {
        const prevScans = localStorage.getItem(SCAN_HISTORY_KEY);
        const prevSummaries = localStorage.getItem(SCAN_SUMMARIES_KEY);
        try {
          localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(filteredScans));
          localStorage.setItem(SCAN_SUMMARIES_KEY, JSON.stringify(filteredSummaries));
        } catch (err) {
          if (prevScans !== null) {
            localStorage.setItem(SCAN_HISTORY_KEY, prevScans);
          } else {
            localStorage.removeItem(SCAN_HISTORY_KEY);
          }
          if (prevSummaries !== null) {
            localStorage.setItem(SCAN_SUMMARIES_KEY, prevSummaries);
          } else {
            localStorage.removeItem(SCAN_SUMMARIES_KEY);
          }
          throw err;
        }
        return;
      }

      await chrome.storage.local.set({
        [SCAN_HISTORY_KEY]: filteredScans,
        [SCAN_SUMMARIES_KEY]: filteredSummaries,
      });
    });
  }

  /**
   * Clears only scan history snapshots and summaries, preserving user preferences
   * and Phase 6 remediation verification data.
   */
  async clearScanHistory(): Promise<void> {
    return this.withWriteLock(async () => {
      if (!this.isExtensionEnv()) {
        localStorage.removeItem(SCAN_HISTORY_KEY);
        localStorage.removeItem(SCAN_SUMMARIES_KEY);
        return;
      }
      await chrome.storage.local.remove([SCAN_HISTORY_KEY, SCAN_SUMMARIES_KEY]);
    });
  }

  /**
   * Alias for clearScanHistory, guaranteeing total purge of snapshot history and summaries.
   */
  async clearAllScans(): Promise<void> {
    return this.clearScanHistory();
  }

  /**
   * Retrieves all stored remediation records.
   * Corrupted or invalid records are safely omitted without crashing the dashboard.
   */
  async getRemediationRecords(): Promise<RemediationStoragePayload> {
    let raw: unknown = null;
    try {
      if (!this.isExtensionEnv()) {
        const item = localStorage.getItem(REMEDIATION_KEY);
        raw = item ? JSON.parse(item) : {};
      } else {
        const result = await chrome.storage.local.get(REMEDIATION_KEY);
        raw = result[REMEDIATION_KEY] || {};
      }
    } catch {
      return {};
    }

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return {};
    }

    const validPayload: RemediationStoragePayload = {};
    for (const [fp, item] of Object.entries(raw as Record<string, unknown>)) {
      const parsed = StoredRemediationRecordSchema.safeParse(item);
      if (parsed.success && parsed.data.fingerprint === fp) {
        validPayload[fp] = parsed.data as StoredRemediationRecord;
      }
    }

    return validPayload;
  }

  /**
   * Retrieves a single remediation record by finding fingerprint, or null if untracked.
   */
  async getRemediationRecord(
    fingerprint: string
  ): Promise<StoredRemediationRecord | null> {
    if (!fingerprint || typeof fingerprint !== 'string') return null;
    const records = await this.getRemediationRecords();
    return records[fingerprint] || null;
  }

  /**
   * Persists a validated remediation record.
   * Automatically invokes the deterministic eviction policy to preserve the 200-record quota.
   */
  async saveRemediationRecord(record: StoredRemediationRecord): Promise<void> {
    const validated = StoredRemediationRecordSchema.parse(record);
    const existing = await this.getRemediationRecords();

    const updatedMap: RemediationStoragePayload = {
      ...existing,
      [validated.fingerprint]: validated,
    };

    // Enforce 200 record ceiling using deterministic eviction
    const pruned = pruneRemediationRecords(updatedMap, MAX_REMEDIATION_RECORDS);

    if (!this.isExtensionEnv()) {
      localStorage.setItem(REMEDIATION_KEY, JSON.stringify(pruned.payload));
      return;
    }
    await chrome.storage.local.set({ [REMEDIATION_KEY]: pruned.payload });
  }

  /**
   * Updates or creates a remediation status for a finding fingerprint.
   */
  async updateRemediationStatus(
    fingerprint: string,
    status: RemediationStatus,
    options?: {
      attemptedAt?: string;
      verifiedAtScanId?: string;
      previouslyVerifiedAtScanId?: string;
      regressionDetectedAt?: string;
      isRegression?: boolean;
      notes?: string;
    }
  ): Promise<StoredRemediationRecord> {
    if (!fingerprint || typeof fingerprint !== 'string') {
      throw new Error('Valid fingerprint is required to update remediation status.');
    }

    const existing = await this.getRemediationRecord(fingerprint);
    const now = new Date().toISOString();

    let cleanNotes =
      options?.notes !== undefined ? options.notes.trim() : existing?.notes;
    if (cleanNotes && cleanNotes.length > 500) {
      cleanNotes = cleanNotes.slice(0, 500);
    }

    const wasVerified = existing?.status === 'verified';
    const isRegression =
      options?.isRegression !== undefined
        ? options.isRegression
        : wasVerified && status === 'unresolved';

    const previouslyVerifiedAtScanId =
      options?.previouslyVerifiedAtScanId ||
      (wasVerified && status !== 'verified'
        ? existing?.verifiedAtScanId
        : existing?.previouslyVerifiedAtScanId);

    const regressionDetectedAt =
      options?.regressionDetectedAt ||
      (isRegression ? existing?.regressionDetectedAt || now : undefined);

    const record: StoredRemediationRecord = {
      fingerprint,
      status,
      updatedAt: now,
      attemptedAt:
        status === 'attempted'
          ? options?.attemptedAt || existing?.attemptedAt || now
          : (options?.attemptedAt ?? existing?.attemptedAt),
      verifiedAtScanId:
        status === 'verified'
          ? options?.verifiedAtScanId || existing?.verifiedAtScanId
          : undefined,
      previouslyVerifiedAtScanId,
      regressionDetectedAt,
      isRegression: isRegression || undefined,
      notes: cleanNotes || undefined,
    };

    await this.saveRemediationRecord(record);
    return record;
  }

  /**
   * Clears only remediation tracking data while preserving scan history and user preferences.
   */
  async clearRemediationData(): Promise<void> {
    return this.withWriteLock(async () => {
      if (!this.isExtensionEnv()) {
        localStorage.removeItem(REMEDIATION_KEY);
        return;
      }
      await chrome.storage.local.remove(REMEDIATION_KEY);
    });
  }

  async clearAllData(): Promise<void> {
    return this.withWriteLock(async () => {
      if (!this.isExtensionEnv()) {
        localStorage.removeItem(SCAN_HISTORY_KEY);
        localStorage.removeItem(SCAN_SUMMARIES_KEY);
        localStorage.removeItem(PREFERENCES_KEY);
        localStorage.removeItem(REMEDIATION_KEY);
        return;
      }
      await chrome.storage.local.remove([
        SCAN_HISTORY_KEY,
        SCAN_SUMMARIES_KEY,
        PREFERENCES_KEY,
        REMEDIATION_KEY,
      ]);
    });
  }
}

export const storageService = new StorageService();
