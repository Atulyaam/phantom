# Phantom Audit — Complete Product & Engineering Specification

**Kiroween 2026 | Costume Contest | Solo-developer build plan**  
**Document status:** Implementation-ready product specification  
**Project type:** Chromium browser extension + local-first accessibility audit experience  
**Primary audience:** Frontend developers, web designers, QA engineers, indie makers and small web teams  
**Primary standard:** WCAG 2.2, with automated findings mapped to the rules supported by the selected axe-core release  
**MVP target:** A user-initiated scan of the currently active web page, presented through an accessible haunted-mansion interface, with actionable findings and before/after rescans.

> **Product promise:** Phantom Audit turns accessibility problems into rooms in a haunted mansion. Each ghost represents a real, inspectable accessibility finding. Fix the issue in your website, rescan, and watch that room become clear.

---

## 0. Executive summary

Phantom Audit is a browser extension that helps developers discover and understand common accessibility problems on the web page they are currently viewing. The user explicitly starts a scan. The extension runs a locally bundled version of axe-core against the page's current DOM, normalizes the results, and presents them in a themed dashboard.

The dashboard visualizes issue groups as rooms in a haunted mansion:

- **The Name Chamber:** missing or invalid accessible names.
- **The Contrast Crypt:** text and interface contrast findings.
- **The Portrait Gallery:** image and alternative-text findings.
- **The Form Cellar:** form labels and control relationships.
- **The Structure Hall:** headings, landmarks and document structure.
- **The Focus Corridor:** focus and interaction-related findings that the automated rules can detect, with manual checks clearly identified as manual.

A user can inspect the exact affected element, understand why the rule matters, see a suggested correction, apply the correction in their own code or page editor, and run another scan. Phantom Audit compares two scans and shows which findings disappeared, remain or newly appeared.

### 0.1 Product differentiation

Accessibility scanners already exist. Phantom Audit does **not** claim to invent accessibility scanning or replace established tools such as axe DevTools or WAVE. Its distinctive contribution is the combination of:

1. A carefully scoped, privacy-first browser extension.
2. A playful but usable haunted-mansion information architecture.
3. A direct connection between each visual room, a real axe-core finding and the affected DOM element.
4. Human-readable remediation guidance with copyable examples.
5. Before/after rescans that make progress immediately visible.
6. An accessibility-first horror interface: reduced motion, keyboard operation, screen-reader labels and strong contrast are built in.

### 0.2 MVP definition

The MVP is complete when a user can:

1. Install the unpacked Chromium extension.
2. Open a normal web page and explicitly invoke Phantom Audit.
3. Run a scan of the current page's DOM.
4. See a summary and haunted-mansion room map.
5. Open a finding and inspect its rule, impact, explanation, affected element and suggested fix.
6. Apply a fix in the website's source or editing environment.
7. Rescan the page and compare results.
8. Export a local report.

The extension must not claim that an automated scan certifies a website as WCAG conformant.

---

## 1. Problem statement

Developers often know that accessibility matters but struggle to identify, prioritize and understand individual problems. Existing audit output can be technically accurate yet intimidating to beginners. A list of rule IDs and CSS selectors does not always explain what a person should fix or why.

Phantom Audit makes the audit easier to understand without hiding the underlying technical evidence. It transforms the findings into a memorable navigation model while keeping the original rule ID, impact, help URL, HTML excerpt and selector available.

### 1.1 Target users

| Persona | Need | How Phantom Audit helps |
|---|---|---|
| Frontend developer | Quickly identify and fix common accessibility defects | Scan, inspect DOM target, read fix guidance and rescan |
| UI/UX designer | Understand design-related barriers | Visual grouping for contrast, names, forms and structure |
| QA engineer | Capture repeatable evidence before and after a change | Local scan history and comparison reports |
| Student / beginner | Learn why a page is difficult to use | Plain-language explanations and practical examples |
| Indie maker | Run a quick local audit without setting up a backend | User-initiated browser scan with local processing |

### 1.2 Jobs to be done

- “When I open a page I am building, I want to run an accessibility scan without configuring a separate testing project.”
- “When the scanner finds a problem, I want to know exactly which element is affected and what I should change.”
- “After I fix the problem, I want to rescan and see whether it is actually resolved.”
- “I want a report I can share with a teammate without silently uploading the page's content to a third party.”

### 1.3 Non-goals

The hackathon MVP will **not**:

- Certify WCAG 2.2 A, AA or AAA conformance.
- Claim to detect every accessibility barrier.
- Replace manual keyboard, screen-reader, cognitive or user testing.
- Automatically rewrite or repair a website's source code.
- Crawl an entire domain or scan every route.
- Run scans continuously in the background.
- Upload page HTML, text, form values or reports to a cloud service by default.
- Promise complete inspection of cross-origin iframes, browser-internal pages, closed shadow roots or content that is not present in the current DOM.
- Use a 3D game engine in the MVP. The mansion should be a fast, accessible 2D/SVG/CSS visualization.

---

## 2. Product principles

1. **Real findings first:** every ghost must correspond to a real scanner result or be explicitly marked as a manual checklist item.
2. **Evidence stays visible:** never hide the axe rule ID, severity/impact, selector or original help reference behind the theme.
3. **No false compliance claims:** a clean automated scan means no findings were detected by the enabled automated rules in the scanned state; it does not prove conformance.
4. **Privacy by default:** the page is scanned locally. No page content is transmitted to an API in the MVP.
5. **Accessibility of the auditor:** the interface must itself be keyboard accessible, screen-reader understandable and usable with reduced motion.
6. **Useful before beautiful:** the scanner, finding details and rescan workflow must work before advanced visual effects are added.
7. **A small scope that works:** scan one active page, not an entire site.

---

## 3. User experience and information architecture

### 3.1 Primary user journey

1. User installs Phantom Audit.
2. User visits a web page they are permitted to inspect.
3. User clicks the extension icon.
4. Phantom Audit opens its dashboard and explains that it will scan the active tab.
5. User presses **Scan this page**.
6. The extension injects its locally bundled axe-core script into the active tab using the temporary permission granted by the user's action.
7. Scan progress is shown.
8. Results are normalized and displayed as a summary plus mansion map.
9. User selects a room and then a finding.
10. The finding detail shows a plain-language explanation, impact, rule ID, target selector, safe HTML excerpt and suggested remediation.
11. User fixes the site in its own editor or development environment.
12. User returns to Phantom Audit and presses **Rescan**.
13. The dashboard compares the new scan with the previous scan.
14. User exports a report if required.

### 3.2 Main screens

| Screen | Purpose | Essential components |
|---|---|---|
| Welcome / onboarding | Explain scope and privacy | What it scans, what it cannot prove, local-processing notice |
| Scan dashboard | Start and monitor scan | Active page identity, Scan button, progress, error state |
| Mansion overview | Visual summary | Rooms, issue counts, severity indicators, clear-room state |
| Room details | Filter findings by issue family | Finding cards, severity, rule IDs |
| Finding inspector | Help user fix an issue | Plain-language summary, why it matters, affected element, selector, snippet, fix example, source link |
| Scan comparison | Show progress | Resolved, unchanged and new findings |
| History | Reopen previous local scans | Date, host, page title, scan status, delete action |
| Settings | Control privacy and presentation | Reduced motion, theme, local history, clear data, report redaction |
| About / limitations | Explain methodology | axe-core attribution, WCAG mapping, limitations and manual-check guidance |

