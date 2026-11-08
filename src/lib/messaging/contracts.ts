/**
 * Phantom Audit — Centralized Message Contracts (Zod-Validated)
 *
 * Defines strictly typed, validated request-response message contracts
 * crossing the Chromium extension boundary (Dashboard <-> Background Service Worker).
 */

import { z } from 'zod';
import { ScanRecordSchema } from '@/lib/validation/schemas';

export const UnsupportedReasonSchema = z.enum([
  'chrome-internal',
  'edge-internal',
  'browser-error',
  'about-page',
  'view-source',
  'web-store',
  'extension-internal',
  'data-url',
  'javascript-url',
  'file-scheme',
  'invalid-url',
  'tab-closed',
]);

export const TabEligibilitySchema = z.object({
  isEligible: z.boolean(),
  reason: UnsupportedReasonSchema.optional(),
  title: z.string(),
  guidance: z.string().optional(),
  normalizedUrl: z.string(),
});

export const TabMetadataSchema = z.object({
  tabId: z.number().int().positive(),
  url: z.string(),
  title: z.string().default(''),
  favIconUrl: z.string().optional(),
  isAlive: z.boolean(),
  eligibility: TabEligibilitySchema,
  lastUpdated: z.number().int().positive(),
});

export type TabMetadata = z.infer<typeof TabMetadataSchema>;

// ── Request Messages ──

export const PingRequestSchema = z.object({
  type: z.literal('PING'),
  requestId: z.string().min(1),
});

export const GetTabStatusRequestSchema = z.object({
  type: z.literal('GET_TAB_STATUS'),
  requestId: z.string().min(1),
  tabId: z.number().int().positive(),
});

export const StartScanRequestSchema = z.object({
  type: z.literal('START_SCAN_REQUEST'),
  requestId: z.string().min(1),
  tabId: z.number().int().positive(),
});

export const RequestMessageSchema = z.discriminatedUnion('type', [
  PingRequestSchema,
  GetTabStatusRequestSchema,
  StartScanRequestSchema,
]);

export type RequestMessage = z.infer<typeof RequestMessageSchema>;

// ── Response Messages ──

export const SuccessResponseSchema = z.object({
  success: z.literal(true),
  requestId: z.string().min(1),
});

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  requestId: z.string().min(1),
  error: z.string(),
  code: z.enum([
    'TAB_NOT_FOUND',
    'TAB_INELIGIBLE',
    'CONCURRENCY_LOCKED',
    'TIMEOUT',
    'UNKNOWN_ACTION',
    'VALIDATION_FAILED',
    'INTERNAL_ERROR',
    'INJECTION_FAILED',
    'SCAN_FAILED',
    'TAB_NAVIGATED',
    'UNAUTHORIZED_SENDER',
  ]),
});

export const PingResponseSchema = SuccessResponseSchema.extend({
  type: z.literal('PONG'),
  timestamp: z.number().int().positive(),
  version: z.string(),
});

export const TabStatusResponseSchema = SuccessResponseSchema.extend({
  type: z.literal('TAB_STATUS_RESPONSE'),
  tab: TabMetadataSchema.nullable(),
});

export const StartScanResponseSchema = SuccessResponseSchema.extend({
  type: z.literal('START_SCAN_RESPONSE'),
  tabId: z.number().int().positive(),
  status: z.enum(['completed', 'preparing', 'rejected', 'failed']),
  scanRecord: ScanRecordSchema.optional(),
  message: z.string(),
});

export const ResponseMessageSchema = z.discriminatedUnion('type', [
  PingResponseSchema,
  TabStatusResponseSchema,
  StartScanResponseSchema,
]);

export type PingResponse = z.infer<typeof PingResponseSchema>;
export type TabStatusResponse = z.infer<typeof TabStatusResponseSchema>;
export type StartScanResponse = z.infer<typeof StartScanResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ── Background Broadcast Events (Tabs -> Dashboard) ──

export const TabClosedEventSchema = z.object({
  type: z.literal('TAB_CLOSED_EVENT'),
  tabId: z.number().int().positive(),
  timestamp: z.number().int().positive(),
});

export const TabUpdatedEventSchema = z.object({
  type: z.literal('TAB_UPDATED_EVENT'),
  tabId: z.number().int().positive(),
  url: z.string(),
  title: z.string().default(''),
  eligibility: TabEligibilitySchema,
  timestamp: z.number().int().positive(),
});

export const ScanProgressEventSchema = z.object({
  type: z.literal('SCAN_PROGRESS_EVENT'),
  tabId: z.number().int().positive(),
  phase: z.enum([
    'idle',
    'validating',
    'injecting',
    'scanning',
    'processing',
    'completed',
    'failed',
    'timed_out',
  ]),
  message: z.string(),
  timestamp: z.number().int().positive(),
});

export const LifecycleEventSchema = z.discriminatedUnion('type', [
  TabClosedEventSchema,
  TabUpdatedEventSchema,
  ScanProgressEventSchema,
]);

export type TabClosedEvent = z.infer<typeof TabClosedEventSchema>;
export type TabUpdatedEvent = z.infer<typeof TabUpdatedEventSchema>;
export type ScanProgressEvent = z.infer<typeof ScanProgressEventSchema>;
export type LifecycleEvent = z.infer<typeof LifecycleEventSchema>;
