# CHANGELOG — Der Wegweiser

All notable changes to **Der Wegweiser** will be documented in this file.

---

## [1.0.2] - 2026-10-01 — Patch 2: Real Telemetry, ErrorBoundary & API Verification

### 🔌 Real Telemetry & API Verification
* **Removed Fake Telemetry**: Removed fabricated 540Wh/85% battery fallback values.
* **Real Charging Stations**: Removed the fake curated charging station mock database in favor of real Overpass/Firestore queries.
* **Explicit Hardware Failures**: Made Bosch display mirroring fail explicitly instead of faking success.
* **Vision Photo Recognition**: Made Vision photo recognition fail explicitly instead of faking success.

### 🛡️ Core Stability
* **Added ErrorBoundary**: Introduced an `ErrorBoundary` component to catch and gracefully handle rendering errors.


## [1.0.1] - 2026-09-18 — Patch 1: Map 3D Billboarding, HUD Streamlining & Consumer OAuth

### 🗺️ Map & 3D Perspective Enhancements
* **Fixed Map Zoom Reset**: Resolved camera reset bug when zooming/panning during active GPS tracking by introducing `isAutoFollow` state linked to Leaflet `dragstart` and `zoomstart` event listeners.
* **3D Billboarding Rendering**: Added CSS counter-transformation (`rotateX(-55deg) translateZ(...)`) for Leaflet markers and speech bubble popups in 3D perspective mode, ensuring markers stand upright perpendicular to the map plane.

### 🧭 Navigation HUD Streamlining
* **Clean Navigation Screen**: Automatically hide top header bar (login, token display, main branding) and non-navigation menu buttons when a route is active (`isNavigating = true`).
* **Ergonomic Controls Layout**:
  * **Bottom-Left**: Scanner button (`+ Säule`).
  * **Bottom-Right**: `⚡ Fahrt-Modus` button stacked cleanly above the floating voice-guided microphone button.
  * **Top-Right**: Sunlight and OLED high-contrast toggle buttons.
* **Telemetry Ribbon Integration**: Integrated live battery state of charge (SoC %), estimated range, and motor power directly into the bottom elevation profile ribbon during active navigation.
* **Brand-Agnostic Display Push**: Renamed and generalized the route export button in AI Anticipation Modal to **"Push to E-Bike"** (`EBikeDisplayService`), supporting all connected displays (Bosch, Specialized, Shimano, Mahle, Bafang).

### 🔑 Authentication & OAuth Expansion
* **Removed GitHub OAuth**: Replaced developer-focused GitHub authentication with consumer social logins.
* **Added Social OAuth Providers**: Integrated Google (default), Apple, Microsoft, Facebook, X (Twitter), and Telegram authentication options.

### 🧪 Test Suite & Verification
* **15 Mission-Critical Scenarios Updated**: Added automated assertions in `scripts/test_mission_critical_scenarios.mjs` verifying 3D CSS billboarding rules, Navigation HUD auto-hiding logic, and consumer OAuth options (50/50 assertions passed).
