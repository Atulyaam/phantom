# Phase 3 — Extension Architecture & Runtime Audit

**Document Version:** 1.0.0  
**Phase:** 3 of 12 (Browser Extension Integration, Active-Tab Management & Runtime Communication)  
**Date:** 2026-11-06  
**Auditor:** Principal Extension Architect & Security Reviewer

---

## 1. Executive Summary

This architecture audit evaluates the Chromium Manifest V3 implementation of Phantom Audit, examining its service worker lifecycle, dashboard runtime, extension action configuration, inter-process messaging capabilities, and permission scope.

The audit establishes:

1. **Minimal Permission Posture:** The extension operates strictly within `activeTab`, `scripting`, and `storage`. No broad host permissions (`<all_urls>`, `*://*/*`) or unnecessary background permissions are requested.
2. **Ephemeral ActiveTab Binding:** Access to the user's inspected webpage is bound strictly to the explicit user gesture on the extension action, upholding Chrome Web Store security guidelines and user privacy.
3. **Target Tab State Isolation:** Target tabs are referenced by integer `tabId`. The extension architecture must track target tab closures (`tabs.onRemoved`) and origin/URL changes (`tabs.onUpdated`) to invalidate stale activeTab grants gracefully.
4. **Declarative Runtime Messaging:** Communication between the React dashboard tab and the background service worker requires structured, typed, and Zod-validated contracts with timeout and restart recovery.

---

## 2. Current Architecture vs Phase 3 Requirements

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        User Webpage (Active Tab)                       │
│  - Standard HTTP/HTTPS or restricted system page                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ User clicks extension icon
                                    │ (Gesture grants activeTab)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Background Service Worker (MV3)                      │
│  - Captures targetTabId, url, title via action.onClicked               │
│  - Runs URL Eligibility Engine (validates schemes & web stores)        │
│  - Opens / focuses Dashboard tab with validated query params           │
│  - Listens for tab lifecycle events (onRemoved, onUpdated)             │
│  - Responds to typed runtime messages from Dashboard                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                        browser.runtime.sendMessage
                          (Typed & Zod-Validated)
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Phantom Audit Dashboard (Extension Tab)              │
│  - Receives targetTabId context on mount                               │
│  - Verifies target tab liveness via handshake message                  │
│  - Displays target page status banner & ActiveTab privacy notice       │
│  - Renders interactive Haunted Mansion & standard table views          │
│  - Concurrency lock: prevents duplicate simultaneous scan requests     │
│  - Unscanned state preserved (axe-core deferred to Phase 4)             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component-by-Component Analysis

### 3.1 Background Service Worker (`src/entrypoints/background.ts`)

- **Current State:** Basic `action.onClicked` listener that reads `tab.id`, performs naive prefix checks, and opens `/dashboard.html` with query params.
- **Identified Gaps for Phase 3:**
  - Lacks structured request-response message router (`runtime.onMessage`).
  - URL classification uses naive string prefixes instead of robust URL parsing and host matching.
  - No tab lifecycle listeners (`tabs.onRemoved`, `tabs.onUpdated`) to alert the dashboard when a tab is closed or navigated.
  - Concurrency lock missing: multiple rapid clicks could attempt duplicate operations.
  - Ephemeral service worker shutdown could drop state if not backed by memory cache or session storage.

### 3.2 Dashboard Entrypoint (`src/entrypoints/dashboard/`)

- **Current State:** Parses URL search params (`tabId`, `url`, `title`, `unsupported`) on mount.
- **Identified Gaps for Phase 3:**
  - No live handshake with the background worker to verify whether the target tab is still open and alive.
  - Does not receive real-time tab closure or tab navigation events.
  - Lacks an explicit scan invocation bar ("Start Audit") with lifecycle state tracking (`idle` -> `preparing`).
  - ActiveTab privacy explanation is not surfaced prominently.

### 3.3 Permissions & Manifest (`wxt.config.ts` & generated `manifest.json`)

- **Permissions:** `["activeTab", "scripting", "storage"]`
- **Assessment:** Completely sufficient for Phases 1–3. No additional permissions are required. The `tabs` permission is deliberately avoided because `activeTab` provides tab details upon user invocation, preserving user trust.

### 3.4 Messaging Layer (`src/lib/messaging/`)

- **Current State:** Schemas exist in `src/lib/validation/schemas.ts`, but no dedicated messaging module with request/response wrappers, timeout handlers, and discriminated union schemas exists.
- **Required:** Centralized message client and schemas in `src/lib/messaging/` using Zod validation.

---

## 4. Phase 3 Engineering Action Plan

1. **Task 3.2 & 3.3:** Build robust `url-validator.ts` covering all Chrome/Edge schemes and Web Stores.
2. **Task 3.4 & 3.5 & 3.6:** Build centralized typed messaging contracts in `src/lib/messaging/contracts.ts` and client helper `src/lib/messaging/client.ts`.
3. **Task 3.7 & 3.8:** Implement full multi-tab state tracking and lifecycle listeners in `src/entrypoints/background.ts`.
4. **Task 3.9:** Build `ScanControlBar`, `ActiveTabExplainer`, and tab connection hook `useTargetTab` in dashboard.
5. **Task 3.10:** Add full unit, property, and Playwright E2E suites.
6. **Task 3.11 & 3.12:** Complete security review and audit sign-offs.
