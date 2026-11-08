# Controlled Accessibility Test Fixtures Index

**Phase:** 4 of 12 (Local Accessibility Scanning Engine & Real WCAG Findings)  
**Location:** `tests/fixtures/html/`  
**Purpose:** Provides reproducible HTML test cases for testing axe-core execution, result classification, and mansion room mapping.

---

## Fixture Specification & Expected Results Matrix

|   #   | File Name             | Accessibility Defect                                                                | Expected Rule ID                                     | Severity / Impact                              | Expected Mansion Room                                           | WCAG 2.2 Criterion                                              |
| :---: | :-------------------- | :---------------------------------------------------------------------------------- | :--------------------------------------------------- | :--------------------------------------------- | :-------------------------------------------------------------- | :-------------------------------------------------------------- |
| **1** | `missing-name.html`   | Icon button without text content, aria-label or title; empty link                   | `button-name`, `link-name`                           | `critical` / `serious`                         | **The Name Chamber**                                            | 4.1.2 Name, Role, Value (Level A)                               |
| **2** | `color-contrast.html` | Pale text (#bbbbbb) on white background (#ffffff) with 1.8:1 ratio                  | `color-contrast`                                     | `serious`                                      | **The Contrast Crypt**                                          | 1.4.3 Contrast (Minimum) (Level AA)                             |
| **3** | `image-alt.html`      | Informative `<img>` element lacking `alt` attribute                                 | `image-alt`                                          | `critical`                                     | **The Portrait Gallery**                                        | 1.1.1 Non-text Content (Level A)                                |
| **4** | `form-label.html`     | Text input control missing associated `<label>` or aria attribute                   | `label`                                              | `critical`                                     | **The Form Cellar**                                             | 1.3.1 Info and Relationships (Level A), 4.1.2 Name, Role, Value |
| **5** | `heading-order.html`  | Document skips from `<h1>` directly to `<h4>`                                       | `heading-order`                                      | `moderate`                                     | **The Structure Hall**                                          | 1.3.1 Info and Relationships (Best Practice / Advisory)         |
| **6** | `focus-tabindex.html` | Elements using positive integer `tabindex="5"` and `tabindex="1"`                   | `tabindex`                                           | `serious`                                      | **The Focus Corridor**                                          | 2.4.3 Focus Order (Level A)                                     |
| **7** | `clean-baseline.html` | Fully accessible page with headings, landmark, labeled form and valid contrast      | _(None — 0 violations)_                              | _N/A_                                          | **All Quiet / Calm**                                            | All evaluated automated criteria satisfied                      |
| **8** | `mixed-issues.html`   | Multi-defect page containing button-name, image-alt, label, contrast, heading-order | `button-name`, `image-alt`, `label`, `heading-order` | Multi-tier (`critical`, `serious`, `moderate`) | **Name Chamber, Portrait Gallery, Form Cellar, Structure Hall** | Multi-criterion automated benchmark                             |