### 3.3 Haunted mansion mapping

The mansion is a navigation metaphor, not a replacement for the findings list. Users must be able to use either the room map or a conventional list/table.

| Room | Finding family | Example |
|---|---|---|
| Name Chamber | Accessible names and labels | Button has no accessible name |
| Contrast Crypt | Contrast | Text contrast below configured threshold |
| Portrait Gallery | Images and media alternatives | Image has missing/empty or inappropriate alternative text where detected |
| Form Cellar | Form controls and labels | Input has no associated label |
| Structure Hall | Landmarks, headings and document structure | Invalid or missing structure detected by enabled rules |
| Focus Corridor | Focus/interaction rules | Automated focus-related rule findings, where applicable |
| Unknown / Other | Findings that do not fit a room | A future axe rule not mapped yet |

A finding may belong to more than one conceptual category. The implementation must define one deterministic primary room for navigation and retain the original rule ID as the source of truth.

### 3.4 Room states

- **Haunted:** one or more findings mapped to the room.
- **Quiet:** no findings detected by the enabled rules for that room in this scan.
- **Not checked:** scan did not complete or the rule was not run.
- **Manual review:** an issue needs human evaluation and cannot be concluded from automation alone.

Do not label a room “accessible” or “WCAG compliant” merely because it has zero automated findings.

### 3.5 Interface accessibility requirements

The product itself must target WCAG 2.2 AA as a design and testing goal, without claiming a formal conformance certification.

- Every control has a programmatic accessible name.
- Full keyboard operation; no keyboard traps.
- Visible focus indicators.
- Text and controls use adequate contrast.
- Status changes are announced with appropriate live regions without overwhelming assistive technology.
- No meaning is conveyed by colour or animation alone.
- All animations can be disabled; respect `prefers-reduced-motion`.
- Provide a conventional findings list as an alternative to the mansion map.
- Use semantic headings, landmarks, buttons and lists.
- Avoid flashing effects, rapid movement and parallax.
- Make text zoom/reflow usable at 200% and test narrow windows.
- The haunted theme must not use illegible fonts for functional content. Decorative fonts may be limited to short headings and must not replace readable text.

---

## 4. Functional requirements

Priority labels: **P0 = mandatory MVP**, **P1 = important**, **P2 = stretch**.

### 4.1 Extension installation and invocation

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---:|---|
| FR-001 | Package as a Chromium Manifest V3 extension | P0 | Loads unpacked in current Chrome and Edge desktop builds |
| FR-002 | Invoke scan only after an explicit user action | P0 | No automatic scan on page load or background crawling |
| FR-003 | Use minimal permissions | P0 | MVP requests `activeTab`, `scripting` and `storage` only where required |
| FR-004 | Explain temporary page access | P0 | Onboarding explains scan is restricted to the active page after user invocation |
| FR-005 | Reject unsupported pages gracefully | P0 | Browser-internal pages, extension pages, Chrome Web Store and inaccessible targets show a helpful message |
| FR-006 | Preserve the target tab identity | P0 | Dashboard scans the tab the user invoked the extension on, not the dashboard tab |

### 4.2 Scanning engine

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---:|---|
| FR-010 | Bundle axe-core locally | P0 | Scan does not fetch executable scanner code from a remote CDN |
| FR-011 | Run axe-core against current page DOM | P0 | Results include violations, incomplete checks and pass counts exposed by axe-core |
| FR-012 | Show scan lifecycle | P0 | Idle, preparing, scanning, completed, failed and cancelled states are represented |
| FR-013 | Handle scan timeout | P1 | Long-running scans stop or fail gracefully with a retry path |
| FR-014 | Prevent duplicate scan requests | P0 | Multiple rapid clicks do not run concurrent scans for the same tab |
| FR-015 | Support a rescan | P0 | User can run a new scan on the current page after changing it |
| FR-016 | Identify scan scope | P0 | Report records current URL, page title, timestamp, browser and scanner version where available |
| FR-017 | Preserve incomplete/needs-review results | P1 | Inconclusive axe checks are not silently reclassified as passes or violations |

### 4.3 Findings and classification

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---:|---|
| FR-020 | Normalize axe results into a stable internal schema | P0 | UI is not coupled directly to arbitrary raw axe response fields |
| FR-021 | Show impact | P0 | Critical, serious, moderate, minor or unknown impact is displayed when provided by axe-core |
| FR-022 | Show rule metadata | P0 | Every finding shows rule ID, description, help text and help URL where provided |
| FR-023 | Show affected DOM targets | P0 | Each node shows CSS selector target and a length-limited HTML excerpt |
| FR-024 | Map findings to mansion rooms | P0 | Known rule IDs map deterministically; unmapped rules go to Other |
| FR-025 | Filter and sort findings | P1 | User can filter by impact, room, rule and status |
| FR-026 | Display incomplete checks separately | P1 | “Needs review” is visually distinct from confirmed violations |
| FR-027 | Allow user to mark a finding reviewed | P2 | Review state is local and does not alter scanner data |

### 4.4 Explanation and remediation guidance

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---:|---|
| FR-030 | Explain the issue in plain language | P0 | Each supported MVP rule has a locally stored explanation template |
| FR-031 | Explain user impact | P0 | Guidance describes who may be blocked and why, without making assumptions about an individual user |
| FR-032 | Show safe suggested correction | P0 | Each supported rule has a code example or practical remediation steps |
| FR-033 | Link to original rule guidance | P0 | Keep axe help URL and relevant W3C/WAI reference when available |
| FR-034 | Copy selector and sample snippet | P1 | User can copy a target selector and a sanitized snippet |
| FR-035 | AI-generated suggestions | P2 | Only after explicit opt-in; submit minimal sanitized data, never full page DOM by default |
| FR-036 | Distinguish automated guidance from human review | P0 | Guidance never presents an automated suggestion as proof of conformance |

### 4.5 Mansion visualization

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---:|---|
| FR-040 | Render a 2D mansion map | P0 | Each room represents a finding family and has a text equivalent |
| FR-041 | Show room state | P0 | Haunted, quiet, not checked and manual review are distinguishable without colour alone |
| FR-042 | Navigate from room to findings | P0 | Selecting a room filters the standard finding list |
| FR-043 | Provide list alternative | P0 | Every finding is accessible without interacting with the visual map |
| FR-044 | Optional atmospheric animations | P2 | Animations respect reduced-motion preference and can be disabled |
| FR-045 | Optional 3D mansion | P2 | Not part of MVP; only consider after all core functions and accessibility are complete |

### 4.6 Rescan and comparison

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---:|---|
| FR-050 | Save scan snapshots locally | P0 | Scan result can be reopened during the active browser profile session and persists according to storage policy |
| FR-051 | Compare two scans | P0 | Findings are classified as resolved, unchanged or new using stable fingerprints |
| FR-052 | Use stable finding fingerprint | P0 | Fingerprint uses rule ID plus normalized target/impact context; it must not depend on volatile HTML formatting alone |
| FR-053 | Show comparison summary | P0 | Counts of resolved, unchanged and new findings are displayed |
| FR-054 | Avoid false “fixed” claims | P0 | A finding is marked resolved only when no matching finding exists in the new completed scan; it is not a legal compliance assertion |

