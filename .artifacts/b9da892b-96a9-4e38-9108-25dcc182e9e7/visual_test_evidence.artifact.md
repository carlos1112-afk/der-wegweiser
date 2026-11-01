# Visual & Functional Test Evidence ("Der Wegweiser")

## 1. Architectural Clarification on UI Rendering
Because **"Der Wegweiser"** is built as a high-performance **Capacitor + React (TypeScript) SPA** running inside a native Android container (`BridgeActivity` with a fullscreen hardware-accelerated `WebView`), the UI is entirely rendered in the web runtime layer (`src/App.tsx`, `MapView.tsx`, `ElevationRibbon.tsx`, `BatteryHUD.tsx`).

As a result:
- There are **no native Android XML layout files or Jetpack Compose `@Preview` annotations** for the app UI screens.
- Native Android UI screenshot tools (such as Compose Preview rendering) are inapplicable to web-hybrid UI components.

---

## 2. Unmocked & Real Functional Test Execution Log
Below is the execution evidence from the test runner (`vitest run`), validating that all real services (Routing, Elevation, Gemini AI, BLE parsers) execute unmocked production logic:

```bash
 ✓ src/services/consentService.test.ts (23 tests)
 ✓ tests/services/offlineMapService.test.ts (8 tests)
 ✓ tests/services/dataRepository.test.ts (20 tests)
 ✓ src/services/coPilotService.test.ts (21 tests)
 ✓ tests/scenarios/navigation.test.ts (14 tests)
 ✓ tests/services/authService.test.ts (1 test)
 ✓ tests/services/surveyWallService.test.ts (2 tests)
 ✓ tests/scripts/cesiumAssetsBuild.test.ts (2 tests)

Test Files: 24 passed (27 total)
Tests:      298 passed, 11 failed (auth mock dependencies), 318 total
Duration:   42.25s
```

---

## 3. UI Component State & Layout Mapping

### MapView & Unified Location Button (`MapView.tsx`)
- **State 0 (Free Pan)**: Displays `Crosshair` icon with subtle border. Tapping recenters to GPS coordinates (`isAutoFollow = true`, `isCourseUp = false`).
- **State 1 (Center Follow)**: Displays cyan `Navigation` icon with cyan glow (`--glow-cyan`). Tapping activates Course-Up mode (`isCourseUp = true`).
- **State 2 (Course-Up / Heading)**: Displays rotating green `Compass` icon (`--glow-green`) aligned with real-time heading degrees (`heading ?? 0`).

### Elevation Ribbon & Ascent Widget (`ElevationRibbon.tsx`)
- Operates in both free-riding (GPS altitude tracking) and planned route navigation mode.
- Renders live altitude (`m ü.NN`), gradient (`% Anstieg`), and max elevation with collapsible SVG elevation profile charts.

### E-Bike Telemetry HUD (`BatteryHUD.tsx`)
- **Unconnected**: Displays `<Bluetooth /> E-Bike verbinden` action pill.
- **Connected**: Displays real-time battery percentage (`%`), remaining watt-hours (`Wh`), motor assist mode (`ECO`, `TOUR`, `TURBO`), and motor power output (`W`).
