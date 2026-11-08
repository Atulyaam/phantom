# Phantom Audit — Privacy Policy & Architecture

**Document Version:** 1.0.0  
**Effective Date:** Kiroween 2026

---

## 1. Core Privacy Commitments

Phantom Audit is engineered with a strict **Privacy-by-Default** philosophy.

1. **Local-First Processing:** All accessibility evaluations are performed entirely in-browser on the user's active device using a locally bundled version of `axe-core`.
2. **Zero Remote Data Transmission:** Page DOM content, selectors, text excerpts, metadata, cookies, session identifiers, and audit results are never transmitted to external servers, cloud databases, or third-party analytics services.
3. **No Background Tracking:** Scans are user-initiated only. Phantom Audit does not monitor browser navigation, track browsing history, or run background crawlers.
4. **Data Minimization:** Scan snapshots store only essential structural data (rule ID, impact, CSS selector, length-limited safe excerpt). Form inputs, passwords, authentication headers, and personal data are never captured.

---

## 2. Permissions Explained

Phantom Audit requests only the absolute minimum Chromium Manifest V3 permissions required to function:

| Permission  | Purpose                                                                                                 | Privacy Safeguard                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `activeTab` | Grants temporary access to the active webpage when the user explicitly clicks the extension icon.       | Scoped strictly to the invoking tab; expires when the tab is closed or navigated away. |
| `scripting` | Allows the extension to inject the locally bundled `axe-core` analysis script into the target page DOM. | Injects only local extension code; no remote script URLs are loaded.                   |
| `storage`   | Saves user preferences (e.g. reduced motion) and local scan snapshots in `chrome.storage.local`.        | Data never leaves the local browser profile and is fully deletable by the user.        |

---

## 3. Data Retention & User Control

- **Local Storage:** Saved audit snapshots are stored strictly in `chrome.storage.local` within the user's local browser profile, limited to the last 50 scans.
- **Single-Click Deletion:** Users can delete individual audit records from their history at any time.
- **Clear All Data:** A single-click "Clear All Data" action permanently purges all stored scans and user preferences.
- **Uninstall Cleans All:** Removing the extension instantly wipes all associated local storage data.

---

## 4. Report Redaction on Export

When exporting audit reports (JSON or HTML), Phantom Audit provides user-controlled privacy filters:

- **Redact HTML Excerpts:** Strips all page HTML snippets from the exported document.
- **Strip Query Parameters:** Redacts URL query parameters and sensitive tokens from target page addresses.