### 4.7 Reporting and local history

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---:|---|
| FR-060 | Export JSON report | P0 | Exported JSON validates against the published report schema |
| FR-061 | Export readable HTML report | P1 | Report includes metadata, findings, limitations and references |
| FR-062 | Redact report details | P0 | User can omit HTML excerpts and optionally omit full URL/query string before export |
| FR-063 | Store history locally | P0 | User can view and delete saved scan snapshots |
| FR-064 | Clear all local data | P0 | Settings provide a clear-data action with confirmation |

### 4.8 Settings and support

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---:|---|
| FR-070 | Reduced-motion setting | P0 | Setting and system preference both disable non-essential animation |
| FR-071 | Theme setting | P1 | Dark haunted theme and high-contrast/simple theme are available |
| FR-072 | About and limitations page | P0 | States tool version, axe-core version, scope and automated testing limitations |
| FR-073 | Error reporting | P1 | Errors are locally visible and do not automatically upload page data |

---

## 5. Non-functional requirements

| ID | Area | Requirement / target |
|---|---|---|
| NFR-001 | Performance | Dashboard first usable render target under 2.5 seconds on a typical modern laptop, excluding page scan time |
| NFR-002 | Performance | Extension package should remain lean; target under 5 MB compressed before optional assets |
| NFR-003 | Scan responsiveness | Show progress state immediately; do not freeze dashboard while scanning |
| NFR-004 | Reliability | A failed scan must preserve the previous completed scan |
| NFR-005 | Compatibility | Primary support: current stable Chrome and Edge desktop; Firefox is stretch after validation |
| NFR-006 | Accessibility | Phantom Audit UI targets WCAG 2.2 AA design/test coverage; automated checks plus manual keyboard and screen-reader review |
| NFR-007 | Security | Minimal permissions, no remote executable code, validated extension messages and sanitized report exports |
| NFR-008 | Privacy | No backend required for MVP; page scan and history remain local by default |
| NFR-009 | Data minimization | Never persist form values, cookies, authentication tokens or full page text/DOM |
| NFR-010 | Maintainability | Strict TypeScript, modular scanning/normalization/presentation layers and documented public types |
| NFR-011 | Testability | Unit, integration, browser E2E, extension permission and accessibility tests are repeatable |
| NFR-012 | Observability | Scanner errors include safe technical diagnostics without page content |
| NFR-013 | Usability | A first-time user can start a scan and open a finding without onboarding assistance |
| NFR-014 | Resilience | Handle pages with large DOMs, dynamic content, missing frames and unsupported origins gracefully |
| NFR-015 | Accuracy | Preserve axe-core result language and impact; do not invent severity or conformance scores |

Targets are engineering goals for the hackathon MVP, not guarantees across every website or device.

---

## 6. Technical stack

### 6.1 Recommended stack

| Layer | Technology | Reason |
|---|---|---|
| Extension framework | **WXT** | Extension-specific build system, file-based entrypoints, MV3 output and fast development workflow |
| Browser platform | Chrome/Edge Manifest V3 | One Chromium target reduces solo-dev compatibility work |
| UI framework | **React 19.3 + TypeScript** | Typed reusable components and current React release as of this spec date |
| Styling | **Tailwind CSS 4** | Fast visual iteration and consistent design tokens |
| Accessible components | **React Aria Components** or carefully validated native HTML | Keyboard and assistive-technology semantics are more important than decorative component libraries |
| Accessibility engine | **axe-core**, bundled locally | Established automated rules engine; no remote script dependency |
| State management | React state + small typed store (Zustand only if complexity grows) | Avoid unnecessary state infrastructure |
| Validation | **Zod** | Validate messages, scan records and report exports |
| Local persistence | `chrome.storage.local` for preferences/metadata; **IndexedDB** for scan snapshots if size requires it | No backend needed for MVP |
| Unit tests | **Vitest** | Fast tests for normalizers, room mapping and fingerprints |
| Property-based tests | **fast-check** | Generate edge cases for classification, fingerprints and report serialization |
| Browser tests | **Playwright** | Test dashboard and sample pages; use `@axe-core/playwright` for the extension dashboard/test pages where applicable |
| Lint / format | ESLint + Prettier | Consistent code and early defect detection |
| Package manager | **pnpm** | Fast deterministic workspace installs |
| CI | GitHub Actions | Typecheck, lint, unit tests, build and E2E smoke tests |
| Distribution | Unpacked extension ZIP / GitHub Release | No store approval dependency for hackathon judging |

**Do not use Next.js for the extension MVP.** Phantom Audit is a browser extension with a dashboard page; WXT + React + TypeScript is a more direct fit. A separate Next.js marketing site is not needed for the hackathon.

### 6.2 Version policy

Use the latest stable, mutually compatible package releases when initializing the repository. Commit `pnpm-lock.yaml`, pin the runtime/toolchain and record exact versions in the README. Do not blindly upgrade dependencies late in the submission window.

### 6.3 Permissions strategy

MVP permissions should be minimal:

- `activeTab`: temporary access after the user explicitly invokes the extension.
- `scripting`: inject the locally bundled scanner into the selected tab.
- `storage`: save preferences and local scan history.

Avoid `<all_urls>` and broad persistent host permissions in the MVP. Add optional permissions only when a clearly defined feature requires them and the user understands why.

### 6.4 Why a 2D mansion instead of Three.js

The 2D mansion can be built with SVG and CSS. It is faster, smaller, easier to make keyboard-accessible and simpler to test. Three.js adds bundle weight, performance work and accessibility challenges without improving the core scanning workflow. Consider 3D only as a stretch after the functional and accessible MVP is complete.

---

## 7. High-level architecture

```text
┌────────────────────────────────────────────────────────────┐
│                 Chrome / Edge — Manifest V3                │
│                                                            │
│  User clicks extension action                              │
│          │                                                 │
│          ▼                                                 │
│  Background service worker                                 │
│  - captures active tab ID                                  │
│  - opens Phantom Audit dashboard                           │
│          │                                                 │
│          ▼                                                 │
│  Dashboard (extension page: React)                         │
│  - scan controls                                           │
│  - mansion overview                                        │
│  - finding inspector                                       │
│  - comparison and report export                            │
│          │                                                 │
│          ▼                                                 │
│  Scanner controller                                        │
│  - validates target tab                                    │
│  - injects bundled axe-core using scripting API            │
│  - runs axe against current DOM                            │
│          │                                                 │
│          ▼                                                 │
│  Result normalizer                                         │
│  - normalizes violations, passes, incomplete checks         │
│  - creates stable finding fingerprints                     │
│  - maps rule IDs to mansion rooms                          │
│          │                                                 │
│          ▼                                                 │
│  Local persistence                                         │
│  - chrome.storage.local                                    │
│  - IndexedDB (scan snapshots, if needed)                   │
└────────────────────────────────────────────────────────────┘
```

### 7.1 Main modules

