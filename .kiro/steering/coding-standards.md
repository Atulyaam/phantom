# Phantom Audit — Coding Standards Steering

## 1. TypeScript Strictness

- `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`, `noUnusedLocals: true`, `noUnusedParameters: true`.
- Zero `any` policy unless interacting with an un-typed external browser legacy shim.
- No `as unknown as Type` type-casting tricks to silence compiler errors. Fix root type mismatches.

## 2. Code Quality & Formatting

- ESLint (Flat Config v9) and Prettier must pass with 0 errors and 0 warnings before any phase approval.
- Pure functions preferred for domain normalization, comparison algorithms, and fingerprint calculations.

## 3. DOM & Security Rules

- **No `dangerouslySetInnerHTML`:** Code snippets and HTML excerpts extracted from audited pages are untrusted strings. Always render as escaped text within `<pre><code>` blocks.
- **Sanitization:** All HTML excerpts must be length-limited (< 1000 characters) and stripped of executable tags (`<script>`, `<iframe>`).

## 4. Import & Path Conventions

- Use the `@/*` alias for all internal source imports mapped to `./src/*`.
- Organize imports: Framework/React -> 3rd party packages -> Internal domain/lib -> Components -> Styles.
