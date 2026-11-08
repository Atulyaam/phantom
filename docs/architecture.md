# Phantom Audit — System Architecture

**Version:** 1.0.0 (Phase 1 Foundation)  
**Target Platform:** Chromium Manifest V3 (Chrome, Edge, Brave)  
**Primary Standards:** WCAG 2.2 AA (Target for product UI and scanner taxonomy)

---

## 1. Architectural Overview

Phantom Audit is structured as a privacy-first, local-first Chromium extension built with **WXT**, **React 19**, **TypeScript**, and **Tailwind CSS**. It eliminates reliance on external servers or cloud analytics by running audit engines and storing historical snapshots entirely inside the browser's local sandbox.

```text
+-----------------------------------------------------------------------+
|                            USER BROWSER                               |
|                                                                       |
|  [ Active Target Webpage ]                                            |
|         ^                                                             |
|         | Injects bundled axe.min.js via chrome.scripting             |
|         v                                                             |
|  [ Extension Service Worker ] (src/entrypoints/background.ts)         |
|         | Captures active tab metadata & opens dashboard              |
|         v                                                             |
|  [ Extension Dashboard ] (src/entrypoints/dashboard/)                 |
|         +---------------------------------------------------------+   |
|         | React 19 Application Shell                              |   |
|         |  - Mansion Map View (SVG 2D Interactive / Accessible)   |   |
|         |  - Findings List & Inspector                            |   |
|         |  - Scan Comparison & Before/After Engine                |   |
|         |  - Local Report Exporter (JSON / Redacted)              |   |
|         +---------------------------------------------------------+   |
|         | Domain & Core Logic (src/domain/, src/features/)        |   |
|         |  - Result Normalizer & Fingerprinting                   |   |
|         |  - Room Mapping Engine                                  |   |
|         |  - Local Storage Adapter (chrome.storage.local)         |   |
|         +---------------------------------------------------------+   |
+-----------------------------------------------------------------------+
```

---

## 2. Layered Module Responsibilities

The codebase enforces strict separation of concerns across the following layers:

### 2.1 Extension Runtime (`src/entrypoints/`)

- **`background.ts`**: Manifest V3 background service worker. Handles extension action clicks (`chrome.action.onClicked`), validates whether the active tab is scannable (filtering out `chrome://`, `edge://`, `about:`, Chrome Web Store), and opens or focuses the Phantom Audit dashboard tab with the target tab's ID.
- **`dashboard/`**: The primary full-tab React application. Renders the interactive haunted mansion, finding breakdowns, remediation guidance, and scan history.

### 2.2 Domain Models (`src/domain/`)

Pure TypeScript definitions, types, and domain entities with no browser or DOM dependencies:

- **`scan.ts`**: Types for `ScanRecord`, `ScanStatus`, `ScanScope`, and execution metadata.
- **`finding.ts`**: Types for `FindingRecord`, `FindingNode`, `Impact` (`critical`, `serious`, `moderate`, `minor`, `unknown`), and fingerprinting.
- **`room.ts`**: Definitions for the 7 mansion rooms (`name-chamber`, `contrast-crypt`, `portrait-gallery`, `form-cellar`, `structure-hall`, `focus-corridor`, `other`) and room states (`haunted`, `quiet`, `not-checked`, `manual-review`).
- **`report.ts`**: Types for `ScanComparison`, `ExportReportOptions`, and report payloads.

### 2.3 Data Validation (`src/lib/validation/`)

- Utilizes **Zod** to validate all data crossing boundaries (inter-process extension messaging, raw scanner output, and local storage). Ensures runtime type safety and defense against malformed or malicious inputs.

### 2.4 Browser Integration & Scanner Adapter (`src/features/scanner/`)

- Manages injection of the locally bundled `axe-core` script via `chrome.scripting.executeScript`.
- Wraps execution with a 15-second timeout, handles tab disconnection/navigation errors, and debounces concurrent scan requests.
- _Note: Full scanner implementation is scheduled for Phase 2; Phase 1 establishes the adapter contract and error state handling._

### 2.5 Result Normalization & Room Mapping (`src/features/normalization/`)

- Normalizes raw accessibility violations into stable `FindingRecord` instances.
- Computes deterministic SHA-256 / SHA-1 finding fingerprints using `ruleId` + canonical target selectors.
- Maps `ruleId`s deterministically to mansion rooms.

### 2.6 Local Persistence (`src/lib/storage/`)

- Wraps `chrome.storage.local` with type validation.
- Provides atomic operations to save, retrieve, list, and clear scan snapshots.
- Guarantees zero cloud leakage and empowers users with full data deletion controls.

### 2.7 Design Tokens & Accessible UI (`src/styles/`, `src/components/`)

- **Gothic Developer Palette**: Custom tokens for dark gothic atmosphere (`tokens.css`), meeting contrast requirements (minimum 4.5:1 for normal text, 3:1 for graphical UI elements).
- **Reduced Motion Support**: Automatic adherence to `@media (prefers-reduced-motion: reduce)` and manual user toggle.
- **Screen Reader Semantics**: ARIA live regions for scan updates, semantic landmarks, keyboard focus management.

---

## 3. Communication Boundaries & Message Contracts

Inter-module communication occurs strictly over typed message contracts:

| Message Type     | Sender    | Receiver             | Payload                                                  | Validation Schema           |
| ---------------- | --------- | -------------------- | -------------------------------------------------------- | --------------------------- |
| `START_SCAN`     | Dashboard | Background / Scanner | `{ tabId: number }`                                      | `StartScanMessageSchema`    |
| `SCAN_PROGRESS`  | Scanner   | Dashboard            | `{ scanId: string, stage: string, progress: number }`    | `ScanProgressMessageSchema` |
| `SCAN_COMPLETED` | Scanner   | Dashboard            | `ScanRecord`                                             | `ScanRecordSchema`          |
| `SCAN_FAILED`    | Scanner   | Dashboard            | `{ scanId: string, errorCode: string, message: string }` | `ScanFailedMessageSchema`   |

---

## 4. Security & Privacy Guarantees

1. **Zero Remote Scripts**: The extension contains all dependencies locally; no CDN scripts or remote code loaders are used.
2. **Untrusted DOM Excerpts**: HTML excerpts from target pages are treated as untrusted text, never parsed or inserted as raw HTML.
3. **Permission Minimization**: Only `activeTab`, `scripting`, and `storage` are declared. No broad host permissions (`*://*/*`) are used.
4. **Data Redaction**: Export functionality enables stripping URLs, query params, and code snippets before sharing.

---

## 5. Performance Strategy

- **Initial Load**: Lightweight dashboard shell bundles under 150 KB gzipped.
- **2D Vector Mansion**: SVG-based room visualization ensures responsive scaling and zero Three.js/WebGL overhead.
- **Efficient Diffing**: Set-based fingerprint comparison computes differences between scans in $O(N)$ time.