```text
src/
  entrypoints/
    background.ts
    popup/                       # small extension action UI if used
    dashboard/                   # main audit dashboard
  components/
    mansion/
    findings/
    scan/
    reports/
    settings/
    shared/
  features/
    scan-controller/
    axe-injection/
    result-normalizer/
    room-mapper/
    remediation-guide/
    scan-comparison/
    report-export/
    local-history/
  domain/
    scan.ts
    finding.ts
    report.ts
    room.ts
  data/
    rule-guidance/
    room-mapping/
  lib/
    validation/
    storage/
    privacy/
  styles/
    tokens.css
    globals.css
  tests/
public/
  axe.min.js                     # locally bundled axe-core asset
  icons/
```

Names may be adjusted to WXT's generated project conventions, but retain the architectural boundaries.

### 7.2 Scan invocation design

1. The user clicks the extension action on a normal web page.
2. The service worker records the invoking tab ID and opens the dashboard with that tab ID as context.
3. The dashboard requests a scan for that exact tab.
4. The extension verifies that the target tab still exists and is eligible.
5. The extension injects the local axe-core bundle using `chrome.scripting.executeScript`.
6. The extension calls `axe.run(document, configuration)` in the page's isolated execution world.
7. Only the normalized, size-limited result is returned to the extension dashboard.
8. The dashboard stores the scan locally and renders the findings.

Implementation must be tested against current Chrome/Edge behavior. The `activeTab` grant is tied to the user gesture and target tab; navigation to another origin or closing the tab can revoke access. If the target becomes unavailable, ask the user to invoke Phantom Audit again.

### 7.3 Page types and limitations

The MVP must gracefully handle:

- Browser internal pages (`chrome://`, `edge://`).
- Extension pages and browser store pages.
- PDF viewer pages and other restricted browser documents.
- Tabs that close or navigate during a scan.
- Pages whose DOM changes during analysis.
- Frames that cannot be inspected because required access is unavailable.
- Large pages where scans take longer than expected.

The report must identify the scan scope and avoid implying that inaccessible frames or hidden states were fully evaluated.

---

## 8. Core data model

Use stable, versioned domain types. Validate messages crossing the extension boundary with Zod.

### 8.1 Scan record

```ts
export type ScanStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ScanRecord {
  id: string;
  schemaVersion: 1;
  tabUrl: string;
  pageTitle: string;
  hostname: string;
  scannedAt: string;              // ISO-8601 timestamp
  completedAt?: string;
  axeVersion: string;
  extensionVersion: string;
  browserName: 'chrome' | 'edge' | 'unknown';
  status: ScanStatus;
  findings: FindingRecord[];
  incompleteChecksCount: number;
  passesCount: number;
  inapplicableCount: number;
  errorCode?: string;
}
```

### 8.2 Finding record

```ts
export type Impact = 'critical' | 'serious' | 'moderate' | 'minor' | 'unknown';
export type RoomId =
  | 'name-chamber'
  | 'contrast-crypt'
  | 'portrait-gallery'
  | 'form-cellar'
  | 'structure-hall'
  | 'focus-corridor'
  | 'other';

export interface FindingNode {
  target: string[];
  htmlExcerpt: string;             // sanitized and length-limited
  failureSummary: string;
}

export interface FindingRecord {
  fingerprint: string;
  ruleId: string;
  impact: Impact;
  description: string;
  help: string;
  helpUrl?: string;
  wcagTags: string[];
  roomId: RoomId;
  affectedNodeCount: number;
  nodes: FindingNode[];
  firstSeenAt: string;
  reviewed: boolean;
}
```

### 8.3 Finding fingerprint

Use a deterministic fingerprint built from:

- axe rule ID;
- normalized target selector(s);
- a stable target context where available.

Do not use full raw HTML as the sole key. HTML snippets can change for irrelevant reasons and may contain sensitive data. Normalize selectors, sort target arrays and hash the canonical representation. Document fingerprint versioning so the comparison algorithm can evolve.

### 8.4 Comparison record

```ts
export interface ScanComparison {
  fromScanId: string;
  toScanId: string;
  resolved: FindingRecord[];
  unchanged: FindingRecord[];
  newFindings: FindingRecord[];
  generatedAt: string;
}
```

A finding marked resolved means that the matching fingerprint was not found in a later completed scan. It does not mean the entire page is accessible or conformant.

---

## 9. Remediation guidance design

### 9.1 Guidance catalogue

Start with a curated local catalogue for the most demonstrable rules. Do not attempt to write guidance for every axe-core rule in the MVP.

Each catalogue entry should contain:

- `ruleId`;
- short title;
- plain-language explanation;
- user-impact explanation;
- likely cause;
- recommended fix steps;
- before/after code example where safe;
- official axe help URL;
- relevant WCAG success criterion tags where provided/verified;
- caveats and manual verification instructions.

### 9.2 Example guidance: button-name

**Problem:** A button does not expose an accessible name.

**Why it matters:** A person using a screen reader may not know what the button does.

**Potential correction:** Give the button visible text or an appropriate accessible name. If an icon-only button is intentional, provide an accessible label that describes its action.

```html
<!-- Problematic example -->
<button>
  <svg aria-hidden="true">...</svg>
</button>

<!-- One possible correction -->
<button aria-label="Open settings">
  <svg aria-hidden="true">...</svg>
</button>
```

This is an illustrative pattern, not a universal fix. The correct accessible name depends on the button's actual purpose and surrounding context.

### 9.3 No automatic page mutation

The MVP must not silently alter the target page to “fix” issues. Phantom Audit offers guidance and lets the user change the source. A future experimental preview may be considered, but it must be isolated, reversible and clearly labelled as a temporary simulation.

---

## 10. Privacy, security and safety

### 10.1 Privacy defaults

- Scan only after explicit invocation.
- Process page DOM locally in the browser.
- No backend or analytics SDK required for the MVP.
- Do not transmit raw page HTML, form values, cookies, local storage or authentication information.
- Store scan results locally only.
- Limit HTML excerpts and redact likely sensitive values.
- Allow users to delete individual scans or all local history.
- Exports must offer a redaction choice.

### 10.2 Extension security

- Use Manifest V3.
- Bundle axe-core locally; do not download executable scanner code at runtime.
- Do not use `eval`, remote scripts or remote code loading.
- Validate all messages from the dashboard and injected page context.
- Treat page DOM and scanner output as untrusted input.
- Render snippets as text, never as trusted HTML.
- Escape HTML excerpts in the dashboard.
- Restrict extension permissions to the minimum needed.
- Do not use broad `<all_urls>` host permissions for the MVP.
- Keep extension page CSP strict and avoid unsafe inline scripts.
- Ensure the injected scanner cannot call arbitrary privileged extension APIs.

### 10.3 AI guidance privacy

AI-generated remediation is **P2 / optional**. The MVP uses curated local guidance templates.

If AI assistance is later added:

1. It must be opt-in per request.
2. Explain what data will be sent and to which provider.
3. Send only the rule ID, sanitized explanation and a minimal redacted HTML excerpt when necessary.
4. Never send full page source, form values, cookies or credentials.
5. Validate generated suggestions and label them as suggestions requiring developer review.
6. Do not require an API key to use the core scanner.

### 10.4 Threat model

