# Phantom Audit — Product Steering

## 1. Product Vision & Promise

Phantom Audit is a privacy-first Chromium browser extension that transforms website accessibility defects into an interactive haunted Victorian mansion.
Each ghost represents a real, inspectable accessibility finding. Users fix their website, rescan, and watch the room become peaceful.

## 2. Core Target Audience & Use Cases

- **Frontend Developers & Web Designers:** Rapidly identify, inspect, and fix accessibility issues on active local/staging pages without external SaaS setup.
- **QA & Accessibility Evaluators:** Gather deterministic evidence before and after fixes with local comparison reports.
- **Indie Makers:** Run local audits with zero cloud dependencies or telemetry.

## 3. Mandatory Product Principles

1. **Real Findings First:** Every ghost corresponds to an actual `axe-core` rule violation or is explicitly identified as a manual review prompt.
2. **Evidence Preserved:** Always display rule ID, impact level, target selector, and safe HTML excerpt. Never hide technical evidence behind theme embellishments.
3. **No False Certification Claims:** Zero automated findings does NOT certify WCAG 2.2 conformance. Automation detects only a subset of barriers; manual keyboard, screen-reader, and cognitive testing are required.
4. **Privacy by Default:** Scans occur strictly in the browser tab. Zero DOM data, cookies, or auth tokens are uploaded to cloud servers.
5. **Self-Accessibility:** Phantom Audit must itself adhere to WCAG 2.2 AA (full keyboard support, high contrast, reduced motion, screen reader live regions).
6. **Task-by-Task Integrity:** Complete P0 core workflows (scan -> inspect -> fix -> rescan -> compare) before considering stretch features.
