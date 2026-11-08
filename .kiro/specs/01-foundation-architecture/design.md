# Phase 1 Foundation & Architecture — Design

## 1. Technical Design

- **Architecture Pattern:** Modular extension architecture with unidirectional data flow.
- **Service Worker (`background.ts`):** Handles user invocation (`browser.action.onClicked`), validates target tab eligibility (rejecting `chrome://` and web store origins), and launches the dashboard tab.
- **Dashboard Shell (`App.tsx`):**
  - Extract tab context from query parameters.
  - Display active tab card, unsupported target alert, and mansion room grid.
  - Provide accessible tabular alternative view for all rooms.
  - Provide reduced motion controls and interactive taxonomy inspector.

## 2. Design Tokens

- Midnight & obsidian palette (`#0b0c10`, `#14161f`) with high-contrast text (`#f3f4f6`, `#9ca3af`).
- Ethereal spectral accents (`#8b5cf6`, `#c084fc`, `#22d3ee`).
- 3px solid focus ring (`#38bdf8`) with 2px offset.