| Threat | Mitigation |
|---|---|
| Malicious page content attempts to exploit the dashboard | Treat all page-derived strings as untrusted; escape output and validate messages |
| Scanner executes untrusted remote code | Bundle a pinned axe-core release locally |
| Excessive permission access | Use `activeTab` + `scripting`; avoid broad host access |
| Sensitive page content leaks into reports | Store limited data, redact excerpts and provide export controls |
| Malformed result crashes UI | Zod validation and defensive normalization |
| Dashboard XSS through HTML snippets | Render snippets as escaped text; never inject with `dangerouslySetInnerHTML` |
| Large DOM causes poor performance | Show progress, impose a scan timeout and handle errors |
| Misleading compliance claim | Explicitly disclose automated scan limitations in UI and reports |

---

## 11. Accessibility methodology and limitations

Phantom Audit uses axe-core as an automated testing engine. WCAG 2.2 is the standards reference for the product's guidance and mappings.

**Important:** Automated accessibility tools can identify many common issues, but cannot determine every accessibility barrier. WCAG conformance requires evaluation of all applicable success criteria and relevant page states, including manual evaluation. Phantom Audit must never label a page “WCAG compliant” solely because an automated scan reports zero violations.

### 11.1 Required language in product UI

Use wording such as:

> “No automated findings were detected by the enabled rules in this scan. This is not a WCAG conformance assessment. Manual keyboard, screen-reader, content and interaction checks are still required.”

Avoid wording such as:

- “100% accessible.”
- “WCAG certified.”
- “Fully compliant.”
- “All accessibility issues fixed.”

### 11.2 Manual review checklist

The report should include optional manual reminders:

- Can all controls be reached and operated using a keyboard?
- Is focus visible and does it move in a meaningful order?
- Do dialogs and menus manage focus correctly?
- Are instructions and error messages understandable?
- Do dynamic changes make sense to screen-reader users?
- Are video/audio alternatives available where needed?
- Does the page work at zoom and reflow settings?
- Is the content understandable and not dependent on colour alone?

These are prompts for human evaluation, not automated results.

---

## 12. API and internal message contracts

The MVP has no public backend API. The following internal commands communicate between the extension dashboard, service worker and page scanner.

| Message | Direction | Payload | Result |
|---|---|---|---|
| `START_SCAN` | Dashboard → extension controller | `tabId`, scan options | `scanId` and running status |
| `SCAN_PROGRESS` | Controller → dashboard | `scanId`, progress stage | UI status update |
| `SCAN_COMPLETED` | Controller → dashboard | validated normalized scan | saved scan ID |
| `SCAN_FAILED` | Controller → dashboard | safe error code and retry hint | error state |
| `GET_SCAN` | Dashboard → storage | `scanId` | scan record |
| `LIST_SCANS` | Dashboard → storage | filters / pagination | scan metadata list |
| `DELETE_SCAN` | Dashboard → storage | `scanId` | deletion status |
| `COMPARE_SCANS` | Dashboard → comparison service | two scan IDs | comparison record |
| `EXPORT_REPORT` | Dashboard → report service | scan ID, format, redaction options | Blob/download payload |

All payloads must be schema-validated. Never trust page-script messages as privileged extension commands.

---

## 13. Testing strategy

Testing has to cover both sides of the product: the scanner's correctness and Phantom Audit's own accessibility.

### 13.1 Unit tests — Vitest

- axe result normalization.
- Impact fallback handling.
- Room mapping for known and unknown rule IDs.
- Fingerprint determinism.
- Comparison resolved/unchanged/new logic.
- HTML excerpt sanitization and truncation.
- URL redaction.
- Report serialization and schema validation.
- User preference defaults.
- Unsupported-tab error mapping.

### 13.2 Property-based tests — fast-check

Examples:

1. Mapping the same rule ID always produces the same room.
2. Unknown rule IDs always map to `other`.
3. Sorting input targets before hashing yields a stable fingerprint.
4. A completed scan with no matching fingerprint in the next scan is classified as resolved.
5. Every normalized finding has a valid impact fallback and non-empty rule ID.
6. Export → parse → validate preserves the supported report fields.
7. Sanitization never returns a raw script element or unsafely rendered markup.
8. Arbitrarily long HTML snippets are truncated to the configured bound.

### 13.3 Integration tests

Create controlled fixture pages containing known issues:

- Icon-only button without an accessible name.
- Image without alternative text.
- Text with insufficient contrast.
- Input without an accessible label.
- Invalid heading/landmark structure where applicable.
- A page with no issues for the enabled rules.
- A page that mutates during scanning.
- A very large DOM fixture.

Verify that axe-core finds expected violations, the normalizer preserves useful evidence and the room mapping is correct.

### 13.4 Extension E2E — Playwright

- Install/load unpacked extension in Chromium test context where supported by the selected Playwright configuration.
- Open a controlled fixture page.
- Invoke the extension and scan.
- Verify result counts and finding details.
- Change the fixture page and rescan.
- Verify before/after comparison.
- Export JSON and validate it.
- Verify unsupported page and missing permission states.

### 13.5 Test Phantom Audit's own accessibility

- Run axe-core / `@axe-core/playwright` against every main dashboard screen.
- Keyboard-only test the full flow.
- Check screen-reader names and status announcements.
- Check focus order and visible focus.
- Test reduced-motion setting and operating-system preference.
- Test 200% zoom and narrow viewport reflow.
- Test dark and high-contrast/simple presentation modes.
- Manually inspect the SVG mansion navigation and its text alternative.

### 13.6 Manual QA matrix

| Environment | Test |
|---|---|
| Chrome stable on Windows 11 | Install, scan, inspect, rescan and export |
| Edge stable on Windows 11 | Same core workflow |
| Restricted browser page | Helpful unsupported-page message |
| Slow laptop / large DOM | Dashboard stays responsive and times out gracefully |
| Reduced-motion enabled | Animations disabled |
| Keyboard-only | All functions usable without mouse |
| Screen reader | Labels, live updates and finding details understandable |

---

## 14. Sprint-by-sprint development plan

The sprints are intentionally ordered **design → architecture → implementation → testing → polish → submission**. They are sized for one developer. Complete P0 acceptance criteria before adding P2 features.

### Sprint 0 — Product discovery, requirements and UX design

**Estimated effort:** 1 day  
**Goal:** Finalize the product experience before writing the scanner.

**Design tasks**
- Define product one-liner, target user and MVP boundary.
- Confirm active-tab-only scanning and privacy-first local processing.
- Create a user journey from extension click to rescan.
- Create low-fidelity wireframes for Welcome, Dashboard, Mansion, Finding Inspector, Comparison, History and Settings.
- Create the mansion room map and finding-to-room taxonomy.
- Define design tokens for typography, spacing, severity, contrast and motion.
- Create accessible empty, loading, error and success states.

**Implementation tasks**
- Create repository and project README skeleton.
- Create a decision log for chosen architecture and permissions.
- Create `.kiro/steering/product.md` and `.kiro/steering/accessibility.md`.

**Testing / exit criteria**
- Walk through the complete UX with sample findings.
- Confirm every room has a list-based alternative.
- Confirm the design does not depend on colour or animation alone.
- MVP scope signed off; no unresolved high-risk design question.

**Deliverables:** user journey, wireframes, design tokens, MVP scope, architecture decisions.

### Sprint 1 — Design system and extension foundation

**Estimated effort:** 1–1.5 days  
**Goal:** Build the accessible interface shell and a working MV3 extension.

