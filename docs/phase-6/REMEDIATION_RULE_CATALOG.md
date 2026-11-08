# Phantom Audit — Remediation Rule Catalog

## Curated Knowledge Base for High-Frequency WCAG & Axe Best-Practice Rules

**Document Version:** 1.1.0 (Audited & Corrected)  
**Phase:** 6 of 12  
**Parent Document:** `docs/PHASE_6_EXECUTION_PLAN.md`  
**Reference Document:** `docs/audits/PHASE_6_ARCHITECTURE_REVIEW.md`

---

## 1. Catalog Index & Authoritative Axe-Core Classification

> [!IMPORTANT]
> **Normative WCAG vs. Best-Practice Distinction:**  
> In accordance with axe-core 4.14.0 metadata and WCAG 2.2 specifications, rules are strictly categorized into **Normative WCAG 2.2 Failures** (direct violations of success criteria) and **Axe Best-Practice Recommendations** (heuristics that enhance accessibility but are not normative WCAG failures). Phantom Audit never misrepresents advisory best practices as legal or normative WCAG non-compliance.

| #   | Rule ID             | Mansion Room         | Axe Tags                                              | Official Axe Classification | WCAG SC Mapping                              | Level    | Automated vs. Manual                                                          |
| --- | ------------------- | -------------------- | ----------------------------------------------------- | --------------------------- | -------------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| 1   | `button-name`       | The Name Chamber     | `cat.name-role-value`, `wcag2a`, `wcag412`            | **Normative WCAG Failure**  | 4.1.2 Name, Role, Value                      | Level A  | Automated detection; manual check for text quality                            |
| 2   | `link-name`         | The Name Chamber     | `cat.name-role-value`, `wcag2a`, `wcag244`, `wcag412` | **Normative WCAG Failure**  | 2.4.4 Link Purpose / 4.1.2 Name, Role, Value | Level A  | Automated detection; manual check for destination context                     |
| 3   | `color-contrast`    | The Contrast Crypt   | `cat.color`, `wcag2aa`, `wcag143`                     | **Normative WCAG Failure**  | 1.4.3 Contrast (Minimum)                     | Level AA | Automated luminance calculation; manual check for background gradients/images |
| 4   | `image-alt`         | The Portrait Gallery | `cat.text-alternatives`, `wcag2a`, `wcag111`          | **Normative WCAG Failure**  | 1.1.1 Non-text Content                       | Level A  | Automated presence check; manual evaluation of description adequacy           |
| 5   | `svg-img-alt`       | The Portrait Gallery | `cat.text-alternatives`, `wcag2a`, `wcag111`          | **Normative WCAG Failure**  | 1.1.1 Non-text Content                       | Level A  | Automated check for `<svg role="img">`; manual evaluation of title            |
| 6   | `label`             | The Form Cellar      | `cat.forms`, `wcag2a`, `wcag412`                      | **Normative WCAG Failure**  | 4.1.2 Name, Role, Value                      | Level A  | Automated label association; manual check for instructions (3.3.2)            |
| 7   | `select-name`       | The Form Cellar      | `cat.forms`, `wcag2a`, `wcag412`                      | **Normative WCAG Failure**  | 4.1.2 Name, Role, Value                      | Level A  | Automated accessible name check                                               |
| 8   | `heading-order`     | The Structure Hall   | `cat.semantics`, `best-practice`                      | **Axe Best Practice**       | Advisory for 1.3.1 Info & Relationships      | Advisory | Automated level progression check; manual check for outline meaning           |
| 9   | `landmark-one-main` | The Structure Hall   | `cat.semantics`, `best-practice`                      | **Axe Best Practice**       | Advisory for 1.3.1 Info & Rel / 2.4.1 Bypass | Advisory | Automated check for `<main>` landmark                                         |
| 10  | `tabindex`          | The Focus Corridor   | `cat.keyboard`, `best-practice`                       | **Axe Best Practice**       | Advisory for 2.4.3 Focus Order               | Advisory | Automated detection of `tabindex > 0`; manual keyboard flow verification      |

---

## 2. Detailed Rule Specifications

---

### Rule 1: `button-name` — The Name Chamber

