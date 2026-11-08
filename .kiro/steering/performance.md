# Phantom Audit — Performance Steering

## 1. Performance Budgets & Targets

- **Extension Package Size:** < 3.5 MB uncompressed, < 1.0 MB compressed (hard limit: 5.0 MB).
- **Dashboard First Usable Render:** < 2.5 seconds on mid-tier hardware.
- **Unit Test Execution:** < 5 seconds for complete unit & property test suite.
- **Memory Footprint:** Keep local scan history bounded (maximum 50 snapshots in `chrome.storage.local`).

## 2. Optimization Guidelines

- **2D Vector Graphics:** Mansion visualization rendered in pure SVG/CSS, avoiding WebGL/Three.js GPU overhead.
- **Tree Shaking & Lazy Loading:** Ensure icons and components are tree-shaken by bundler; avoid importing full monolithic icon libraries.
- **Non-blocking Operations:** Audit processing and normalizations must run asynchronously to maintain UI responsiveness at 60 FPS.