**Design tasks**
- Finalize dashboard layout and responsive behavior.
- Finalize accessible button, card, badge, status, list and dialog patterns.
- Review dark and simple/high-contrast theme tokens.

**Implementation tasks**
- Bootstrap WXT + React + TypeScript with pnpm.
- Configure Manifest V3 entrypoints and minimal permissions.
- Add routing or view state for dashboard screens.
- Build the extension action/background flow that opens the dashboard with target tab ID.
- Build the mansion SVG placeholder and conventional findings list shell.
- Configure ESLint, Prettier, Vitest, Playwright and GitHub Actions baseline.

**Testing tasks**
- Build extension successfully.
- Load unpacked extension in Chrome.
- Verify dashboard opens from user action.
- Verify unsupported tabs show a controlled error.
- Run typecheck, lint and initial UI tests.

**Exit criteria:** extension installs and the dashboard opens with the correct target tab context.

### Sprint 2 — axe-core scanning engine

**Estimated effort:** 2 days  
**Goal:** Run real accessibility scans against the active page.

**Design tasks**
- Design scan progress, timeout, failure and completion states.
- Decide which scan metadata is shown to users.

**Implementation tasks**
- Add pinned axe-core dependency and package its browser script locally.
- Implement scan controller using `chrome.scripting` and the active tab permission.
- Implement target-tab validation and unsupported-origin handling.
- Run `axe.run` against current DOM.
- Capture violations, passes, incomplete checks and inapplicable counts where available.
- Add scan timeout and duplicate-request protection.
- Return only validated, size-limited result payloads to the dashboard.

**Testing tasks**
- Scan controlled pages with known missing names, image alt and form-label issues.
- Test no-violation fixture.
- Test page navigation while scan is pending.
- Test restricted browser pages and tab closure.
- Confirm no remote script is loaded.

**Exit criteria:** a real page can be scanned and the raw result is available to the extension.

### Sprint 3 — Result normalization, room mapping and finding inspector

**Estimated effort:** 1.5–2 days  
**Goal:** Turn axe-core output into understandable product data.

**Design tasks**
- Finalize finding cards and severity hierarchy.
- Finalize room states and icons.
- Finalize finding inspector layout and source/reference area.

**Implementation tasks**
- Define Zod schemas and domain interfaces.
- Normalize rule metadata and affected nodes.
- Sanitize and truncate HTML excerpts.
- Implement stable finding fingerprint generation.
- Implement deterministic room mapping and fallback to Other.
- Build mansion map and list alternative.
- Build finding inspector with rule ID, impact, selector, explanation and help link.

**Testing tasks**
- Unit tests for normalizer and room mapper.
- Property tests for deterministic mapping and fingerprint behavior.
- Test unknown rule IDs and missing optional fields.
- Verify raw HTML is displayed as escaped text.

**Exit criteria:** users can navigate from a room to a real finding and inspect its affected DOM target.

### Sprint 4 — Remediation guidance and fix workflow

**Estimated effort:** 1.5 days  
**Goal:** Make findings actionable.

**Design tasks**
- Design remediation panel, code example and copy actions.
- Design “manual review needed” state.

**Implementation tasks**
- Build local rule guidance catalogue for the initial supported rules.
- Add plain-language explanation, impact, recommended fix and caveat.
- Add copy selector and copy sanitized snippet.
- Add link to axe help and verified W3C/WAI references.
- Add manual review checklist.
- Make AI suggestions a disabled-by-default future capability.

**Testing tasks**
- Verify guidance is mapped to the correct rule ID.
- Verify every P0 rule shown in the demo has a guidance entry.
- Verify copy actions contain only sanitized data.
- Review explanations for misleading or overconfident language.

**Exit criteria:** a user can understand what the issue is and what a developer could change to address it.

### Sprint 5 — Local history, rescans and progress comparison

**Estimated effort:** 1.5–2 days  
**Goal:** Demonstrate a measurable fix cycle.

**Design tasks**
- Design scan history, comparison summary and resolved/new states.
- Design report privacy and redaction controls.

**Implementation tasks**
- Persist scan snapshots locally.
- Implement history listing and delete actions.
- Implement rescan on the same tab.
- Compare fingerprints across scans.
- Show resolved, unchanged and new findings.
- Export JSON report.
- Export readable HTML report if time allows.
- Add URL and excerpt redaction options.

**Testing tasks**
- Test persistence across extension/dashboard restart.
- Test comparison with known resolved and newly introduced issues.
- Property-test comparison classification.
- Validate exported JSON against schema.
- Verify clear-all-data works.

**Exit criteria:** the core story “scan → fix → rescan → see progress” works end-to-end.

### Sprint 6 — Product accessibility, privacy, security and compatibility hardening

**Estimated effort:** 1.5–2 days  
**Goal:** Ensure the accessibility scanner is itself accessible and safe.

**Design tasks**
- Review all animation and colour usage.
- Review warning, result and error text for clarity.

**Implementation tasks**
- Finish reduced-motion support.
- Finish keyboard navigation and focus management.
- Add semantic text alternatives to the mansion visualization.
- Ensure no page content is sent to remote services.
- Review extension permissions and CSP.
- Add privacy/settings screen and delete-data flow.
- Add safe error handling for large pages and inaccessible frames.

**Testing tasks**
- Run axe-core against Phantom Audit dashboard.
- Test keyboard-only flow.
- Test screen reader labels/status announcements.
- Test 200% zoom and narrow viewport.
- Test reduced motion.
- Review dependencies and ensure no remote executable code.
- Test Chrome and Edge.

**Exit criteria:** no known P0 security/privacy defect; core dashboard flow is keyboard usable; known scanner limitations are disclosed.

### Sprint 7 — Visual polish, packaging, demo and submission

**Estimated effort:** 1.5–2 days  
**Goal:** Prepare a reliable and convincing competition submission.

**Design tasks**
- Finalize mansion artwork, subtle visual effects and iconography.
- Check readable typography and severity hierarchy.
- Create screenshots and demo title card.

**Implementation tasks**
- Add final empty/error states.
- Remove unused code and dependencies.
- Finalize app icon and extension metadata.
- Build production extension package.
- Write README, architecture diagram, installation and test instructions.
- Add open-source LICENSE.
- Ensure `.kiro/` is committed and not ignored.

**Testing tasks**
- Fresh install from packaged build.
- Run full unit, integration and E2E suite.
- Test the exact demo flow on a clean browser profile.
- Validate public repository and release artifacts.
- Record and review the final video.

**Exit criteria:** public repository, installable extension, complete documentation, tested demo and Devpost submission ready.

---

## 15. Kiro project setup

### 15.1 Suggested `.kiro` structure

```text
.kiro/
  specs/
    01-product-and-user-journeys/
      requirements.md
      design.md
      tasks.md
    02-extension-foundation/
      requirements.md
      design.md
      tasks.md
    03-accessibility-scanner/
      requirements.md
      design.md
      tasks.md
    04-findings-and-remediation/
      requirements.md
      design.md
      tasks.md
    05-rescan-and-reporting/
      requirements.md
      design.md
      tasks.md
    06-privacy-and-accessibility/
      requirements.md
      design.md
      tasks.md
  steering/
    product.md
    architecture.md
    coding-standards.md
    accessibility.md
    privacy-security.md
    testing.md
  hooks/
    # Keep actual generated hook files here; do not invent unsupported schema.
```