- **Classification:** **Normative WCAG 2.2 Failure** (WCAG 4.1.2 Level A)
- **Axe-core Rule ID:** `button-name`
- **Mansion Chamber:** The Name Chamber (The Echoing Crypt of Nameless Things)
- **Axe Help Text:** _Buttons must have discernible text_
- **Automated Detection Scope:** Evaluates `<button>`, `<input type="button">`, `<input type="submit">`, `<input type="reset">`, and `[role="button"]` elements. Fails when the calculated accessible name via the AccName 1.2 algorithm is empty.

#### Why It Matters & Human Impact

- **Screen Reader Users:** Screen readers announce an unnamed button as _"button"_ or read raw SVG path coordinates. Users cannot determine whether activating the control submits sensitive data, navigates, or deletes content.
- **Speech Input Users:** Users navigating via voice (e.g., Dragon NaturallySpeaking, Apple Voice Control) target controls by speaking their accessible name (e.g. _"Click Submit"_). Unnamed buttons cannot be targeted by voice.

#### Bad Example (Anti-Pattern)

```html
<!-- BAD: Icon-only button with no accessible text -->
<button class="btn-icon">
  <svg viewBox="0 0 24 24">
    <path
      d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
    />
  </svg>
</button>
```

#### Recommended Corrections (Native HTML First)

##### Option A: Visible Text (Preferred)

```html
<button class="btn-primary" type="button">
  <svg aria-hidden="true" viewBox="0 0 24 24">...</svg>
  <span>Close</span>
</button>
```

##### Option B: Visually Hidden Text (`sr-only`)

```html
<button class="btn-icon" type="button">
  <svg aria-hidden="true" viewBox="0 0 24 24">...</svg>
  <span class="sr-only">Close Dialog</span>
</button>
```

##### Option C: Programmatic Label (`aria-label`)

```html
<button class="btn-icon" type="button" aria-label="Close Dialog">
  <svg aria-hidden="true" viewBox="0 0 24 24">...</svg>
</button>
```

##### React / JSX Pattern

```tsx
export function ModalCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close dialog"
      className="p-2 rounded hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-cyan-400"
    >
      <XMarkIcon className="w-5 h-5" aria-hidden="true" />
    </button>
  );
}
```

#### Common Pitfalls

- Do NOT add `aria-hidden="true"` to the `<button>` itself (hides the interactive control from assistive tech entirely).
- Do NOT omit `type="button"`; buttons inside forms default to `type="submit"`.

#### Verification Procedure

1. **Keyboard:** Press `Tab` to reach the button. Verify focus outline is clearly visible.
2. **Screen Reader:** Navigate with VoiceOver/NVDA. Confirm announcement: _"Close dialog, button"_.
3. **Rescan:** Re-run Phantom Audit to confirm the finding is resolved.

---

### Rule 2: `link-name` — The Name Chamber

- **Classification:** **Normative WCAG 2.2 Failure** (WCAG 2.4.4 Level A, WCAG 4.1.2 Level A)
- **Axe-core Rule ID:** `link-name`
- **Mansion Chamber:** The Name Chamber
- **Axe Help Text:** _Links must have discernible text_
- **Automated Detection Scope:** Evaluates `<a>` elements with `href` attributes and elements with `role="link"`. Fails when accessible name is empty.

#### Why It Matters & Human Impact

- Screen reader users frequently navigate pages using a Links List (`Insert + F7` in NVDA, `VO + U` in VoiceOver). Vague link text (_"click here"_, _"read more"_) or icon-only links without names provide zero context out of flow.

#### Bad Example

```html
<!-- BAD: Ambiguous text or icon-only link -->
<a href="/financials.pdf">Click here</a>
<a href="/feed"><i class="icon-rss"></i></a>
```

#### Recommended Corrections

```html
<!-- GOOD: Descriptive destination in link text -->
<a href="/financials.pdf"> Download 2026 Q3 Financial Report (PDF, 2.1 MB) </a>

<!-- GOOD: Accessible icon link -->
<a href="/feed" aria-label="Subscribe to RSS Feed">
  <svg aria-hidden="true">...</svg>
</a>
```

---

### Rule 3: `color-contrast` — The Contrast Crypt

