# Phase 5 Technical Specification

## Finding Identity, Aggregation & Cross-Scan Comparison Engine

**Project:** Phantom Audit  
**Phase:** 5 of 12  
**Scope:** Finding Identity, Canonical Fingerprinting, Multi-Dimensional Aggregation, and Cross-Scan Differential Foundations  
**Author:** Architecture & Quality Assurance Team  
**Date:** 2026-11-06

---

## 1. Overview & Architectural Goals

In Phases 1 through 4, Phantom Audit established:

1. Manifest V3 extension foundation and React 19 UI shell.
2. 2D Haunted Mansion SVG architecture and accessible tabular view.
3. Extension active-tab tracking and type-safe runtime communication.
4. Local bundling of `axe-core` 4.14.0, isolated-world injection, and initial room taxonomy mapping.

**Phase 5** formalizes the **identity, aggregation, and comparison engine** for accessibility findings:

- **Canonical Fingerprint v1 Specification:** Stable, deterministic identification of findings across repeated scans of a mutating web page.
- **Cross-Scan Differential Comparator:** Pure algorithmic engine comparing baseline and rescan results, accurately categorizing findings into `resolved`, `unchanged`, and `newFindings` (regressions).
- **Multi-Dimensional Finding Filtering & Search:** High-performance filtering by text, severity impact, room, WCAG principle (POUR), and review status.
- **Actionable Remediation Inspector Utilities:** Direct clipboard copying of clean CSS selectors and sanitized excerpts, plus interactive review tracking.

---

## 2. Canonical Fingerprint Specification (v1)

### 2.1 The Challenge of Accessibility Finding Identity

Webpages are dynamic: class names shift, advertisements load, wrapper elements are added, and text updates. A brittle fingerprint based on raw innerHTML or absolute xpath will break on harmless edits. Conversely, a fingerprint based solely on `ruleId` collapses multiple distinct errors on a page into one.

### 2.2 Canonical Fingerprint Algorithm (v1)

A canonical fingerprint uniquely identifies a specific accessibility failure rule on a specific set of DOM nodes:

$$\text{Fingerprint} = \text{v1} : \text{ruleId} : \text{TargetHash}$$

#### Step 1: Rule Identifier Normalization

`cleanRuleId = ruleId.trim().toLowerCase()`

#### Step 2: Target Selector Canonicalization

For each node target selector string:

1. Normalize whitespace: collapse consecutive spaces, tabs, and newlines to a single space.
2. Standardize combinators: ensure uniform spacing around `>` (child), `+` (adjacent sibling), and `~` (general sibling).
3. Handle nested frame / shadow-root tuples: join array tuples deterministically with `' >>> '`.
4. Deduplicate duplicate selectors across nodes within the same rule instance.
5. Sort normalized selectors alphabetically using standard Unicode code-point ordering (`Array.prototype.sort()`).

#### Step 3: Fingerprint Serialization

```text
v1:{ruleId}:{sortedNormalizedSelectors.join('|')}
```

Example:

```text
v1:button-name:#header > nav.primary > button.menu-toggle|#modal-close
```

### 2.3 Mathematical Properties & Invariants (Verified via Property-Based Testing)

1. **Determinism:** $\forall f, \text{fingerprint}(f) \equiv \text{fingerprint}(f)$.
2. **Target Order Invariance (Commutativity):** $\text{targets } [A, B] \equiv [B, A] \implies \text{fingerprint}([A, B]) = \text{fingerprint}([B, A])$.
3. **Collision Resistance Across Rules:** $\text{rule}_1 \neq \text{rule}_2 \implies \text{fingerprint}(\text{rule}_1, T) \neq \text{fingerprint}(\text{rule}_2, T)$.
4. **Idempotence of Selector Normalization:** $\text{norm}(\text{norm}(S)) = \text{norm}(S)$.

---

## 3. Cross-Scan Comparison Engine

### 3.1 Domain Model: `ScanComparison`

```ts
export interface ScanComparison {
  baselineScanId: string;
  rescanScanId: string;
  comparedAt: string; // ISO-8601
  resolved: FindingRecord[]; // Present in baseline, absent in rescan
  unchanged: FindingRecord[]; // Present in both baseline and rescan
  newFindings: FindingRecord[]; // Absent in baseline, present in rescan
  metrics: {
    baselineTotal: number;
    rescanTotal: number;
    resolvedCount: number;
    unchangedCount: number;
    newCount: number;
    improvementPercentage: number; // 0 to 100
  };
}
```

### 3.2 Partition Invariants

Given baseline finding set $B$ and rescan finding set $R$:

1. $B = \text{resolved} \cup \text{unchanged}$, where $\text{resolved} \cap \text{unchanged} = \emptyset$.
2. $R = \text{newFindings} \cup \text{unchanged}$, where $\text{newFindings} \cap \text{unchanged} = \emptyset$.
3. $|B| = |\text{resolved}| + |\text{unchanged}|$.
4. $|R| = |\text{newFindings}| + |\text{unchanged}|$.

### 3.3 Improvement Metric Formulation

$$ \text{ImprovementPercentage} = \begin{cases}
100 & \text{if } |B| = 0 \text{ and } |R| = 0 \\
\max\left(0, \frac{|\text{resolved}| - |\text{newFindings}|}{|B|} \times 100\right) & \text{if } |B| > 0
\end{cases}$$

---

## 4. Multi-Dimensional Aggregation & Filtering

### 4.1 Filtering Criteria
1. **Full-Text Search:** Case-insensitive substring match against:
   - Rule ID (`button-name`, `image-alt`)
   - Help summary
   - Description
   - CSS selectors in nodes
   - Node failure reason
2. **Impact Multi-Filter:** Selection of `{ critical, serious, moderate, minor }`.
3. **Room Filter:** Specific room or `'all'`.
4. **WCAG Principle (POUR):**
   - **Perceivable:** Text alternatives, time-based media, adaptable content, distinguishable colors (`portrait-gallery`, `contrast-crypt`).
   - **Operable:** Keyboard accessible, enough time, seizures prevention, navigable (`focus-corridor`, `structure-hall`).
   - **Understandable:** Readable, predictable, input assistance (`form-cellar`, `name-chamber`).
   - **Robust:** Compatible, valid markup (`shadow-attic`).
   - **Advisory Best Practice:** Non-WCAG rules providing code quality/UX enhancements.
5. **Review Status Filter:** `all` | `reviewed` | `unreviewed`.

### 4.2 Safe Clipboard Operations
When users click "Copy Selector" or "Copy HTML Snippet":
- The application uses `navigator.clipboard.writeText()` directly with sanitized, length-limited strings.
- Form values and password attributes remain strictly redacted.
- Visual and screen-reader announcements confirm copy success without alert dialogs.

$$