### 15.2 Steering guidance

`product.md` should define the product purpose, audience, MVP, non-goals and differentiation.

`architecture.md` should require clear separation between extension runtime, scanner adapter, domain normalization, local persistence and React UI.

`accessibility.md` should require keyboard support, reduced motion, semantic structure, readable typography and no colour-only communication.

`privacy-security.md` should prohibit remote code, broad permissions, unsafe HTML rendering and default transmission of page data.

`testing.md` should require unit, property-based, integration, E2E and manual accessibility tests.

### 15.3 Agent hooks

Use hooks only where they provide real feedback:

- After changing scanner/normalizer files: run relevant Vitest tests.
- After changing finding guidance or room mappings: run mapping/catalogue tests.
- After changing UI components: run typecheck and dashboard accessibility smoke tests.
- Before final commit: run lint, typecheck, unit tests and production build.
- Before submission: run Playwright smoke suite and verify `.kiro/` is included.

Do not make every save run the full test suite; that will slow a solo developer down. Keep fast hooks for local feedback and a complete suite for commits/releases.

### 15.4 Optional MCP server

An MCP integration is not required for Phantom Audit's core functionality. If time permits, build a small local **Accessibility Reference MCP** exposing read-only tools such as:

- `lookup_axe_rule(ruleId)` — retrieve approved local guidance for a rule.
- `get_wcag_reference(tag)` — retrieve a curated reference entry.
- `validate_guidance_entry(entry)` — validate the project's rule guidance schema.

This MCP should support development and documentation; it must not be required to run the extension.

---

## 16. Repository structure

```text
phantom-audit/
├── .kiro/
│   ├── specs/
│   ├── steering/
│   └── hooks/
├── public/
│   ├── axe.min.js
│   └── icons/
├── src/
│   ├── entrypoints/
│   │   ├── background.ts
│   │   └── dashboard/
│   ├── components/
│   │   ├── mansion/
│   │   ├── findings/
│   │   ├── scan/
│   │   └── shared/
│   ├── features/
│   │   ├── scanner/
│   │   ├── normalization/
│   │   ├── remediation/
│   │   ├── comparison/
│   │   ├── history/
│   │   └── reports/
│   ├── domain/
│   ├── data/
│   ├── lib/
│   └── styles/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── fixtures/
│   └── e2e/
├── docs/
│   ├── architecture.md
│   ├── privacy.md
│   ├── limitations.md
│   └── demo-script.md
├── .github/workflows/
├── wxt.config.ts
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── README.md
├── LICENSE
└── CHANGELOG.md
```

Adjust paths to WXT's actual generated entrypoint conventions. The important requirement is that the extension's entrypoints and feature boundaries remain clear.

---

## 17. Definition of Done

A feature is not complete merely because it renders in the browser.

### MVP Definition of Done

- [ ] Extension builds as Manifest V3.
- [ ] Extension can be loaded unpacked in Chrome and Edge.
- [ ] User explicitly invokes scan on the active tab.
- [ ] Minimal permissions are used and documented.
- [ ] axe-core is bundled locally.
- [ ] Scan runs against the intended page, not the dashboard.
- [ ] Unsupported targets fail gracefully.
- [ ] Results are schema-validated and normalized.
- [ ] Findings show rule ID, impact, selector and safe excerpt.
- [ ] Findings map to rooms deterministically.
- [ ] Mansion map has a conventional list alternative.
- [ ] Remediation guidance exists for all demo findings.
- [ ] User can rescan after applying a change.
- [ ] Comparison shows resolved, unchanged and new findings.
- [ ] JSON report export works.
- [ ] Local history and clear-data controls work.
- [ ] No page content is uploaded by default.
- [ ] Product UI passes automated accessibility checks used in the test suite and manual keyboard review.
- [ ] Reduced motion is supported.
- [ ] Limitations are visible in the UI and report.
- [ ] README, LICENSE and installation instructions are complete.
- [ ] `.kiro/` is committed at repository root and not ignored.
- [ ] Public demonstration video is under 3 minutes.

### Release-blocking defects

- Scanner silently scans the wrong tab.
- The dashboard renders untrusted HTML.
- Page contents are transmitted without clear consent.
- A resolved finding is claimed without a successful later scan.
- The interface claims WCAG certification or full compliance from automated results.
- Keyboard users cannot complete the primary workflow.
- Extension requests broad permissions without a documented MVP need.

---

## 18. Demo video storyboard — under 3 minutes

Target length: **2 minutes 40 seconds**.

| Time | Scene | What to demonstrate |
|---|---|---|
| 0:00–0:15 | Problem | Show a deliberately inaccessible sample website and explain that raw issue lists can be hard to understand |
| 0:15–0:35 | Invoke | Click Phantom Audit and start a scan of the current page |
| 0:35–1:00 | Reveal | Show the haunted mansion; rooms become haunted based on real detected findings |
| 1:00–1:30 | Inspect | Open one finding, show rule ID, affected element, selector and why it matters |
| 1:30–1:55 | Fix | Change the sample website source to add a correct accessible name or label |
| 1:55–2:15 | Rescan | Run another scan and show the finding resolved in the comparison |
| 2:15–2:30 | Accessibility | Show reduced-motion/list alternative and explain that automated results are not certification |
| 2:30–2:40 | Kiro | Briefly show specs, steering, hooks and tests in the public repository |

Use a website you created specifically for the demo. Do not scan or expose private pages, credentials or personal information. Use only original or properly licensed visual/audio assets.

---

## 19. Devpost submission description outline

### Short description

“Phantom Audit turns real website accessibility findings into a haunted-mansion experience. Scan a page, explore the rooms where accessibility issues live, inspect affected elements, apply fixes and rescan to see measurable progress — all with privacy-first local processing.”

### Problem
Accessibility reports can be technical and difficult for beginners to act on. Developers need clear explanations and a direct fix-and-verify workflow.

### Solution
A Manifest V3 browser extension that runs a locally bundled axe-core scan on the user-selected page and presents findings through an accessible haunted-mansion interface.

### Innovation
The contribution is the interaction model and end-to-end remediation workflow: real rule findings become explorable rooms, evidence stays inspectable, and rescans show progress without pretending to certify conformance.

### Kiro usage write-up
Describe only the Kiro features actually used. Include:

- Specs: requirements, architecture and task planning.
- Steering: architecture, accessibility, privacy and coding constraints.
- Hooks: automated relevant tests and pre-commit checks.
- MCP: optional local rule-reference tooling if implemented.
- Property-based tests: deterministic mapping, fingerprints, comparisons and report serialization.
- Custom agents: only if actually created and used; describe their tasks and measurable contribution.

---

## 20. Submission and compliance checklist

Based on the Kiroween 2026 Official Rules supplied for this project, verify the latest event page and rules before final submission.