- **Classification:** **Normative WCAG 2.2 Failure** (WCAG 1.4.3 Level AA)
- **Axe-core Rule ID:** `color-contrast`
- **Mansion Chamber:** The Contrast Crypt (The Murky Vault of Shadow and Ink)
- **Axe Help Text:** _Elements must meet minimum color contrast ratio thresholds_
- **Automated Detection Scope:** Evaluates text against background colors. Requires $\ge 4.5:1$ for body text (< 18pt regular, < 14pt bold) and $\ge 3:1$ for large text.

#### Why It Matters & Human Impact

- **Low Vision & Aging Users:** Diminished contrast sensitivity makes low-contrast text illegible.
- **Direct Sunlight & Mobile Screens:** Insufficient contrast washes out on mobile devices under ambient glare.

#### Bad Example

```css
/* BAD: Contrast ratio is 2.1:1 on #ffffff background (Fails 4.5:1 requirement) */
.secondary-copy {
  color: #94a3b8; /* Slate 400 */
  background-color: #ffffff;
}
```

#### Recommended Corrections

```css
/* GOOD (Light theme): #475569 against #ffffff provides 5.9:1 ratio */
.secondary-copy {
  color: #475569; /* Slate 600 */
  background-color: #ffffff;
}

/* GOOD (Dark theme): #cbd5e1 against #0a0a0f provides 12.8:1 ratio */
.dark .secondary-copy {
  color: #cbd5e1; /* Slate 300 */
  background-color: #0a0a0f;
}
```

---

### Rule 4: `image-alt` — The Portrait Gallery

- **Classification:** **Normative WCAG 2.2 Failure** (WCAG 1.1.1 Level A)
- **Axe-core Rule ID:** `image-alt`
- **Mansion Chamber:** The Portrait Gallery (The Silent Hall of Blank Canvases)
- **Axe Help Text:** _Images must have alternative text_
- **Automated Detection Scope:** Evaluates `<img>` elements. Fails when `alt` attribute is missing.

#### Why It Matters & Human Impact

- When `alt` is absent, screen readers announce raw image filenames (e.g. _"IMG_90432_banner_final.png"_), causing confusion and disorientation.
- On slow or failed connections, browsers display the `alt` text in place of broken images.

#### Bad Example

```html
<!-- BAD: Missing alt attribute -->
<img src="/images/haunted-house.jpg" />
<!-- BAD: Redundant words in alt -->
<img src="/images/avatar.jpg" alt="Photo image of user profile picture" />
```

#### Recommended Corrections

```html
<!-- GOOD: Informative image describes visual content concisely -->
<img
  src="/images/haunted-house.jpg"
  alt="Two-story Victorian mansion illuminated by moonlight during Halloween"
/>

<!-- GOOD: Decorative graphic explicitly marked decorative -->
<img src="/images/ornate-divider.svg" alt="" role="presentation" />
```

---

### Rule 5: `svg-img-alt` — The Portrait Gallery

- **Classification:** **Normative WCAG 2.2 Failure** (WCAG 1.1.1 Level A)
- **Axe-core Rule ID:** `svg-img-alt`
- **Mansion Chamber:** The Portrait Gallery
- **Axe Help Text:** _`<svg>` elements with an img or image role must have alternative text_
- **Automated Detection Scope:** Evaluates `<svg role="img">` or `<svg role="image">`. Fails when no accessible name is provided via `<title>`, `aria-label`, or `aria-labelledby`.

#### Recommended Corrections

```html
<!-- OPTION A: role="img" with title and aria-labelledby -->
<svg role="img" aria-labelledby="status-warn" viewBox="0 0 24 24">
  <title id="status-warn">Warning: High severity violation</title>
  <path d="..." />
</svg>

<!-- OPTION B: Decorative SVG embedded in a labeled parent -->
<svg aria-hidden="true" viewBox="0 0 24 24">
  <path d="..." />
</svg>
```

---

### Rule 6: `label` — The Form Cellar

- **Classification:** **Normative WCAG 2.2 Failure** (WCAG 4.1.2 Level A)
- **Axe-core Rule ID:** `label`
- **Mansion Chamber:** The Form Cellar (The Catacombs of Unbound Controls)
- **Axe Help Text:** _Form elements must have labels_
- **Automated Detection Scope:** Evaluates `<input>` (non-hidden), `<select>`, and `<textarea>`. Fails when there is no `<label for="id">`, wrapping `<label>`, or `aria-label`/`aria-labelledby`.

