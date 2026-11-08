# Phantom Audit — Application Security & Threat Model

**Document Version:** 1.0.0  
**Phase:** 1 (Foundation)

---

## 1. Security Architecture & Threat Model

Phantom Audit operates in the Chromium Manifest V3 extension sandbox. It treats all inspected web content as potentially untrusted or malicious input.

### Threat Matrix & Mitigations

| Threat Vector                      | Potential Impact                                                                   | Architectural Mitigation                                                                                                                                                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Malicious Target Page Content**  | Page DOM contains XSS payloads designed to exploit the audit dashboard.            | All DOM selectors and HTML excerpts extracted by the scanner are treated as untrusted text. The dashboard never uses `dangerouslySetInnerHTML`. Excerpts are rendered exclusively inside escaped text containers or escaped code blocks. |
| **Remote Code Injection**          | Remote CDN scripts compromised to execute malicious code in the extension context. | The extension declares zero remote scripts. `axe-core` is locally bundled and pinned in extension assets. CSP prohibits `eval()` and remote executable resources (`script-src 'self'`).                                                  |
| **Excessive Extension Privileges** | Compromised extension could intercept arbitrary network traffic or cookies.        | No broad host permissions (`<all_urls>`, `*://*/*`) are declared. No `cookies` or `webRequest` APIs are declared. Permissions are limited to `activeTab`, `scripting`, and `storage`.                                                    |
| **Data Leakage in Reports**        | Sensitive user session data exported in shareable audit reports.                   | Data minimization at collection; user-configurable redaction of HTML excerpts and URL query strings prior to export.                                                                                                                     |
| **Malformed Scanner Payloads**     | Unexpected scanner output crashes the UI or corrupts state.                        | Strict schema validation with **Zod** (`FindingRecordSchema`, `ScanRecordSchema`) at the extension messaging boundary.                                                                                                                   |

---

## 2. Content Security Policy (CSP)

Manifest V3 default extension page policy is strictly observed:

```text
script-src 'self'; object-src 'self';
```

- Inline `<script>` tags without hash/nonce are prohibited.
- `eval()`, `new Function()`, and `setTimeout(string)` are prohibited.
- Loading executable scripts from remote origins is impossible.

---

## 3. Sandboxed Communication Boundaries

All messaging between the extension service worker (`background.ts`) and dashboard (`App.tsx`) occurs through typed, schema-validated message channels. Untrusted page scripts in the target tab cannot issue privileged extension commands.