- [ ] Select **Costume Contest** for Phantom Audit.
- [ ] Confirm the project was created during the submission period.
- [ ] Public GitHub repository exists.
- [ ] Repository includes all required source, assets, tests and setup instructions.
- [ ] Open-source LICENSE is included and visible on GitHub.
- [ ] `.kiro/` exists at the repository root and is committed.
- [ ] Public working application / installable extension package is available.
- [ ] If a test login is required, instructions are included; MVP should not require login.
- [ ] Public YouTube demo is under three minutes.
- [ ] Demo shows the extension working on the device/platform it targets.
- [ ] Demo includes no unlicensed third-party trademarks, music or assets.
- [ ] Kiro usage write-up is accurate and detailed.
- [ ] Submission includes the selected category and any eligible bonus entries.
- [ ] The same project is not submitted as multiple category entries.
- [ ] Ensure the project is substantially different from your other submissions.

---

## 21. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Similarity to existing scanners | High | High | Differentiate through haunted-room information architecture, actionable guidance and rescan comparison; do not claim a novel scanning engine |
| Similarity to existing horror websites | Medium | Medium | Make the horror metaphor functional and directly tied to findings, not a generic haunted website |
| Automated rules miss real problems | Certain limitation | High | Clearly disclose manual testing needs and incomplete checks |
| Browser permission / injection failure | Medium | High | Use activeTab, test Chrome/Edge early, and provide a re-invocation path |
| Cross-origin iframe coverage is incomplete | Medium | Medium | Document scan scope and avoid claiming full-page coverage where frames were inaccessible |
| Huge DOM or slow scan | Medium | Medium | Timeout, progress indicator, graceful failure and scan-size tests |
| Theme harms product accessibility | Medium | High | Make the product itself accessible; test keyboard, screen reader, contrast and reduced motion |
| Overbuilding 3D | High | Medium | Keep the MVP 2D SVG/CSS; make 3D a stretch feature only |
| AI fix advice is inaccurate | Medium | High | Use curated local templates first; optional AI is opt-in and clearly marked as a suggestion |
| Time overrun | High | High | Keep P2 features out of MVP; protect Sprint 6 hardening and Sprint 7 submission time |

---

## 22. Metrics to show in the demo

Use actual measurements from your tests, not invented marketing numbers.

- Scan duration for each controlled fixture.
- Number of axe violations by impact.
- Number of affected nodes.
- Number of incomplete checks requiring review.
- Number of findings resolved after a fix.
- Extension package size.
- Dashboard startup time.
- Results of keyboard and reduced-motion QA.

Do **not** create an arbitrary “accessibility score” or a “WCAG compliance percentage” unless there is a transparent, defensible methodology. A count of automated findings is not a conformance score.

---

## 23. Cost and hosting plan

MVP can run without a backend.

| Resource | Cost approach |
|---|---|
| Extension UI and scanner | Runs locally in browser |
| axe-core | Bundled open-source dependency; review its license and attribution requirements |
| Scan history | Local extension storage / IndexedDB |
| Report generation | Client-side JSON and HTML export |
| Hosting | Not required for core functionality; GitHub Releases can distribute ZIP |
| AI API | Not required for MVP; optional opt-in feature only |
| Database | Not required |
| Authentication | Not required |

This keeps the project inexpensive and reduces privacy/security work for a solo developer.

---

## 24. Open-source and attribution checklist

- Confirm axe-core license and include required attribution/notices in the project distribution.
- Confirm licenses for icons, fonts, textures, sound effects and mansion illustrations.
- Prefer original SVG/CSS artwork and open-license fonts/assets.
- Do not copy WAVE, axe DevTools or other product branding.
- Do not use copyrighted horror soundtracks or images without permission.
- Include a THIRD-PARTY-NOTICES file if required by dependencies/assets.
- Add a permissive open-source license to your own repository after considering the project's intended reuse.

---

## 25. Official and technical references

These references inform the architecture and test methodology. Recheck the current documentation when initializing the repository because browser and library behavior can change.

1. **W3C — Web Content Accessibility Guidelines (WCAG) 2.2:** https://www.w3.org/TR/WCAG22/
2. **W3C WAI — WCAG Overview:** https://www.w3.org/WAI/standards-guidelines/wcag/
3. **Deque — axe-core GitHub:** https://github.com/dequelabs/axe-core
4. **Deque — axe-core documentation:** https://dequeuniversity.com/rules/axe/
5. **Chrome for Developers — activeTab permission:** https://developer.chrome.com/docs/extensions/develop/concepts/activeTab
6. **Chrome for Developers — Scripting API:** https://developer.chrome.com/docs/extensions/reference/api/scripting
7. **Chrome for Developers — Declare permissions:** https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
8. **WXT — Web Extension Framework:** https://wxt.dev/
9. **React documentation / versions:** https://react.dev/versions
10. **Playwright — Accessibility testing:** https://playwright.dev/docs/accessibility-testing
11. **fast-check:** https://fast-check.dev/
12. **Tailwind CSS:** https://tailwindcss.com/docs
13. **Manifest V3 overview:** https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3

---

## 26. Final build order and solo-developer guardrails

1. **Design first:** finalize user journey, mansion map, finding inspector and accessible design tokens.
2. **Prove the scanner early:** get a real axe-core result from the active tab before building advanced visuals.
3. **Build the finding workflow:** map, inspect, guidance and copyable selectors.
4. **Build the memorable loop:** fix externally, rescan, compare and export.
5. **Make Phantom Audit itself accessible:** keyboard, focus, screen-reader, contrast, reduced motion and zoom.
6. **Polish the mansion:** only after the functional flow and accessibility checks work.
7. **Prepare the submission:** repository, `.kiro`, README, license, installable build and short video.

### Do not add these until the MVP is finished

- Three.js 3D mansion.
- Cloud account and hosted scan history.
- Multi-page domain crawler.
- Automatic code repair.
- Continuous background scanning.
- AI-generated fixes sent to a remote API.
- Team collaboration.
- Paid SaaS features.

**Final product principle:** The haunted mansion should make real accessibility problems easier to understand and fix. It must never make accessibility itself harder.

---

## Appendix A — Sample acceptance test for the complete demo

**Given** a local sample website containing a button without an accessible name, an image missing appropriate alternative text and a form control without a label,

**When** the user invokes Phantom Audit and runs a scan,

**Then**:

1. Phantom Audit scans the active sample page using the locally bundled axe-core engine.
2. The dashboard displays the findings returned by the configured automated rules.
3. The Name Chamber, Portrait Gallery and Form Cellar show the corresponding findings where the rule mapping applies.
4. The user opens the button finding and sees its rule ID, impact, affected selector, safe HTML excerpt and remediation guidance.
5. The user edits the sample page to provide an appropriate accessible name.
6. The user returns to Phantom Audit and runs a rescan.
7. The comparison reports the matching button finding as resolved if it is absent from the completed new scan.
8. The other unresolved findings remain visible.
9. The user exports a report with optional HTML excerpt redaction.
10. The report includes the scan timestamp, page URL/host according to redaction selection, axe-core version, findings, incomplete checks and the automated-testing limitation notice.

This scenario is the minimum end-to-end demonstration that must work before adding stretch features.

## Appendix B — Release notes template

```md
# Phantom Audit — Release X.Y.Z

## Added
- 

## Changed
- 

## Fixed
- 

## Security and privacy
- 

## Accessibility
- 

## Known limitations
- 

## Test summary
- Unit:
- Integration:
- E2E:
- Manual keyboard:
- Screen reader:
```

---

**Document end — Phantom Audit / Kiroween 2026**
