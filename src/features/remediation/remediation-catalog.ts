/**
 * Phantom Audit — Remediation Rule Catalog
 *
 * Deterministic knowledge base for high-frequency WCAG and Axe Best-Practice rules.
 * Strictly adheres to official axe-core 4.14.0 metadata and WCAG 2.2 specifications.
 */

import type { RemediationGuidance } from '@/domain/remediation';

export const REMEDIATION_CATALOG: Record<string, RemediationGuidance> = {
  // ── 1. button-name (The Name Chamber) ──
  'button-name': {
    ruleId: 'button-name',
    title: 'Buttons must have discernible, accessible text',
    classification: 'normative-wcag',
    wcagCriterion: '4.1.2 Name, Role, Value',
    wcagLevel: 'A',
    whyItMatters:
      'Buttons trigger actions. When a button lacks an accessible name, assistive technology users cannot determine whether activating it will submit a payment, navigate to a new page, or delete sensitive data.',
    humanImpacts: [
      {
        userGroup: 'Screen Reader Users',
        consequence:
          'Screen readers announce the element as "button" or read out raw SVG path coordinates, concealing its purpose.',
      },
      {
        userGroup: 'Voice Control Users',
        consequence:
          'Users navigating by voice cannot target or click the button because they cannot speak its name.',
      },
    ],
    rootCauseAnalysis:
      'The button contains only graphical icons (such as SVG, icon fonts, or empty containers) without inner visible text, an aria-label, aria-labelledby reference, or an image with alt text.',
    badExample: {
      snippet: `<button class="btn-icon">
  <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
</button>`,
      reason:
        'The button has no visible text, no aria-label, and no accessible name in the accessibility tree.',
    },
    goodExamples: [
      {
        language: 'html',
        title: 'Native Visible Text (Preferred)',
        code: `<button type="button" class="btn-primary">
  <svg aria-hidden="true" viewBox="0 0 24 24">...</svg>
  <span>Close</span>
</button>`,
        explanation:
          'Visible text benefits all users and guarantees a discernible accessible name without ARIA overhead.',
        isPrimary: true,
      },
      {
        language: 'html',
        title: 'Visually Hidden Text (sr-only)',
        code: `<button type="button" class="btn-icon">
  <svg aria-hidden="true" viewBox="0 0 24 24">...</svg>
  <span class="sr-only">Close Dialog</span>
</button>`,
        explanation:
          'Keeps the visual design icon-only while rendering full text into the accessibility tree.',
      },
      {
        language: 'html',
        title: 'ARIA Label on Icon-Only Control',
        code: `<button type="button" class="btn-icon" aria-label="Close Dialog">
  <svg aria-hidden="true" viewBox="0 0 24 24">...</svg>
</button>`,
        explanation:
          'Provides an explicit programmatic label for standalone icon buttons.',
      },
      {
        language: 'react',
        title: 'React / JSX Component',
        code: `export function CloseButton({ onClose }: { onClose: () => void }) {
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
}`,
        explanation:
          'Explicit type="button", aria-label on interactive element, and aria-hidden on decorative icon.',
      },
      {
        language: 'css',
        title: 'Screen-Reader Utility Class (.sr-only)',
        code: `.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}`,
        explanation:
          'Industry standard utility to visually hide text while preserving screen reader accessibility.',
      },
    ],
    potentialPitfalls: [
      'Do NOT add aria-hidden="true" to the <button> itself; that completely removes the interactive control from screen readers.',
      'Always include type="button" on non-submitting buttons inside forms to prevent unintended form submission.',
    ],
    verificationSteps: [
      {
        method: 'keyboard',
        instruction: 'Press Tab to focus the button.',
        expectedResult: 'A prominent focus indicator (ring/outline) is clearly visible.',
      },
      {
        method: 'screen-reader',
        instruction: 'Focus the button using VoiceOver or NVDA.',
        expectedResult:
          'Announces "Close, button" or "Close Dialog, button" instead of generic "button".',
      },
      {
        method: 'rescan',
        instruction: 'Click "Start Audit" to run an axe-core verification rescan.',
        expectedResult: 'The button-name finding is classified as Resolved.',
      },
    ],
    officialDocUrl: 'https://dequeuniversity.com/rules/axe/4.14/button-name',
  },

  // ── 2. link-name (The Name Chamber) ──
  'link-name': {
    ruleId: 'link-name',
    title: 'Links must have discernible, meaningful destination text',
    classification: 'normative-wcag',
    wcagCriterion: '2.4.4 Link Purpose / 4.1.2 Name, Role, Value',
    wcagLevel: 'A',
    whyItMatters:
      'Screen reader users frequently navigate pages using a Links List (Insert + F7 in NVDA, VO + U in VoiceOver). Links named "click here", "learn more", or icon-only links provide zero context out of flow.',
    humanImpacts: [
      {
        userGroup: 'Screen Reader Navigators',
        consequence:
          'Encountering lists of identical links saying "click here" makes it impossible to know where each link navigates.',
      },
      {
        userGroup: 'Cognitive & Low-Vision Users',
        consequence:
          'Ambiguous link text forces users to re-read surrounding paragraphs to deduce the destination.',
      },
    ],
    rootCauseAnalysis:
      'The <a> element lacks inner text, contains only decorative icons/whitespace, or has an empty accessible name.',
    badExample: {
      snippet: `<a href="/reports/2026-audit.pdf">Click here</a>
<a href="/social/twitter"><i class="fab fa-twitter"></i></a>`,
      reason:
        'First link uses ambiguous phrase "Click here"; second link contains only an icon with no text or label.',
    },
    goodExamples: [
      {
        language: 'html',
        title: 'Descriptive Link Text (Preferred)',
        code: `<a href="/reports/2026-audit.pdf">
  Download 2026 Audit Report (PDF, 2.4 MB)
</a>`,
        explanation:
          'Conveys destination, document format, and file size within the link text itself.',
        isPrimary: true,
      },
      {
        language: 'html',
        title: 'Social / Icon Link with aria-label',
        code: `<a href="https://twitter.com/example" aria-label="Phantom Audit on Twitter (opens in new tab)" target="_blank" rel="noopener noreferrer">
  <svg aria-hidden="true" viewBox="0 0 24 24">...</svg>
</a>`,
        explanation:
          'Provides accessible destination name and indicates that the link opens in a new tab.',
      },
      {
        language: 'react',
        title: 'React Link Component',
        code: `export function ReportLink({ filename, size }: { filename: string; size: string }) {
  return (
    <a
      href={\`/downloads/\${filename}\`}
      className="text-cyan-400 hover:underline inline-flex items-center gap-1"
    >
      <span>Download Accessibility Audit (\${size})</span>
      <ArrowDownTrayIcon className="w-4 h-4" aria-hidden="true" />
    </a>
  );
}`,
        explanation:
          'Combines discernible text with a decorative download indicator icon.',
      },
    ],
    potentialPitfalls: [
      'Avoid link text that only repeats the URL (e.g. "https://example.com/a/b/c").',
      'If using target="_blank", warn users in text or aria-label that the link opens in a new window.',
    ],
    verificationSteps: [
      {
        method: 'screen-reader',
        instruction: 'Open the Screen Reader Links List (VO + U or Insert + F7).',
        expectedResult:
          'The link destination is immediately obvious without reading surrounding text.',
      },
      {
        method: 'rescan',
        instruction: 'Run Phantom Audit rescan.',
        expectedResult: 'link-name finding is certified resolved.',
      },
    ],
    officialDocUrl: 'https://dequeuniversity.com/rules/axe/4.14/link-name',
  },

  // ── 3. color-contrast (The Contrast Crypt) ──
  'color-contrast': {
    ruleId: 'color-contrast',
    title: 'Text elements must satisfy minimum color contrast ratio thresholds',
    classification: 'normative-wcag',
    wcagCriterion: '1.4.3 Contrast (Minimum)',
    wcagLevel: 'AA',
    whyItMatters:
      'Insufficient contrast between text and its background causes severe eye fatigue and renders content unreadable for users with low vision, color blindness, or users viewing screens under direct sunlight.',
    humanImpacts: [
      {
        userGroup: 'Low-Vision & Aging Users',
        consequence:
          'Faint gray text on white or dark purple on black washes out completely, preventing information comprehension.',
      },
      {
        userGroup: 'Mobile / Sunlight Users',
        consequence:
          'Screens in high ambient light reflect glare that obliterates low-contrast typography.',
      },
    ],
    rootCauseAnalysis:
      'The computed luminance contrast ratio between foreground text and background color falls below 4.5:1 for regular text or 3.0:1 for large text (>= 18pt regular or >= 14pt bold).',
    badExample: {
      snippet: `/* BAD: Contrast ratio is 2.1:1 on white background */
.caption-text {
  color: #94a3b8; /* Slate 400 */
  background-color: #ffffff;
}`,
      reason:
        'A ratio of 2.1:1 fails the minimum 4.5:1 requirement for standard body typography.',
    },
    goodExamples: [
      {
        language: 'css',
        title: 'Adjust Foreground Luminance (Light Theme)',
        code: `/* GOOD: Contrast ratio is 5.9:1 against #ffffff (Meets WCAG AA) */
.caption-text {
  color: #475569; /* Slate 600 */
  background-color: #ffffff;
}`,
        explanation:
          'Darkens the slate text to achieve a crisp, readable 5.9:1 luminance ratio.',
        isPrimary: true,
      },
      {
        language: 'css',
        title: 'Adjust Foreground Luminance (Dark Gothic Theme)',
        code: `/* GOOD: Contrast ratio is 11.2:1 against #0a0a0f */
.dark-caption {
  color: #cbd5e1; /* Slate 300 */
  background-color: #0a0a0f;
}`,
        explanation: 'Provides high contrast against dark mansion backgrounds.',
      },
      {
        language: 'react',
        title: 'Tailwind CSS Accessible Color Classes',
        code: `<p className="text-gray-700 dark:text-gray-200 text-sm leading-relaxed">
  Automated accessibility evaluation requires human verification.
</p>`,
        explanation:
          'Uses vetted accessible color pairs that adapt to light and dark theme contexts.',
      },
    ],
    potentialPitfalls: [
      'CSS opacity and rgba() color values reduce effective contrast.',
      'Background images or gradients with variable brightness require semi-transparent overlays or text shadows.',
    ],
    verificationSteps: [
      {
        method: 'visual',
        instruction:
          'Inspect element in Chrome DevTools Styles panel and click color swatch.',
        expectedResult: 'Contrast ratio shows a green checkmark indicating >= 4.5:1.',
      },
      {
        method: 'rescan',
        instruction: 'Re-run Phantom Audit scan.',
        expectedResult: 'color-contrast finding is cleared.',
      },
    ],
    officialDocUrl: 'https://dequeuniversity.com/rules/axe/4.14/color-contrast',
  },

  // ── 4. image-alt (The Portrait Gallery) ──
  'image-alt': {
    ruleId: 'image-alt',
    title: 'Images must have meaningful alternative text or be marked decorative',
    classification: 'normative-wcag',
    wcagCriterion: '1.1.1 Non-text Content',
    wcagLevel: 'A',
    whyItMatters:
      'Images convey information, mood, and context. When the alt attribute is missing, screen readers fall back to reciting raw file URLs (e.g. "IMG_9024_banner_v2.png"), providing noise rather than understanding.',
    humanImpacts: [
      {
        userGroup: 'Screen Reader Users',
        consequence:
          'Missing alt attributes force screen readers to read lengthy file paths or announce "unlabeled graphic".',
      },
      {
        userGroup: 'Low-Bandwidth Users',
        consequence:
          'When images fail to load due to network disruption, browsers display alt text in their place.',
      },
    ],
    rootCauseAnalysis:
      'The <img> element is missing an alt attribute entirely. (Note: alt="" with no value is valid for decorative images; completely omitting alt is the violation).',
    badExample: {
      snippet: `<!-- BAD: Missing alt attribute -->
<img src="/images/hero-mansion.jpg">
<!-- BAD: Redundant filler words in alt -->
<img src="/images/avatar.jpg" alt="Photo image picture of John Doe">`,
      reason:
        'First image has no alt attribute; second image clutters screen reader announcements with redundant words.',
    },
    goodExamples: [
      {
        language: 'html',
        title: 'Informative Image with Concise Description',
        code: `<img 
  src="/images/hero-mansion.jpg" 
  alt="Two-story Victorian haunted mansion under a full moon with glowing purple windows"
>`,
        explanation:
          'Describes the key visual content concisely without saying "image of".',
        isPrimary: true,
      },
      {
        language: 'html',
        title: 'Decorative Image (alt="")',
        code: `<img 
  src="/images/divider-flourish.svg" 
  alt="" 
  role="presentation"
>`,
        explanation:
          'Empty alt attribute signals to assistive technology that this graphic is purely decorative and should be skipped.',
      },
      {
        language: 'react',
        title: 'React / Next.js Image Pattern',
        code: `import Image from 'next/image';

export function HeroBanner() {
  return (
    <Image
      src="/assets/mansion-banner.webp"
      alt="Interactive architectural diagram of the haunted mansion"
      width={680}
      height={490}
      priority
    />
  );
}`,
        explanation:
          'Modern frameworks require the alt attribute; supply descriptive text for informative media.',
      },
    ],
    potentialPitfalls: [
      'Do not include words like "image of", "graphic of", or "photo of" in the alt text; screen readers already announce that the element is an image.',
      'Complex infographics or charts need a short alt text plus an extended text description in the body.',
    ],
    verificationSteps: [
      {
        method: 'screen-reader',
        instruction: 'Navigate to the image with a screen reader.',
        expectedResult:
          'Screen reader announces the descriptive text clearly or skips decorative images entirely.',
      },
      {
        method: 'rescan',
        instruction: 'Trigger Phantom Audit rescan.',
        expectedResult: 'image-alt finding is resolved.',
      },
    ],
    officialDocUrl: 'https://dequeuniversity.com/rules/axe/4.14/image-alt',
  },

  // ── 5. svg-img-alt (The Portrait Gallery) ──
  'svg-img-alt': {
    ruleId: 'svg-img-alt',
    title: 'Inline SVG graphics with an image role must have alternative text',
    classification: 'normative-wcag',
    wcagCriterion: '1.1.1 Non-text Content',
    wcagLevel: 'A',
    whyItMatters:
      'When an inline SVG graphic carries role="img" or role="image", browsers treat it as an image element. Without an accessible name, screen reader users hear only "image" with zero description.',
    humanImpacts: [
      {
        userGroup: 'Screen Reader Users',
        consequence:
          'Icons conveying status (e.g. checkmark, warning, error) are invisible to screen reader users when SVGs lack accessible names.',
      },
    ],
    rootCauseAnalysis:
      'The <svg> element has role="img" or role="image" but lacks an accessible name via <title> element, aria-label, or aria-labelledby.',
    badExample: {
      snippet: `<!-- BAD: role="img" with no title or accessible label -->
<svg role="img" viewBox="0 0 24 24">
  <path d="M12 2L2 22h20L12 2z"/>
</svg>`,
      reason: 'The SVG is defined as an image but supplies no title or aria-label.',
    },
    goodExamples: [
      {
        language: 'html',
        title: 'Title Element with aria-labelledby (Informative SVG)',
        code: `<svg role="img" aria-labelledby="status-warn-title" viewBox="0 0 24 24">
  <title id="status-warn-title">Warning: Critical accessibility defect detected</title>
  <path d="M12 2L2 22h20L12 2z"/>
</svg>`,
        explanation:
          'Combines a descriptive <title> with aria-labelledby for universal browser and screen reader support.',
        isPrimary: true,
      },
      {
        language: 'html',
        title: 'Decorative Inline SVG (aria-hidden)',
        code: `<!-- When SVG is purely decorative next to visible text -->
<button type="button">
  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="..."/></svg>
  <span>Export Report</span>
</button>`,
        explanation:
          'Decorative SVG is hidden from the accessibility tree; the button label provides the accessible name.',
      },
      {
        language: 'react',
        title: 'React Accessible Icon Wrapper',
        code: `export function WarningIcon({ label }: { label?: string }) {
  if (!label) {
    return <ExclamationTriangleIcon className="w-5 h-5 text-amber-400" aria-hidden="true" />;
  }
  return (
    <ExclamationTriangleIcon
      role="img"
      aria-label={label}
      className="w-5 h-5 text-amber-400"
    />
  );
}`,
        explanation:
          'Conditionally toggles between decorative aria-hidden and informative role="img" with aria-label.',
      },
    ],
    potentialPitfalls: [
      'SVG <title> without an id and aria-labelledby is ignored by certain older screen readers.',
    ],
    verificationSteps: [
      {
        method: 'screen-reader',
        instruction: 'Focus or virtual-navigate to the SVG graphic.',
        expectedResult: 'Announces the title text or label clearly as an image.',
      },
      {
        method: 'rescan',
        instruction: 'Run Phantom Audit rescan.',
        expectedResult: 'svg-img-alt finding is certified resolved.',
      },
    ],
    officialDocUrl: 'https://dequeuniversity.com/rules/axe/4.14/svg-img-alt',
  },

  // ── 6. label (The Form Cellar) ──
  label: {
    ruleId: 'label',
    title: 'Form controls must have associated accessible labels',
    classification: 'normative-wcag',
    wcagCriterion: '4.1.2 Name, Role, Value',
    wcagLevel: 'A',
    whyItMatters:
      'Form inputs require clear labels so users know what data is expected. Screen reader users focusing an unlabeled field hear only "Edit text, blank". Clicking a label also enlarges the clickable target area for motor-impaired users.',
    humanImpacts: [
      {
        userGroup: 'Screen Reader Users',
        consequence:
          'Users navigating by Tab hear only the input type with no indication whether it expects an email, name, or password.',
      },
      {
        userGroup: 'Motor & Tremor Impaired Users',
        consequence:
          'Labels associated via for/id enlarge the touch/click target, facilitating activation.',
      },
    ],
    rootCauseAnalysis:
      'An <input> (other than hidden/button/submit/reset/image), <textarea>, or <select> element lacks an associated <label for="id">, an implicit parent <label>, or an aria-label/aria-labelledby.',
    badExample: {
      snippet: `<!-- BAD: Placeholder is NOT an accessible label -->
<input type="text" id="username" placeholder="Username">`,
      reason:
        'Placeholders disappear on focus/typing, have poor default contrast, and are not reliably announced as labels by screen readers.',
    },
    goodExamples: [
      {
        language: 'html',
        title: 'Explicit Label Association (Recommended Native Pattern)',
        code: `<div class="form-group">
  <label for="user-login-name">Username or Email</label>
  <input 
    type="text" 
    id="user-login-name" 
    name="username" 
    autocomplete="username" 
    required
  >
</div>`,
        explanation:
          'The label for attribute matches the input id attribute exactly, providing programmatic association.',
        isPrimary: true,
      },
      {
        language: 'html',
        title: 'Implicit Wrapping Label',
        code: `<label>
  <span>Username or Email</span>
  <input type="text" name="username" required>
</label>`,
        explanation:
          'Nesting the input inside the <label> provides implicit association without requiring ids.',
      },
      {
        language: 'react',
        title: 'React Accessible Form Field',
        code: `import { useId } from 'react';

export function TextField({ label, name, ...props }: { label: string; name: string }) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-gray-300">
        {label}
      </label>
      <input
        id={id}
        name={name}
        className="w-full rounded bg-surface border border-gray-700 px-3 py-1.5 text-white"
        {...props}
      />
    </div>
  );
}`,
        explanation:
          'Uses React 19 useId() to guarantee globally unique htmlFor and id pairings.',
      },
    ],
    potentialPitfalls: [
      'Never rely on placeholder as the sole label for form fields.',
      'Ensure the label for attribute exactly matches the input id attribute, not its name attribute.',
    ],
    verificationSteps: [
      {
        method: 'visual',
        instruction: 'Click directly on the text label with your mouse.',
        expectedResult: 'Focus cursor moves automatically into the input field.',
      },
      {
        method: 'screen-reader',
        instruction: 'Press Tab into the input field.',
        expectedResult: 'Screen reader immediately announces the label text.',
      },
      {
        method: 'rescan',
        instruction: 'Re-run Phantom Audit scan.',
        expectedResult: 'label finding is resolved.',
      },
    ],
    officialDocUrl: 'https://dequeuniversity.com/rules/axe/4.14/label',
  },

  // ── 7. select-name (The Form Cellar) ──
  'select-name': {
    ruleId: 'select-name',
    title: 'Select drop-down elements must have an accessible name',
    classification: 'normative-wcag',
    wcagCriterion: '4.1.2 Name, Role, Value',
    wcagLevel: 'A',
    whyItMatters:
      'Select elements present a list of choices. Without an accessible label, users navigating through forms have no way of knowing what choices they are selecting.',
    humanImpacts: [
      {
        userGroup: 'Screen Reader Users',
        consequence:
          'Focusing the select menu announces only "Pop-up button" or "Combobox" without the prompt or title.',
      },
    ],
    rootCauseAnalysis:
      'The <select> element is not associated with a <label for="id">, is not nested inside a <label>, and lacks an aria-label.',
    badExample: {
      snippet: `<!-- BAD: Unlabeled select element -->
<select id="country">
  <option value="">Select country</option>
  <option value="us">United States</option>
</select>`,
      reason:
        'The select element has no programmatic label connecting it to descriptive text.',
    },
    goodExamples: [
      {
        language: 'html',
        title: 'Native <label for="..."> Association (Preferred)',
        code: `<div class="form-group">
  <label for="country-select">Country of Residence</label>
  <select id="country-select" name="country" required>
    <option value="">Please select a country</option>
    <option value="us">United States</option>
    <option value="ca">Canada</option>
  </select>
</div>`,
        explanation:
          'Connects the visible label with the select control via matching for and id.',
        isPrimary: true,
      },
      {
        language: 'react',
        title: 'React Select Dropdown Component',
        code: `import { useId } from 'react';

export function CountrySelect() {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-semibold text-gray-300">
        Country of Residence
      </label>
      <select id={id} className="w-full bg-surface-raised border rounded p-2 text-white">
        <option value="">Choose option</option>
        <option value="us">United States</option>
      </select>
    </div>
  );
}`,
        explanation:
          'Guarantees accessible label binding in componentized architectures.',
      },
    ],
    potentialPitfalls: [
      'The first <option> with text "Select an option" is NOT an accessible label for the <select> element itself.',
    ],
    verificationSteps: [
      {
        method: 'screen-reader',
        instruction: 'Tab to the select menu with screen reader enabled.',
        expectedResult:
          'Announces "Country of Residence, pop-up button" or "Country of Residence, collapsed combobox".',
      },
      {
        method: 'rescan',
        instruction: 'Run Phantom Audit rescan.',
        expectedResult: 'select-name finding is certified resolved.',
      },
    ],
    officialDocUrl: 'https://dequeuniversity.com/rules/axe/4.14/select-name',
  },

  // ── 8. heading-order (The Structure Hall) ──
  'heading-order': {
    ruleId: 'heading-order',
    title: 'Heading levels should only increase by one level at a time',
    classification: 'best-practice',
    wcagCriterion: 'Advisory for 1.3.1 Info & Relationships',
    wcagLevel: 'Advisory',
    whyItMatters:
      'Headings create a semantic outline of the document. Skipping heading levels (e.g. jumping from h1 directly to h4) leads screen reader users to believe intermediate sections were missed or failed to load.',
    humanImpacts: [
      {
        userGroup: 'Screen Reader Outline Navigators',
        consequence:
          'Navigating by heading keys (H, 1-6) becomes disorienting when the hierarchical outline has gaps.',
      },
    ],
    rootCauseAnalysis:
      'A heading element increases by more than one level relative to the previous heading on the page (e.g. <h1> followed by <h4> instead of <h2>).',
    badExample: {
      snippet: `<!-- BAD: Heading level skips from h1 directly to h4 -->
<h1>Phantom Audit Dashboard</h1>
<h4>Mansion Wings</h4>`,
      reason:
        'Heading level skips from 1 to 4, breaking the hierarchical document outline.',
    },
    goodExamples: [
      {
        language: 'html',
        title: 'Sequential Heading Hierarchy (Recommended)',
        code: `<h1>Phantom Audit Dashboard</h1>
<h2>Mansion Wings Overview</h2>
<h3>The Name Chamber</h3>`,
        explanation:
          'Heading levels step sequentially: h1 -> h2 -> h3, reflecting logical nesting.',
        isPrimary: true,
      },
      {
        language: 'css',
        title: 'Decouple Heading Semantics from Visual Font Size',
        code: `/* Use semantic <h2> but style it with smaller font size */
h2.section-heading {
  font-size: 0.875rem; /* text-sm */
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}`,
        explanation:
          'Developers often skip heading levels for visual styling. Always separate semantic level from visual CSS styling.',
      },
      {
        language: 'react',
        title: 'React Section Heading Pattern',
        code: `<section aria-labelledby="wings-heading">
  <h2 id="wings-heading" className="text-lg font-bold text-white font-display">
    Haunted Mansion Wings
  </h2>
  {/* Content */}
</section>`,
        explanation: 'Pairs sequential headings with semantic <section> containers.',
      },
    ],
    potentialPitfalls: [
      'Do not pick heading tags based on visual font size. Choose heading tags according to document outline, and style them using CSS.',
    ],
    verificationSteps: [
      {
        method: 'screen-reader',
        instruction:
          'Open Heading Outline in screen reader (NVDA: Insert + F7 -> Headings, VoiceOver: VO + U -> Headings).',
        expectedResult:
          'Headings form a clean, nested tree structure with no level skips.',
      },
      {
        method: 'rescan',
        instruction: 'Run Phantom Audit rescan.',
        expectedResult: 'heading-order advisory finding is resolved.',
      },
    ],
    officialDocUrl: 'https://dequeuniversity.com/rules/axe/4.14/heading-order',
  },

  // ── 9. landmark-one-main (The Structure Hall) ──
  'landmark-one-main': {
    ruleId: 'landmark-one-main',
    title: 'The document should contain a single primary <main> landmark',
    classification: 'best-practice',
    wcagCriterion: 'Advisory for 1.3.1 Info & Rel / 2.4.1 Bypass',
    wcagLevel: 'Advisory',
    whyItMatters:
      'Landmarks allow assistive technology users to jump directly to key page regions (navigation, banner, main, footer). A single <main> element allows users to skip repetitive header and navigation links with a single keystroke.',
    humanImpacts: [
      {
        userGroup: 'Screen Reader & Keyboard Users',
        consequence:
          'Without a main landmark, users must tab through dozens of navigation links on every page view.',
      },
    ],
    rootCauseAnalysis:
      'The HTML document lacks a <main> element (or [role="main"]), or contains multiple top-level <main> elements without distinct labels.',
    badExample: {
      snippet: `<!-- BAD: Page body uses only unsemantic generic divs -->
<body>
  <div class="header">...</div>
  <div class="content">...</div>
  <div class="footer">...</div>
</body>`,
      reason:
        'Lacks semantic landmarks; screen reader users cannot jump to content via landmark shortcut keys.',
    },
    goodExamples: [
      {
        language: 'html',
        title: 'Standard Semantic HTML5 Landmarks',
        code: `<body>
  <header role="banner">
    <!-- Navigation and logo -->
  </header>
  
  <main id="main-content" role="main">
    <!-- Primary page content goes here -->
  </main>
  
  <footer role="contentinfo">
    <!-- Footer notes and disclosures -->
  </footer>
</body>`,
        explanation:
          'The single <main> landmark clearly demarcates primary page content from peripheral chrome.',
        isPrimary: true,
      },
      {
        language: 'react',
        title: 'Accessible Application Shell Layout',
        code: `export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-base text-gray-100">
      <AppHeader />
      <main id="main-content" role="main" className="flex-1 max-w-7xl w-full mx-auto p-6">
        {children}
      </main>
      <AppFooter />
    </div>
  );
}`,
        explanation: 'Implements single <main> wrapper across the application layout.',
      },
    ],
    potentialPitfalls: [
      'Do not place multiple <main> elements on the same page unless hidden (e.g. inert tab panels).',
    ],
    verificationSteps: [
      {
        method: 'screen-reader',
        instruction: 'Press landmark navigation key (D in NVDA, VO + U in VoiceOver).',
        expectedResult:
          'Screen reader announces "main landmark" and jumps directly to primary content.',
      },
      {
        method: 'rescan',
        instruction: 'Run Phantom Audit rescan.',
        expectedResult: 'landmark-one-main advisory finding is resolved.',
      },
    ],
    officialDocUrl: 'https://dequeuniversity.com/rules/axe/4.14/landmark-one-main',
  },

  // ── 10. tabindex (The Focus Corridor) ──
  tabindex: {
    ruleId: 'tabindex',
    title: 'Elements should not have a tabindex attribute value greater than zero',
    classification: 'best-practice',
    wcagCriterion: 'Advisory for 2.4.3 Focus Order',
    wcagLevel: 'Advisory',
    whyItMatters:
      'Positive tabindex values (e.g. tabindex="1", tabindex="5") hijack the natural DOM tab order. Keyboard focus jumps erratically across the page before returning to native elements, breaking expectations and frustrating users.',
    humanImpacts: [
      {
        userGroup: 'Keyboard-Only Navigators',
        consequence:
          'Pressing Tab moves the focus cursor unpredictably instead of following natural visual reading order.',
      },
      {
        userGroup: 'Screen Reader Users',
        consequence:
          'Disrupted focus order creates spatial confusion about where interactive controls reside.',
      },
    ],
    rootCauseAnalysis:
      'An element has an explicit tabindex attribute whose integer value is greater than 0 (e.g. tabindex="1").',
    badExample: {
      snippet: `<!-- BAD: Positive tabindex disrupts logical tab order -->
<button tabindex="2">Save</button>
<button tabindex="1">Cancel</button>`,
      reason:
        'Focus lands on Cancel first, then Save, jumping over any native inputs preceding them.',
    },
    goodExamples: [
      {
        language: 'html',
        title: 'Natural DOM Order without Tabindex (Preferred)',
        code: `<!-- GOOD: Arrange elements in logical order in HTML source -->
<button type="button" class="btn-secondary">Cancel</button>
<button type="submit" class="btn-primary">Save Changes</button>`,
        explanation:
          'Native interactive elements (<button>, <a>, <input>) are naturally focusable in DOM source order.',
        isPrimary: true,
      },
      {
        language: 'html',
        title: 'Programmatic Focus (tabindex="-1")',
        code: `<!-- Focusable via JavaScript (e.g. element.focus()) but excluded from Tab flow -->
<div id="modal-dialog" tabindex="-1" role="dialog" aria-modal="true">
  ...
</div>`,
        explanation:
          'Allows JavaScript to move focus into a newly opened modal dialog or notification banner.',
      },
      {
        language: 'react',
        title: 'Accessible Focus Management Pattern',
        code: `import { useRef, useEffect } from 'react';

export function Modal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      containerRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      className="outline-none"
    >
      {/* Dialog content */}
    </div>
  );
}`,
        explanation:
          'Uses tabIndex={-1} for accessible programmatic focus transfer on mount.',
      },
    ],
    potentialPitfalls: [
      'Never use positive tabindex values to fix focus order bugs. Always fix the underlying HTML source order or CSS flex/grid layout.',
      'Only use tabindex="0" on non-interactive elements when building custom ARIA widgets with full keyboard event handlers.',
    ],
    verificationSteps: [
      {
        method: 'keyboard',
        instruction: 'Press Tab repeatedly from top of page to bottom.',
        expectedResult:
          'Focus moves logically in sequential top-to-bottom reading order without jumping.',
      },
      {
        method: 'rescan',
        instruction: 'Run Phantom Audit rescan.',
        expectedResult: 'tabindex advisory finding is resolved.',
      },
    ],
    officialDocUrl: 'https://dequeuniversity.com/rules/axe/4.14/tabindex',
  },
};

/**
 * Retrieves catalog guidance for a rule ID, or returns undefined if unmapped.
 */
export function getCatalogGuidance(ruleId: string): RemediationGuidance | undefined {
  if (!ruleId || typeof ruleId !== 'string') return undefined;
  const clean = ruleId.trim().toLowerCase();
  return REMEDIATION_CATALOG[clean];
}

/**
 * Checks if a rule has a curated catalog entry.
 */
export function hasCatalogGuidance(ruleId: string): boolean {
  return Boolean(getCatalogGuidance(ruleId));
}