#### Bad Example

```html
<!-- BAD: Placeholder is NOT an accessible label -->
<input type="text" id="username" placeholder="Enter username" />
```

#### Recommended Corrections

```html
<!-- OPTION A: Explicit for/id association (Recommended) -->
<div class="field-group">
  <label for="username">Username</label>
  <input type="text" id="username" name="username" autocomplete="username" required />
</div>

<!-- OPTION B: Implicit label wrapping -->
<label>
  Username
  <input type="text" name="username" required />
</label>
```

---

### Rule 7: `select-name` — The Form Cellar

- **Classification:** **Normative WCAG 2.2 Failure** (WCAG 4.1.2 Level A)
- **Axe-core Rule ID:** `select-name`
- **Mansion Chamber:** The Form Cellar
- **Axe Help Text:** _Select element must have an accessible name_

#### Recommended Correction

```html
<label for="country-picker">Select Country of Residence</label>
<select id="country-picker" name="country">
  <option value="">Please select an option</option>
  <option value="us">United States</option>
  <option value="ca">Canada</option>
</select>
```

---

### Rule 8: `heading-order` — The Structure Hall

- **Classification:** **Axe Best Practice** (Advisory for WCAG 1.3.1 Info & Relationships)
- **Axe-core Rule ID:** `heading-order`
- **Mansion Chamber:** The Structure Hall (The Labyrinth of Fragmented Portals)
- **Axe Help Text:** _Heading levels should only increase by one_
- **Technical Clarification:** In WCAG 2.2, skipping heading levels (e.g. `<h1>` to `<h3>`) is not a formal failure of SC 1.3.1 unless the semantic structure misrepresents the logical relationships. Axe-core evaluates this as a **best practice** recommendation to prevent disorientation for screen reader heading navigation (`H` key).

#### Recommended Correction

```html
<!-- BAD: Skipping levels -->
<h1>Document Title</h1>
<h3>Subsection</h3>
<!-- Skipped h2 -->

<!-- GOOD: Structured sequential outline -->
<h1>Document Title</h1>
<h2>Main Section</h2>
<h3>Subsection</h3>
```

---

### Rule 9: `landmark-one-main` — The Structure Hall

- **Classification:** **Axe Best Practice** (Advisory for WCAG 1.3.1 Info & Relationships / 2.4.1 Bypass Blocks)
- **Axe-core Rule ID:** `landmark-one-main`
- **Mansion Chamber:** The Structure Hall
- **Axe Help Text:** _Document should have one main landmark_
- **Technical Clarification:** HTML5 recommends that primary content be contained within a single `<main>` element. While screen reader users benefit from the `M` landmark key, WCAG 2.2 Level A does not strictly mandate ARIA landmarks if skip links and headings exist. Axe-core correctly flags this as a **best practice**.

#### Recommended Correction

```html
<body>
  <header role="banner">...</header>
  <main id="main-content" role="main">
    <!-- Single primary content container -->
  </main>
  <footer role="contentinfo">...</footer>
</body>
```

---

### Rule 10: `tabindex` — The Focus Corridor

- **Classification:** **Axe Best Practice** (Advisory for WCAG 2.4.3 Focus Order)
- **Axe-core Rule ID:** `tabindex`
- **Mansion Chamber:** The Focus Corridor (The Gallery of Trapped Specters)
- **Axe Help Text:** _Elements should not have tabindex greater than zero_
- **Technical Clarification:** Positive `tabindex` values (`tabindex="1"`, `tabindex="5"`) disrupt the natural DOM focus order. While WCAG SC 2.4.3 tests whether focus order preserves meaning and operability, axe-core flags any `tabindex > 0` as a **best practice** alert because positive values are notoriously fragile and prone to breaking navigation.

#### Recommended Correction

```html
<!-- BAD: Positive tabindex -->
<button tabindex="2">Save</button>
<button tabindex="1">Cancel</button>

<!-- GOOD: Natural DOM order (no tabindex needed for native buttons) -->
<button type="button">Cancel</button>
<button type="button">Save</button>

<!-- GOOD: Programmatic focus only (e.g. modal container) -->
<div id="modal" tabindex="-1">...</div>
```
