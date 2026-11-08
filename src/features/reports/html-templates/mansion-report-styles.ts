/**
 * Phantom Audit — Haunted Victorian Mansion Report Stylesheet
 *
 * Fully self-contained, offline-compatible stylesheet embedded into generated HTML reports.
 * Adheres to WCAG 2.2 AA contrast standards, responsive viewports, print media,
 * and prefers-reduced-motion preferences without external network dependencies.
 */

export const MANSION_REPORT_STYLES = `
/* ==========================================================================
   CSS Reset & Variables (Phantom Audit Dark Gothic Theme)
   ========================================================================== */
:root {
  --color-bg-base: #0b0c10;
  --color-bg-surface: #14161f;
  --color-bg-surface-raised: #1c1f2b;
  --color-bg-subtle: #181b24;

  --color-text-primary: #f3f4f6;
  --color-text-secondary: #9ca3af;
  --color-text-muted: #6b7280;
  --color-text-accent: #c084fc;

  --color-spectral-purple: #8b5cf6;
  --color-spectral-purple-dark: #6d28d9;
  --color-spectral-cyan: #22d3ee;
  --color-candlelight-gold: #fbbf24;

  --color-severity-critical: #ef4444;
  --color-severity-critical-bg: rgba(239, 68, 68, 0.15);
  --color-severity-serious: #f97316;
  --color-severity-serious-bg: rgba(249, 115, 22, 0.15);
  --color-severity-moderate: #eab308;
  --color-severity-moderate-bg: rgba(234, 179, 8, 0.15);
  --color-severity-minor: #38bdf8;
  --color-severity-minor-bg: rgba(56, 189, 248, 0.15);
  --color-severity-unknown: #8b5cf6;
  --color-severity-unknown-bg: rgba(139, 92, 246, 0.15);

  --color-room-haunted: #f87171;
  --color-room-quiet: #34d399;

  --color-border-subtle: #242938;
  --color-border-default: #374151;
  --color-border-accent: #8b5cf6;

  --focus-ring: 0 0 0 2px #0b0c10, 0 0 0 5px #38bdf8;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  --font-display: Georgia, Cambria, 'Times New Roman', Times, serif;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-sans);
  background-color: var(--color-bg-base);
  color: var(--color-text-primary);
  line-height: 1.6;
  font-size: 1rem;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ==========================================================================
   Accessibility Landmarks & Utilities
   ========================================================================== */
.skip-link {
  position: absolute;
  top: -9999px;
  left: 1rem;
  background-color: var(--color-spectral-purple);
  color: #ffffff;
  padding: 0.75rem 1.25rem;
  font-weight: 700;
  border-radius: 4px;
  text-decoration: none;
  z-index: 9999;
}

.skip-link:focus {
  top: 1rem;
  outline: 3px solid #ffffff;
  outline-offset: 2px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

/* ==========================================================================
   Report Container & Typography
   ========================================================================== */
.report-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem;
}

h1, h2, h3, h4 {
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1.3;
}

h1 {
  font-size: 2.25rem;
  letter-spacing: -0.02em;
  margin-bottom: 0.5rem;
}

h2 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border-subtle);
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

h3 {
  font-size: 1.2rem;
  margin-bottom: 0.5rem;
}

p {
  margin-bottom: 1rem;
}

p:last-child {
  margin-bottom: 0;
}

a {
  color: var(--color-spectral-cyan);
  text-decoration: underline;
  text-underline-offset: 3px;
}

a:hover {
  color: #67e8f9;
}

/* ==========================================================================
   Header & Identity
   ========================================================================== */
.report-header {
  border-bottom: 2px solid var(--color-border-accent);
  padding-bottom: 2rem;
  margin-bottom: 2.5rem;
}

.brand-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.brand-crest {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
}

.brand-titles {
  display: flex;
  flex-direction: column;
}

.brand-kicker {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--color-text-accent);
  font-weight: 700;
}

.report-subtitle {
  color: var(--color-text-secondary);
  font-size: 1.1rem;
  margin-bottom: 1.5rem;
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  padding: 1.25rem;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.meta-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-muted);
  font-weight: 600;
}

.meta-value {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--color-text-primary);
  font-family: var(--font-mono);
  word-break: break-all;
}

/* ==========================================================================
   Summary Cards & Metrics
   ========================================================================== */
.section {
  margin-bottom: 3rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.metric-card {
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.metric-card-critical {
  border-color: rgba(239, 68, 68, 0.4);
  background-color: var(--color-severity-critical-bg);
}

.metric-card-serious {
  border-color: rgba(249, 115, 22, 0.4);
  background-color: var(--color-severity-serious-bg);
}

.metric-card-moderate {
  border-color: rgba(234, 179, 8, 0.4);
  background-color: var(--color-severity-moderate-bg);
}

.metric-card-minor {
  border-color: rgba(56, 189, 248, 0.4);
  background-color: var(--color-severity-minor-bg);
}

.metric-count {
  font-size: 2rem;
  font-weight: 800;
  font-family: var(--font-mono);
  line-height: 1;
  margin-bottom: 0.5rem;
}

.metric-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
  font-weight: 600;
}

/* ==========================================================================
   Accessible Tables (Mansion Room Breakdown)
   ========================================================================== */
.table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  margin: 1.5rem 0;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.95rem;
}

caption {
  text-align: left;
  padding: 1rem;
  font-weight: 700;
  color: var(--color-text-primary);
  border-bottom: 1px solid var(--color-border-subtle);
}

th, td {
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid var(--color-border-subtle);
}

tbody tr:last-child th,
tbody tr:last-child td {
  border-bottom: none;
}

tbody tr:hover {
  background-color: var(--color-bg-surface-raised);
}

th[scope="col"] {
  background-color: var(--color-bg-surface-raised);
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
}

th[scope="row"] {
  font-weight: 600;
  color: var(--color-text-primary);
}

.numeric {
  text-align: right;
  font-family: var(--font-mono);
}

/* ==========================================================================
   Badges & Pills
   ========================================================================== */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.25rem 0.55rem;
  border-radius: 4px;
  line-height: 1.2;
}

.badge-critical {
  background-color: var(--color-severity-critical-bg);
  color: #fca5a5;
  border: 1px solid var(--color-severity-critical);
}

.badge-serious {
  background-color: var(--color-severity-serious-bg);
  color: #fdba74;
  border: 1px solid var(--color-severity-serious);
}

.badge-moderate {
  background-color: var(--color-severity-moderate-bg);
  color: #fde047;
  border: 1px solid var(--color-severity-moderate);
}

.badge-minor {
  background-color: var(--color-severity-minor-bg);
  color: #93c5fd;
  border: 1px solid var(--color-severity-minor);
}

.badge-unknown {
  background-color: var(--color-severity-unknown-bg);
  color: #d8b4fe;
  border: 1px solid var(--color-severity-unknown);
}

.badge-room {
  background-color: rgba(139, 92, 246, 0.15);
  color: #e9d5ff;
  border: 1px solid rgba(139, 92, 246, 0.4);
}

.badge-status-haunted {
  background-color: rgba(248, 113, 113, 0.15);
  color: #f87171;
  border: 1px solid rgba(248, 113, 113, 0.4);
}

.badge-status-quiet {
  background-color: rgba(52, 211, 153, 0.15);
  color: #34d399;
  border: 1px solid rgba(52, 211, 153, 0.4);
}

.badge-wcag {
  background-color: rgba(34, 211, 238, 0.12);
  color: #67e8f9;
  border: 1px solid rgba(34, 211, 238, 0.3);
  font-family: var(--font-mono);
  font-size: 0.7rem;
}

.badge-classification {
  background-color: rgba(255, 255, 255, 0.08);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border-subtle);
  font-size: 0.7rem;
}

/* ==========================================================================
   Finding Cards
   ========================================================================== */
.finding-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.finding-card {
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border-subtle);
  border-left-width: 6px;
  border-radius: 8px;
  padding: 1.5rem;
}

.finding-card-critical { border-left-color: var(--color-severity-critical); }
.finding-card-serious { border-left-color: var(--color-severity-serious); }
.finding-card-moderate { border-left-color: var(--color-severity-moderate); }
.finding-card-minor { border-left-color: var(--color-severity-minor); }
.finding-card-unknown { border-left-color: var(--color-severity-unknown); }

.finding-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.finding-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.finding-title {
  font-size: 1.25rem;
  margin-bottom: 0.5rem;
}

.finding-help {
  color: var(--color-text-secondary);
  margin-bottom: 1.25rem;
}

.nodes-section {
  margin-top: 1.25rem;
  border-top: 1px solid var(--color-border-subtle);
  padding-top: 1rem;
}

.nodes-heading {
  font-size: 0.95rem;
  font-family: var(--font-sans);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
  margin-bottom: 0.75rem;
}

.node-item {
  background-color: var(--color-bg-base);
  border: 1px solid var(--color-border-subtle);
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 0.75rem;
}

.node-item:last-child {
  margin-bottom: 0;
}

.selector-box {
  margin-bottom: 0.5rem;
}

.selector-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--color-text-muted);
  font-weight: 700;
  margin-right: 0.5rem;
}

code.selector {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--color-spectral-cyan);
  background-color: rgba(34, 211, 238, 0.08);
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  word-break: break-all;
}

.failure-summary {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  margin-bottom: 0.75rem;
}

pre.code-excerpt,
pre.remediation-snippet {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  background-color: #050608;
  color: #e2e8f0;
  border: 1px solid var(--color-border-subtle);
  border-radius: 6px;
  padding: 0.85rem 1rem;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
  margin-top: 0.5rem;
}

.excerpt-omitted {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  font-style: italic;
  display: block;
  margin-top: 0.5rem;
}

/* ==========================================================================
   Remediation Box
   ========================================================================== */
.remediation-box {
  margin-top: 1.25rem;
  background-color: rgba(139, 92, 246, 0.06);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 6px;
  padding: 1rem;
}

.remediation-heading {
  font-size: 0.9rem;
  font-family: var(--font-sans);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-accent);
  font-weight: 700;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.remediation-summary {
  font-size: 0.9rem;
  color: var(--color-text-primary);
  margin-bottom: 0.5rem;
}

.remediation-meta {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  margin-top: 0.5rem;
}

/* ==========================================================================
   Limitations & Disclaimers
   ========================================================================== */
.limitations-box {
  background-color: rgba(139, 92, 246, 0.08);
  border: 1px solid var(--color-border-accent);
  border-radius: 8px;
  padding: 1.5rem;
}

.limitations-title {
  color: var(--color-text-accent);
  font-size: 1.15rem;
  margin-bottom: 0.75rem;
}

.limitations-text {
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  line-height: 1.7;
}

/* ==========================================================================
   Manual Review Checklist
   ========================================================================== */
.checklist {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
}

.checklist-item {
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: 6px;
  padding: 0.85rem 1.25rem;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.checklist-checkbox {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-top: 2px;
  accent-color: var(--color-spectral-purple);
}

.checklist-text {
  font-size: 0.95rem;
  color: var(--color-text-primary);
}

/* ==========================================================================
   Empty State (Zero Findings)
   ========================================================================== */
.empty-state {
  text-align: center;
  padding: 3rem 1.5rem;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
}

.empty-title {
  font-size: 1.5rem;
  color: var(--color-room-quiet);
  margin-bottom: 0.75rem;
}

.empty-desc {
  max-width: 600px;
  margin: 0 auto;
  color: var(--color-text-secondary);
}

/* ==========================================================================
   Footer
   ========================================================================== */
.report-footer {
  border-top: 1px solid var(--color-border-subtle);
  padding-top: 2rem;
  margin-top: 4rem;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.footer-statement {
  margin-bottom: 0.5rem;
}

.footer-standards {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

/* ==========================================================================
   Print Stylesheet (@media print)
   ========================================================================== */
@media print {
  @page {
    margin: 1.5cm;
    size: letter portrait;
  }

  body {
    background-color: #ffffff !important;
    color: #111827 !important;
    font-size: 10pt;
  }

  .skip-link, .no-print {
    display: none !important;
  }

  .report-container {
    max-width: 100% !important;
    padding: 0 !important;
  }

  h1, h2, h3, h4 {
    color: #111827 !important;
  }

  a {
    color: #111827 !important;
    text-decoration: underline;
  }

  .metadata-grid, .metric-card, .table-wrapper, .finding-card, .node-item, .checklist-item {
    background-color: #ffffff !important;
    border: 1px solid #d1d5db !important;
    box-shadow: none !important;
  }

  .finding-card {
    break-inside: avoid;
    page-break-inside: avoid;
    border-left-width: 4px !important;
    margin-bottom: 1.25rem !important;
  }

  .finding-card-critical { border-left-color: #dc2626 !important; }
  .finding-card-serious { border-left-color: #ea580c !important; }
  .finding-card-moderate { border-left-color: #ca8a04 !important; }
  .finding-card-minor { border-left-color: #0284c7 !important; }
  .finding-card-unknown { border-left-color: #7c3aed !important; }

  th[scope="col"] {
    background-color: #f3f4f6 !important;
    color: #374151 !important;
  }

  th[scope="row"], td {
    color: #111827 !important;
    border-bottom: 1px solid #e5e7eb !important;
  }

  pre.code-excerpt, pre.remediation-snippet {
    background-color: #f9fafb !important;
    color: #111827 !important;
    border: 1px solid #e5e7eb !important;
  }

  code.selector {
    background-color: #f3f4f6 !important;
    color: #111827 !important;
  }

  .badge {
    background-color: transparent !important;
    border: 1px solid #374151 !important;
    color: #111827 !important;
  }

  .limitations-box {
    background-color: #f9fafb !important;
    border: 1px solid #9ca3af !important;
  }
}

/* ==========================================================================
   Prefers Reduced Motion
   ========================================================================== */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
`;
